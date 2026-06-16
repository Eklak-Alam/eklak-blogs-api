import UserService from './user.service.js';
import catchAsync from '../../utils/catchAsync.js';

class UserController {
  // ==========================================
  // 1. SELF-SERVICE (Logged-in User Actions)
  // ==========================================

  static getMe = catchAsync(async (req, res) => {
    // req.user.id comes securely from the JWT token via the protect middleware
    const user = await UserService.getMe(req.user.id);

    res.status(200).json({
      success: true,
      status: 'success',
      data: { user },
    });
  });

  static getMyBookmarks = catchAsync(async (req, res) => {
    const result = await UserService.getMyBookmarks(req.user.id, req.query);

    res.status(200).json({
      success: true,
      status: 'success',
      data: result,
    });
  });

  static updateMyProfile = catchAsync(async (req, res) => {
    const updatedUser = await UserService.updateMyProfile(req.user.id, req.body);

    res.status(200).json({
      success: true,
      status: 'success',
      message: 'Profile updated successfully.',
      data: { user: updatedUser },
    });
  });

  static changePassword = catchAsync(async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const result = await UserService.changePassword(req.user.id, currentPassword, newPassword);

    res.status(200).json({
      success: true,
      status: 'success',
      message: result.message,
    });
  });

  static deleteMyAccount = catchAsync(async (req, res) => {
    const result = await UserService.deleteMyAccount(req.user.id);

    res.status(200).json({
      success: true,
      status: 'success',
      message: result.message,
    });
  });

  static getMyAnalytics = catchAsync(async (req, res) => {
    const analytics = await UserService.getAuthorAnalytics(req.user.id);
    
    res.status(200).json({
      success: true,
      status: 'success',
      data: analytics,
    });
  });

  // ==========================================
  // 2. PUBLIC PROFILES
  // ==========================================

  static getPublicProfile = catchAsync(async (req, res) => {
    const { id } = req.params;
    const user = await UserService.getPublicProfile(id);

    res.status(200).json({
      success: true,
      status: 'success',
      data: { user },
    });
  });

  // ==========================================
  // 3. ADMIN OPERATIONS
  // ==========================================

  static getAllUsers = catchAsync(async (req, res) => {
    // Pass the full query object to the ApiFeatures engine
    const result = await UserService.getAllUsers(req.query);

    res.status(200).json({
      success: true,
      status: 'success',
      data: result,
    });
  });

  static getAdminStats = catchAsync(async (req, res) => {
    const stats = await UserService.getAdminStats();

    res.status(200).json({
      success: true,
      status: 'success',
      data: stats,
    });
  });

  static updateUserRole = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { role } = req.body;
    const updatedUser = await UserService.updateUserRole(id, role);

    res.status(200).json({
      success: true,
      status: 'success',
      message: `User role successfully updated to ${role}.`,
      data: { user: updatedUser },
    });
  });

  static toggleUserBan = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { isBanned } = req.body;
    const result = await UserService.toggleUserBan(id, isBanned);

    res.status(200).json({
      success: true,
      status: 'success',
      message: result.message,
      data: { user: result.user },
    });
  });

  static adminDeleteUser = catchAsync(async (req, res) => {
    const { id } = req.params;
    const result = await UserService.adminDeleteUser(id);

    res.status(200).json({
      success: true,
      status: 'success',
      message: result.message,
    });
  });
}

export default UserController;