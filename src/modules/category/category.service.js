import prisma from '../../config/db.js';
import AppError from '../../utils/AppError.js';

/**
 * Helper utility to convert a string into an SEO-friendly slug
 * Example: "React JS Updates 2026!" -> "react-js-updates-2026"
 */
const generateSlug = (text) => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-') // Replace spaces with -
    .replace(/[^\w\-]+/g, '') // Remove all non-word characters
    .replace(/\-\-+/g, '-') // Replace multiple - with single -
    .replace(/^-+/, '') // Trim - from start of text
    .replace(/-+$/, ''); // Trim - from end of text
};

class CategoryService {
  // ==========================================
  // 1. CATEGORY OPERATIONS
  // ==========================================

  static async createCategory({ name, slug, description }) {
    // If no slug is provided, auto-generate it from the name
    const finalSlug = slug ? slug.toLowerCase() : generateSlug(name);

    // Collision Check: Prevent duplicate categories or slugs
    const existingCategory = await prisma.category.findFirst({
      where: {
        OR: [{ name }, { slug: finalSlug }],
      },
    });

    if (existingCategory) {
      throw new AppError('A category with this name or slug already exists.', 409);
    }

    const category = await prisma.category.create({
      data: {
        name,
        slug: finalSlug,
        description,
      },
    });

    return category;
  }

  static async getAllCategories() {
    // Pro-level fetch: We also return how many PUBLISHED posts belong to each category
    const categories = await prisma.category.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        _count: {
          select: {
            posts: { where: { status: 'PUBLISHED' } }, // Only count live posts
          },
        },
      },
    });

    return categories;
  }

  static async getCategoryBySlug(slug) {
    const category = await prisma.category.findUnique({
      where: { slug: slug.toLowerCase() },
      include: {
        // Fetch the 10 most recent published posts for this category's landing page
        posts: {
          where: { status: 'PUBLISHED' },
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            title: true,
            slug: true,
            excerpt: true,
            coverImage: true,
            createdAt: true,
            author: { select: { name: true, image: true } },
          },
        },
      },
    });

    if (!category) throw new AppError('Category not found.', 404);
    return category;
  }

  static async updateCategory(id, { name, slug, description }) {
    const categoryToUpdate = await prisma.category.findUnique({ where: { id } });
    if (!categoryToUpdate) throw new AppError('Category not found.', 404);

    let finalSlug = categoryToUpdate.slug;

    // If they update the name OR the slug, we must check for collisions again
    if (name || slug) {
      finalSlug = slug ? slug.toLowerCase() : name ? generateSlug(name) : finalSlug;

      const collision = await prisma.category.findFirst({
        where: {
          id: { not: id }, // Exclude the current category from the check
          OR: [
            ...(name ? [{ name }] : []),
            { slug: finalSlug },
          ],
        },
      });

      if (collision) throw new AppError('Another category already uses this name or slug.', 409);
    }

    const updatedCategory = await prisma.category.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(finalSlug && { slug: finalSlug }),
        ...(description !== undefined && { description }),
      },
    });

    return updatedCategory;
  }

  static async deleteCategory(id) {
    const category = await prisma.category.findUnique({ where: { id } });
    if (!category) throw new AppError('Category not found.', 404);

    // Because of 'onDelete: SetNull' in our schema, deleting this category 
    // won't delete the posts. It will just set the posts' categoryId to NULL.
    await prisma.category.delete({ where: { id } });

    return { message: 'Category deleted successfully. Associated posts are now uncategorized.' };
  }

  // ==========================================
  // 2. TAG OPERATIONS
  // ==========================================

  static async createTag({ name, slug }) {
    const finalSlug = slug ? slug.toLowerCase() : generateSlug(name);

    const existingTag = await prisma.tag.findFirst({
      where: {
        OR: [{ name }, { slug: finalSlug }],
      },
    });

    if (existingTag) throw new AppError('A tag with this name or slug already exists.', 409);

    const tag = await prisma.tag.create({
      data: { name, slug: finalSlug },
    });

    return tag;
  }

  static async getAllTags() {
    const tags = await prisma.tag.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        _count: {
          select: {
            posts: { where: { status: 'PUBLISHED' } },
          },
        },
      },
    });

    return tags;
  }

  static async updateTag(id, { name, slug }) {
    const tagToUpdate = await prisma.tag.findUnique({ where: { id } });
    if (!tagToUpdate) throw new AppError('Tag not found.', 404);

    let finalSlug = tagToUpdate.slug;

    if (name || slug) {
      finalSlug = slug ? slug.toLowerCase() : name ? generateSlug(name) : finalSlug;

      const collision = await prisma.tag.findFirst({
        where: {
          id: { not: id },
          OR: [
            ...(name ? [{ name }] : []),
            { slug: finalSlug },
          ],
        },
      });

      if (collision) throw new AppError('Another tag already uses this name or slug.', 409);
    }

    const updatedTag = await prisma.tag.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(finalSlug && { slug: finalSlug }),
      },
    });

    return updatedTag;
  }

  static async deleteTag(id) {
    const tag = await prisma.tag.findUnique({ where: { id } });
    if (!tag) throw new AppError('Tag not found.', 404);

    // Prisma's implicit many-to-many handles the join table cleanup automatically
    await prisma.tag.delete({ where: { id } });

    return { message: 'Tag deleted successfully and removed from all associated posts.' };
  }
}

export default CategoryService;