import { Router } from 'express';
import CategoryController from './category.controller.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { protect, restrictTo } from '../../middlewares/auth.middleware.js';
import {
  createCategorySchema,
  updateCategorySchema,
  createTagSchema,
  updateTagSchema,
  getByIdSchema,
  deleteSchema
} from './category.validation.js';

const router = Router();

// ==========================================
// 🌐 PUBLIC ROUTES (Anyone can read)
// ==========================================

// Categories
router.get('/categories', CategoryController.getAllCategories);
// Notice we don't validate the slug with a CUID schema because it's a string like "engineering-updates"
router.get('/categories/:slug', CategoryController.getCategoryBySlug);

// Tags
router.get('/tags', CategoryController.getAllTags);


// ==========================================
// 🛡️ PROTECTED ADMIN ROUTES (Modify data)
// ==========================================
// Apply protection to ALL routes below this line
router.use(protect);

// --- Category Admin Actions ---
router.post(
  '/categories',
  restrictTo('ADMIN', 'AUTHOR', 'WRITER'),
  validate(createCategorySchema),
  CategoryController.createCategory
);

router.patch(
  '/categories/:id',
  restrictTo('ADMIN', 'AUTHOR'),
  validate(updateCategorySchema),
  CategoryController.updateCategory
);

router.delete(
  '/categories/:id',
  restrictTo('ADMIN', 'AUTHOR'),
  validate(deleteSchema),
  CategoryController.deleteCategory
);

// --- Tag Admin Actions ---
router.post(
  '/tags',
  restrictTo('ADMIN', 'AUTHOR', 'WRITER'),
  validate(createTagSchema),
  CategoryController.createTag
);

router.patch(
  '/tags/:id',
  restrictTo('ADMIN', 'AUTHOR'),
  validate(updateTagSchema),
  CategoryController.updateTag
);

router.delete(
  '/tags/:id',
  restrictTo('ADMIN', 'AUTHOR'),
  validate(deleteSchema),
  CategoryController.deleteTag
);

export default router;