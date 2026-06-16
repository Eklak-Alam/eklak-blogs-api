import { Router } from 'express';
import AuthController from './auth.controller.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { 
  registerSchema, 
  verifyEmailSchema,
  resendVerificationSchema, 
  loginSchema, 
  refreshTokenSchema, 
  logoutSchema,
  forgotPasswordSchema,
  resetPasswordSchema
} from './auth.validation.js';

const router = Router();

/**
 * ==========================================
 * AUTHENTICATION ROUTER
 * ==========================================
 * This router acts as the first line of defense. 
 * Every single request MUST pass through the Zod `validate` middleware 
 * before it is allowed to touch the Controller logic.
 */

// ------------------------------------------
// 1. REGISTRATION & VERIFICATION FLOW
// ------------------------------------------

router.post(
  '/register', 
  validate(registerSchema), 
  AuthController.register
);

router.post(
  '/verify-email', 
  validate(verifyEmailSchema), 
  AuthController.verifyEmail
);

router.post(
  '/resend-verification', 
  validate(resendVerificationSchema), 
  AuthController.resendVerification
);

// ------------------------------------------
// 2. LOGIN & SESSION FLOW
// ------------------------------------------

router.post(
  '/login', 
  validate(loginSchema), 
  AuthController.login
);

router.post(
  '/refresh', 
  validate(refreshTokenSchema), 
  AuthController.refreshSession
);

router.post(
  '/logout', 
  validate(logoutSchema), 
  AuthController.logout
);

// ------------------------------------------
// 3. PASSWORD RECOVERY FLOW
// ------------------------------------------

router.post(
  '/forgot-password', 
  validate(forgotPasswordSchema), 
  AuthController.forgotPassword
);

router.post(
  '/reset-password', 
  validate(resetPasswordSchema), 
  AuthController.resetPassword
);

export default router;