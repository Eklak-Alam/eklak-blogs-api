import prisma from '../../config/db.js';
import AppError from '../../utils/AppError.js';

class InteractionService {
  // ==========================================
  // 1. TOGGLE LIKES (Atomic Transaction Pattern)
  // ==========================================

  static async toggleLike(userId, postId) {
    // 1. Verify the post exists and is published
    const post = await prisma.post.findUnique({ 
      where: { id: postId, status: 'PUBLISHED' } 
    });
    
    if (!post) throw new AppError('Post not found or unavailable.', 404);

    // 2. Check if the user already liked it using the Compound Unique Key
    const existingLike = await prisma.like.findUnique({
      where: { userId_postId: { userId, postId } },
    });

    if (existingLike) {
      // 3A. UNLIKE: Delete the like and decrement the counter atomically
      await prisma.$transaction([
        prisma.like.delete({ where: { id: existingLike.id } }),
        prisma.post.update({
          where: { id: postId },
          data: { likeCount: { decrement: 1 } },
        }),
      ]);
      return { message: 'Post unliked.', isLiked: false };
    } else {
      // 3B. LIKE: Create the like and increment the counter atomically
      await prisma.$transaction([
        prisma.like.create({ data: { userId, postId } }),
        prisma.post.update({
          where: { id: postId },
          data: { likeCount: { increment: 1 } },
        }),
      ]);
      return { message: 'Post liked.', isLiked: true };
    }
  }

  // ==========================================
  // 2. TOGGLE BOOKMARKS
  // ==========================================

  static async toggleBookmark(userId, postId) {
    const post = await prisma.post.findUnique({ 
      where: { id: postId, status: 'PUBLISHED' } 
    });
    
    if (!post) throw new AppError('Post not found or unavailable.', 404);

    const existingBookmark = await prisma.bookmark.findUnique({
      where: { userId_postId: { userId, postId } },
    });

    if (existingBookmark) {
      await prisma.bookmark.delete({ where: { id: existingBookmark.id } });
      return { message: 'Removed from bookmarks.', isBookmarked: false };
    } else {
      await prisma.bookmark.create({ data: { userId, postId } });
      return { message: 'Saved to bookmarks.', isBookmarked: true };
    }
  }

  // ==========================================
  // 3. COMMENT SYSTEM (Threaded Discussions)
  // ==========================================

  /**
   * Add a top-level comment or a reply
   */
  static async addComment(userId, postId, { content, parentId }) {
    const post = await prisma.post.findUnique({ 
      where: { id: postId, status: 'PUBLISHED' } 
    });
    
    if (!post) throw new AppError('Post not found.', 404);

    // If it's a reply, verify the parent comment actually exists
    if (parentId) {
      const parentComment = await prisma.comment.findUnique({ where: { id: parentId } });
      if (!parentComment) throw new AppError('The comment you are replying to does not exist.', 404);
    }

    const comment = await prisma.comment.create({
      data: {
        content,
        userId,
        postId,
        parentId: parentId || null,
        isApproved: true, // Default to true. Change to false if you want manual Admin moderation.
      },
      include: {
        user: { select: { id: true, name: true, image: true } }, // Return user data so frontend can update UI instantly
      },
    });

    return comment;
  }

  /**
   * Fetch paginated comments along with their nested replies
   */
  static async getCommentsByPost(postId, { page = 1, limit = 10 }) {
    const skip = (page - 1) * limit;

    // Only fetch TOP-LEVEL comments here (parentId: null)
    const whereClause = { postId, parentId: null, isApproved: true };

    const [comments, totalCount] = await prisma.$transaction([
      prisma.comment.findMany({
        where: whereClause,
        skip,
        take: Number(limit),
        orderBy: { createdAt: 'desc' }, // Newest top-level comments first
        include: {
          user: { select: { id: true, name: true, image: true } },
          // Magic: Fetch the replies nested inside the parent comment!
          replies: {
            where: { isApproved: true },
            orderBy: { createdAt: 'asc' }, // Replies read top-to-bottom chronologically
            include: {
              user: { select: { id: true, name: true, image: true } },
            },
          },
        },
      }),
      prisma.comment.count({ where: whereClause }),
    ]);

    return {
      comments,
      pagination: {
        total: totalCount,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(totalCount / limit),
      },
    };
  }

  /**
   * Update own comment
   */
  static async updateComment(userId, commentId, content) {
    const comment = await prisma.comment.findUnique({ where: { id: commentId } });
    
    if (!comment) throw new AppError('Comment not found.', 404);
    if (comment.userId !== userId) throw new AppError('You can only edit your own comments.', 403);

    const updatedComment = await prisma.comment.update({
      where: { id: commentId },
      data: { content },
    });

    return updatedComment;
  }

  /**
   * Delete a comment (Author or Admin)
   */
  static async deleteComment(userId, userRole, commentId) {
    const comment = await prisma.comment.findUnique({ where: { id: commentId } });
    
    if (!comment) throw new AppError('Comment not found.', 404);
    
    // Security: Only the creator OR an Admin can delete it
    if (comment.userId !== userId && userRole !== 'ADMIN') {
      throw new AppError('You do not have permission to delete this comment.', 403);
    }

    // Because your schema has `onDelete: Cascade` for the parentId relation, 
    // deleting a top-level comment automatically deletes all its replies.
    await prisma.comment.delete({ where: { id: commentId } });

    return { message: 'Comment deleted successfully.' };
  }

  // ==========================================
  // 4. ADMIN MODERATION
  // ==========================================

  /**
   * Admin can hide/approve comments
   */
  static async moderateComment(commentId, isApproved) {
    const comment = await prisma.comment.update({
      where: { id: commentId },
      data: { isApproved },
    });

    return { 
      message: isApproved ? 'Comment approved and is now visible.' : 'Comment hidden from public view.',
      comment 
    };
  }
}

export default InteractionService;