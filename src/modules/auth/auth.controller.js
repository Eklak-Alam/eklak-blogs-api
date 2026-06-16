import AuthService from './auth.service.js';
import catchAsync from '../../utils/catchAsync.js';

/**
 * ==========================================
 * AUTH CONTROLLER
 * ==========================================
 * Orchestrates incoming HTTP requests, extracts network context, 
 * and routes data to the Auth Service.
 */
class AuthController {
  
  // ==========================================
  // ONBOARDING FLOW
  // ==========================================
  
  static register = catchAsync(async (req, res) => {
    const { name, email, password, phoneNumber, deviceId } = req.body;
    
    // Security: Grab network context for the auto-login session
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || 'Unknown IP';
    const userAgent = req.headers['user-agent'] || 'Unknown Device';

    const result = await AuthService.register({ 
      name, 
      email, 
      password, 
      phoneNumber, 
      ipAddress, 
      userAgent, 
      deviceId 
    });

    res.status(201).json({
      success: true,
      status: 'success',
      message: result.message,
      data: { 
        user: result.user,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken
      },
    });
  });

  static verifyEmail = catchAsync(async (req, res) => {
    const { email, otp } = req.body;
    const result = await AuthService.verifyEmail({ email, otp });

    res.status(200).json({
      success: true,
      status: 'success',
      message: result.message,
    });
  });

  static resendVerification = catchAsync(async (req, res) => {
    const { email } = req.body;
    const result = await AuthService.resendVerification({ email });

    res.status(200).json({
      success: true,
      status: 'success',
      message: result.message,
    });
  });

  // ==========================================
  // SESSION MANAGEMENT FLOW
  // ==========================================

  static login = catchAsync(async (req, res) => {
    const { email, password, deviceId } = req.body;
    
    // Security: Grab network context to track WHERE the user logged in from
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || 'Unknown IP';
    const userAgent = req.headers['user-agent'] || 'Unknown Device';

    const result = await AuthService.login({
      email, 
      password, 
      ipAddress, 
      userAgent, 
      deviceId,
    });

    res.status(200).json({
      success: true,
      status: 'success',
      message: 'Login successful.',
      data: result, // Contains user object and both tokens
    });
  });

  static refreshSession = catchAsync(async (req, res) => {
    const { refreshToken, deviceId } = req.body;
    
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || 'Unknown IP';
    const userAgent = req.headers['user-agent'] || 'Unknown Device';

    const result = await AuthService.refreshSession({
      refreshToken, 
      ipAddress, 
      userAgent, 
      deviceId,
    });

    res.status(200).json({
      success: true,
      status: 'success',
      message: 'Session refreshed successfully.',
      data: result, // Contains new Access & Refresh tokens
    });
  });

  static logout = catchAsync(async (req, res) => {
    const { refreshToken } = req.body;
    
    // We don't throw an error if logout fails. We just wipe the session silently to prevent deadlocks.
    await AuthService.logout({ refreshToken });

    res.status(200).json({
      success: true,
      status: 'success',
      message: 'Logged out successfully.',
    });
  });

  // ==========================================
  // ACCOUNT RECOVERY FLOW
  // ==========================================

  static forgotPassword = catchAsync(async (req, res) => {
    const { email } = req.body;
    const result = await AuthService.forgotPassword({ email });

    res.status(200).json({
      success: true,
      status: 'success',
      message: result.message,
    });
  });

  static resetPassword = catchAsync(async (req, res) => {
    const { email, otp, newPassword } = req.body;
    const result = await AuthService.resetPassword({ email, otp, newPassword });

    res.status(200).json({
      success: true,
      status: 'success',
      message: result.message,
    });
  });
}

export default AuthController;