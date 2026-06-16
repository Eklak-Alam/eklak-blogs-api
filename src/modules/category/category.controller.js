import CategoryService from './category.service.js';
import catchAsync from '../../utils/catchAsync.js';

class CategoryController {
  // ==========================================
  // 1. CATEGORY OPERATIONS
  // ==========================================

  static createCategory = catchAsync(async (req, res) => {
    const category = await CategoryService.createCategory(req.body);

    res.status(201).json({
      success: true,
      status: 'success',
      message: 'Category created successfully.',
      data: { category },
    });
  });

  static getAllCategories = catchAsync(async (req, res) => {
    const categories = await CategoryService.getAllCategories();

    res.status(200).json({
      success: true,
      status: 'success',
      results: categories.length,
      data: { categories },
    });
  });

  static getCategoryBySlug = catchAsync(async (req, res) => {
    const { slug } = req.params; // We fetch by SLUG for SEO-friendly URLs, not ID
    const category = await CategoryService.getCategoryBySlug(slug);

    res.status(200).json({
      success: true,
      status: 'success',
      data: { category },
    });
  });

  static updateCategory = catchAsync(async (req, res) => {
    const { id } = req.params;
    const updatedCategory = await CategoryService.updateCategory(id, req.body);

    res.status(200).json({
      success: true,
      status: 'success',
      message: 'Category updated successfully.',
      data: { category: updatedCategory },
    });
  });

  static deleteCategory = catchAsync(async (req, res) => {
    const { id } = req.params;
    const result = await CategoryService.deleteCategory(id);

    res.status(200).json({
      success: true,
      status: 'success',
      message: result.message,
    });
  });

  // ==========================================
  // 2. TAG OPERATIONS
  // ==========================================

  static createTag = catchAsync(async (req, res) => {
    const tag = await CategoryService.createTag(req.body);

    res.status(201).json({
      success: true,
      status: 'success',
      message: 'Tag created successfully.',
      data: { tag },
    });
  });

  static getAllTags = catchAsync(async (req, res) => {
    const tags = await CategoryService.getAllTags();

    res.status(200).json({
      success: true,
      status: 'success',
      results: tags.length,
      data: { tags },
    });
  });

  static updateTag = catchAsync(async (req, res) => {
    const { id } = req.params;
    const updatedTag = await CategoryService.updateTag(id, req.body);

    res.status(200).json({
      success: true,
      status: 'success',
      message: 'Tag updated successfully.',
      data: { tag: updatedTag },
    });
  });

  static deleteTag = catchAsync(async (req, res) => {
    const { id } = req.params;
    const result = await CategoryService.deleteTag(id);

    res.status(200).json({
      success: true,
      status: 'success',
      message: result.message,
    });
  });
}

export default CategoryController;