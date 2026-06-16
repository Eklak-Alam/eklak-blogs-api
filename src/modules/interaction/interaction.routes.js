import { Router } from 'express';
import InteractionController from './interaction.controller.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { protect, restrictTo } from '../../middlewares/auth.middleware.js';
import {
  createCommentSchema,
  updateCommentSchema,
  moderateCommentSchema,
  toggleInteractionSchema,
  deleteCommentSchema,
  getCommentsSchema
} from './interaction.validation.js';

const router = Router();

// ==========================================
// 1. 🌐 PUBLIC ROUTES (Anyone can read)
// ==========================================
// Fetching comments is public so readers can see discussions
router.get(
  '/posts/:postId/comments', 
  validate(getCommentsSchema), 
  InteractionController.getComments
);

// ==========================================
// 2. 🛡️ PROTECTED ROUTES (Must be logged in)
// ==========================================
// Lock down everything below this line
router.use(protect);

// --- Post Interactions ---
router.post(
  '/posts/:postId/like', 
  validate(toggleInteractionSchema), 
  InteractionController.toggleLike
);

router.post(
  '/posts/:postId/bookmark', 
  validate(toggleInteractionSchema), 
  InteractionController.toggleBookmark
);

router.post(
  '/posts/:postId/comments', 
  validate(createCommentSchema), 
  InteractionController.addComment
);

// --- Direct Comment Interactions ---
router.patch(
  '/comments/:id', 
  validate(updateCommentSchema), 
  InteractionController.updateComment
);

router.delete(
  '/comments/:id', 
  validate(deleteCommentSchema), 
  InteractionController.deleteComment
);

// ==========================================
// 3. 🚨 ADMIN MODERATION
// ==========================================
router.patch(
  '/comments/:id/moderate', 
  restrictTo('ADMIN'), 
  validate(moderateCommentSchema), 
  InteractionController.moderateComment
);

export default router;