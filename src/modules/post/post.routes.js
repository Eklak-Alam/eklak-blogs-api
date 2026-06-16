import { Router } from 'express';
import PostController from './post.controller.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { protect, restrictTo } from '../../middlewares/auth.middleware.js';
import {
  createPostSchema,
  updatePostSchema,
  getAllPostsSchema,
  getPostBySlugSchema,
  deletePostSchema
} from './post.validation.js';

const router = Router();

// ==========================================
// 1. 🛡️ ADMIN ROUTES (Strict Control)
// ==========================================
// BEST PRACTICE: Put static specific routes like `/admin/...` at the very top 
// to prevent generic parameters like `/:id` or `/:slug` from accidentally hijacking them.

router.get(
  '/admin/all', 
  protect,
  restrictTo('ADMIN'), 
  validate(getAllPostsSchema), 
  PostController.getAllPostsAdmin
);

router.get(
  '/admin/stats',
  protect,
  restrictTo('ADMIN'),
  PostController.getAdminStats
);

router.patch(
  '/admin/bulk-status',
  protect,
  restrictTo('ADMIN'),
  PostController.bulkAdminUpdatePostStatus
);

router.patch(
  '/admin/:id/status', 
  protect,
  restrictTo('ADMIN'), 
  validate(updatePostSchema), 
  PostController.adminUpdatePostStatus
);

router.delete(
  '/admin/:id/force', 
  protect,
  restrictTo('ADMIN'), 
  validate(deletePostSchema), 
  PostController.adminDeletePost
);

// ==========================================
// 2. ✍️ AUTHOR ROUTES (Writers, Authors, Admins)
// ==========================================
// We use inline `protect` here instead of `router.use(protect)` so we don't accidentally
// lock out public users from the reading endpoints below.

router.get(
  '/me', 
  protect,
  restrictTo('WRITER', 'AUTHOR', 'ADMIN'), 
  validate(getAllPostsSchema), 
  PostController.getMyPosts
);

router.post(
  '/', 
  protect,
  restrictTo('WRITER', 'AUTHOR', 'ADMIN'), 
  validate(createPostSchema), 
  PostController.createPost
);

router.patch(
  '/:id', 
  protect,
  restrictTo('WRITER', 'AUTHOR', 'ADMIN'), 
  validate(updatePostSchema), 
  PostController.updateMyPost
);

router.delete(
  '/:id', 
  protect,
  restrictTo('WRITER', 'AUTHOR', 'ADMIN'), 
  validate(deletePostSchema), 
  PostController.deleteMyPost
);

// ==========================================
// 3. 🌐 PUBLIC ROUTES (Anyone can read)
// ==========================================
// BEST PRACTICE: Put highly dynamic wildcards like `/:slug` at the absolute bottom.
// If it was at the top, navigating to `/posts/me` would trigger `getPostBySlug("me")`.

router.get(
  '/', 
  validate(getAllPostsSchema), 
  PostController.getPublishedPosts
);

router.get(
  '/:slug', 
  validate(getPostBySlugSchema), 
  PostController.getPostBySlug
);

router.post(
  '/:id/share',
  PostController.incrementShareCount
);

export default router;