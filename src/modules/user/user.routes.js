import { Router } from 'express';
import UserController from './user.controller.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { protect, restrictTo } from '../../middlewares/auth.middleware.js';
import {
  updateProfileSchema,
  changePasswordSchema,
  getUserSchema,
  updateRoleSchema,
  banUserSchema,
} from './user.validation.js';

const router = Router();

// ==========================================
// PUBLIC ROUTES
// ==========================================
// Anyone can view a writer's public profile (e.g., clicking their name on a blog)
router.get(
  '/:id/public',
  validate(getUserSchema),
  UserController.getPublicProfile
);

// ==========================================
// PROTECTED ROUTES (Requires Login)
// ==========================================
// Apply the `protect` middleware to ALL routes below this line
router.use(protect);

// ------------------------------------------
// SELF-SERVICE ACTIONS
// ------------------------------------------
router.get('/me', UserController.getMe);
router.get('/me/bookmarks', UserController.getMyBookmarks);
router.get('/me/analytics', UserController.getMyAnalytics);

router.patch(
  '/me',
  validate(updateProfileSchema),
  UserController.updateMyProfile
);

router.patch(
  '/me/password',
  validate(changePasswordSchema),
  UserController.changePassword
);

router.delete('/me', UserController.deleteMyAccount);

// ==========================================
// ADMIN OPERATIONS (Strict Authorization)
// ==========================================
// Apply the `restrictTo` middleware to ALL routes below this line
router.use(restrictTo('ADMIN'));

router.get('/admin/stats', UserController.getAdminStats);

router.get('/', UserController.getAllUsers);

router.patch(
  '/:id/role',
  validate(updateRoleSchema),
  UserController.updateUserRole
);

router.patch(
  '/:id/ban',
  validate(banUserSchema),
  UserController.toggleUserBan
);

router.delete(
  '/:id',
  validate(getUserSchema),
  UserController.adminDeleteUser
);

export default router;