import prisma from '../../config/db.js';
import AppError from '../../utils/AppError.js';
import { deleteFromR2, uploadBase64ToR2, replaceImageInR2 } from '../../utils/r2.storage.js';
import ApiFeatures from '../../utils/ApiFeatures.js';

/**
 * ==========================================
 * HELPER UTILITIES
 * ==========================================
 */
const generateSlug = (text) => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-');
};

const calculateReadTime = (content) => {
  const wordsPerMinute = 225;
  const wordCount = content.trim().split(/\s+/).length;
  return Math.ceil(wordCount / wordsPerMinute);
};

class PostService {
  // ==========================================
  // 1. PUBLIC READER OPERATIONS (Highly Cached/Optimized)
  // ==========================================

  /**
   * Get all PUBLISHED posts with advanced filtering, searching, and pagination
   */
  static async getPublishedPosts(queryString) {
    // 1. Initialize ApiFeatures with base conditions
    const baseWhere = {
      status: 'PUBLISHED',
      OR: [
        { publishedAt: null },
        { publishedAt: { lte: new Date() } }
      ]
    };

    const features = new ApiFeatures(baseWhere, queryString)
      .filter()
      .search(['title', 'content', 'excerpt'])
      .sort()
      .limitFields()
      .paginate();

    // 2. Map specialized relationships (Prisma specific filters)
    if (queryString.categoryId) features.prismaQueryObj.where.categoryId = queryString.categoryId;
    if (queryString.authorId) features.prismaQueryObj.where.authorId = queryString.authorId;
    if (queryString.tagSlug) features.prismaQueryObj.where.tags = { some: { slug: queryString.tagSlug } };

    // 3. Define default projection if none requested
    if (!features.prismaQueryObj.select) {
      features.prismaQueryObj.select = {
        id: true,
        title: true,
        slug: true,
        excerpt: true,
        coverImage: true,
        readTime: true,
        viewCount: true,
        likeCount: true,
        createdAt: true,
        publishedAt: true,
        author: { select: { id: true, name: true, image: true } },
        category: { select: { name: true, slug: true } },
        tags: { select: { name: true, slug: true } },
      };
    }

    const [posts, totalCount] = await prisma.$transaction([
      prisma.post.findMany(features.query()),
      prisma.post.count({ where: features.query().where }),
    ]);

    return {
      posts,
      pagination: {
        total: totalCount,
        page: features.paginationMeta.page,
        limit: features.paginationMeta.limit,
        totalPages: Math.ceil(totalCount / features.paginationMeta.limit),
      },
    };
  }

  /**
   * Get a single post by slug AND increment the view count atomically
   */
  static async getPostBySlug(slug) {
    const post = await prisma.post.findFirst({
      where: { slug: slug, status: 'PUBLISHED' },
      include: {
        author: { select: { id: true, name: true, image: true, role: true } },
        category: { select: { id: true, name: true, slug: true } },
        tags: { select: { id: true, name: true, slug: true } },
        _count: {
          select: { comments: { where: { isApproved: true } }, likes: true },
        },
      },
    });

    if (!post) throw new AppError('Post not found or is not published yet.', 404);

    // Increment view count asynchronously (Fire and forget, keeps response fast)
    prisma.post.update({
      where: { id: post.id },
      data: { viewCount: { increment: 1 } },
    }).catch(err => console.error('Failed to increment view count:', err));

    return post;
  }

  // ==========================================
  // 2. AUTHOR OPERATIONS (Self-Service)
  // ==========================================

  /**
   * Create a new draft or published post
   */
  static async createPost(authorId, data) {
    const { title, content, excerpt, coverImage, status, publishedAt, categoryId, tags, metaTitle, metaDescription, canonicalUrl } = data;

    let slug = generateSlug(title);
    const existing = await prisma.post.findUnique({ where: { slug } });
    if (existing) slug = `${slug}-${Math.floor(Math.random() * 10000)}`;

    const readTime = calculateReadTime(content);

    // Map tag IDs for Prisma relational connection
    const tagConnections = tags ? tags.map(tagId => ({ id: tagId })) : [];

    let finalCoverImage = coverImage;
    if (coverImage && coverImage.startsWith('data:image/')) {
      finalCoverImage = await uploadBase64ToR2(coverImage);
    }

    const post = await prisma.post.create({
      data: {
        title,
        slug,
        content,
        excerpt,
        coverImage: finalCoverImage, // This is the public URL generated from Cloudflare R2
        status,
        publishedAt: publishedAt ? new Date(publishedAt) : null,
        readTime,
        metaTitle,
        metaDescription,
        canonicalUrl,
        author: { connect: { id: authorId } },
        ...(categoryId && { category: { connect: { id: categoryId } } }),
        ...(tags && { tags: { connect: tagConnections } }),
      },
    });

    return post;
  }

  /**
   * Get all posts written by the logged-in author
   */
  static async getMyPosts(authorId, queryString) {
    const baseWhere = { authorId };
    if (queryString.status) baseWhere.status = queryString.status;

    const features = new ApiFeatures(baseWhere, queryString)
      .filter()
      .search(['title'])
      .sort()
      .limitFields()
      .paginate();

    if (!features.prismaQueryObj.select) {
      features.prismaQueryObj.select = {
        id: true,
        title: true,
        slug: true,
        status: true,
        publishedAt: true,
        viewCount: true,
        likeCount: true,
        createdAt: true,
        updatedAt: true,
      };
    }

    const [posts, totalCount] = await prisma.$transaction([
      prisma.post.findMany(features.query()),
      prisma.post.count({ where: features.query().where }),
    ]);

    return {
      posts,
      pagination: {
        total: totalCount,
        page: features.paginationMeta.page,
        limit: features.paginationMeta.limit,
        totalPages: Math.ceil(totalCount / features.paginationMeta.limit)
      },
    };
  }

  /**
   * Update the author's own post (Handles Cloudflare Image Cleanup & Tags)
   */
  static async updateMyPost(authorId, postId, updateData) {
    const existingPost = await prisma.post.findUnique({
      where: { id: postId },
      select: { authorId: true, slug: true, content: true, coverImage: true },
    });

    if (!existingPost) throw new AppError('Post not found.', 404);
    if (existingPost.authorId !== authorId) throw new AppError('You do not have permission to edit this post.', 403);

    let newSlug = existingPost.slug;
    let newReadTime = existingPost.readTime;

    if (updateData.title) {
      newSlug = generateSlug(updateData.title);
      const collision = await prisma.post.findFirst({ where: { slug: newSlug, id: { not: postId } } });
      if (collision) newSlug = `${newSlug}-${Math.floor(Math.random() * 10000)}`;
    }

    if (updateData.content) {
      newReadTime = calculateReadTime(updateData.content);
    }

    // 🔥 CLOUDFLARE R2 CLEANUP LOGIC:
    let finalCoverImage = existingPost.coverImage;

    if (updateData.coverImage !== undefined && updateData.coverImage !== existingPost.coverImage) {
      finalCoverImage = await replaceImageInR2(existingPost.coverImage, updateData.coverImage);
    }

    const tagConnections = updateData.tags ? updateData.tags.map(id => ({ id })) : undefined;

    const updatedPost = await prisma.post.update({
      where: { id: postId },
      data: {
        ...updateData,
        ...(updateData.publishedAt !== undefined && { publishedAt: updateData.publishedAt ? new Date(updateData.publishedAt) : null }),
        coverImage: finalCoverImage !== undefined ? finalCoverImage : existingPost.coverImage,
        slug: newSlug,
        readTime: newReadTime,
        ...(updateData.categoryId !== undefined && { 
          category: updateData.categoryId === null ? { disconnect: true } : { connect: { id: updateData.categoryId } } 
        }),
        ...(updateData.tags && { tags: { set: tagConnections } }),
      },
      include: { category: true, tags: true },
    });

    return updatedPost;
  }

  /**
   * Delete own post & Purge Image from Cloudflare
   */
  static async deleteMyPost(authorId, postId) {
    const existingPost = await prisma.post.findUnique({ 
      where: { id: postId },
      select: { authorId: true, coverImage: true }
    });

    if (!existingPost) throw new AppError('Post not found.', 404);
    if (existingPost.authorId !== authorId) throw new AppError('You do not have permission to delete this post.', 403);

    if (existingPost.coverImage) {
      deleteFromR2(existingPost.coverImage).catch(err => console.error("Failed to delete old R2 image:", err));
    }

    await prisma.post.delete({ where: { id: postId } });
    return { message: 'Post successfully deleted.' };
  }

  // ==========================================
  // 3. ADMIN OPERATIONS (Total Control)
  // ==========================================

  /**
   * Admin dashboard query: See all posts regardless of status
   */
  static async getAllPostsAdmin(queryString) {
    const baseWhere = {};
    if (queryString.status) baseWhere.status = queryString.status;
    if (queryString.authorId) baseWhere.authorId = queryString.authorId;

    const features = new ApiFeatures(baseWhere, queryString)
      .filter()
      .search(['title'])
      .sort()
      .limitFields()
      .paginate();

    if (!features.prismaQueryObj.include && !features.prismaQueryObj.select) {
      features.prismaQueryObj.include = {
        author: { select: { name: true, email: true } },
        category: { select: { name: true } },
      };
    }

    const [posts, totalCount] = await prisma.$transaction([
      prisma.post.findMany(features.query()),
      prisma.post.count({ where: features.query().where }),
    ]);

    return {
      posts,
      pagination: {
        total: totalCount,
        page: features.paginationMeta.page,
        limit: features.paginationMeta.limit,
        totalPages: Math.ceil(totalCount / features.paginationMeta.limit),
      },
    };
  }

  /**
   * Admin Analytics: Engagement Metrics
   */
  static async getAdminStats() {
    const totalMetrics = await prisma.post.aggregate({
      _sum: { viewCount: true, likeCount: true },
      _count: { id: true },
    });

    const statusCounts = await prisma.post.groupBy({
      by: ['status'],
      _count: { _all: true },
    });

    return { totalMetrics, statusCounts };
  }

  /**
   * Bulk Admin Updates
   */
  static async bulkAdminUpdatePostStatus(postIds, newStatus) {
    const result = await prisma.post.updateMany({
      where: { id: { in: postIds } },
      data: { status: newStatus },
    });
    return { updatedCount: result.count };
  }

  static async adminUpdatePostStatus(postId, newStatus) {
    const post = await prisma.post.update({
      where: { id: postId },
      data: { status: newStatus },
    });
    return post;
  }

  static async adminDeletePost(postId) {
    const existingPost = await prisma.post.findUnique({ 
      where: { id: postId },
      select: { coverImage: true } 
    });
    
    if (existingPost?.coverImage) {
      deleteFromR2(existingPost.coverImage).catch(err => console.error("Failed to delete old R2 image:", err));
    }

    await prisma.post.delete({ where: { id: postId } });
    return { message: 'Post deleted by Administrator.' };
  }

  // ==========================================
  // 4. ENGAGEMENT OPERATIONS
  // ==========================================

  /**
   * Increment Share Count
   */
  static async incrementShareCount(postId) {
    // Only allow sharing if the post is published and visible
    const post = await prisma.post.findFirst({ 
      where: { 
        id: postId, 
        status: 'PUBLISHED',
        OR: [
          { publishedAt: null },
          { publishedAt: { lte: new Date() } }
        ]
      } 
    });
    if (!post) throw new AppError('Post not found or unavailable.', 404);

    // Fire and forget increment to keep endpoint extremely fast
    prisma.post.update({
      where: { id: postId },
      data: { shareCount: { increment: 1 } },
    }).catch(err => console.error('Failed to increment share count:', err));

    return { message: 'Share count incremented.' };
  }
}

export default PostService;
