import bcrypt from 'bcrypt';
import prisma from '../../config/db.js';
import AppError from '../../utils/AppError.js';
import { replaceImageInR2, deleteFromR2 } from '../../utils/r2.storage.js';
import ApiFeatures from '../../utils/ApiFeatures.js';

class UserService {
  // ==========================================
  // 1. SELF-SERVICE (Logged-in User Actions)
  // ==========================================

  /**
   * Get the current logged-in user's profile and engagement stats
   */
  static async getMe(userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        phoneNumber: true,
        role: true,
        isBanned: true,
        createdAt: true,
        _count: {
          select: {
            posts: true,
            comments: true,
            likes: true,
            bookmarks: true,
          },
        },
      },
    });

    if (!user) throw new AppError('User profile not found.', 404);
    return user;
  }

  /**
   * Get paginated bookmarks for the current user
   */
  static async getMyBookmarks(userId, query) {
    const page = parseInt(query.page, 10) || 1;
    const limit = parseInt(query.limit, 10) || 10;
    const skip = (page - 1) * limit;

    const [bookmarks, total] = await Promise.all([
      prisma.bookmark.findMany({
        where: { userId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          post: {
            select: {
              id: true,
              title: true,
              slug: true,
              excerpt: true,
              coverImage: true,
              createdAt: true,
              author: {
                select: { name: true, image: true }
              }
            }
          }
        }
      }),
      prisma.bookmark.count({ where: { userId } })
    ]);

    // Format the response to just return the post directly in the array for ease of use
    const formattedBookmarks = bookmarks.map(b => ({
      ...b.post,
      bookmarkId: b.id,
      bookmarkedAt: b.createdAt
    }));

    return {
      bookmarks: formattedBookmarks,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      }
    };
  }

  /**
   * Update personal profile details
   */
  static async updateMyProfile(userId, updateData) {
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { image: true },
    });

    let finalImage = updateData.image;

    // 🔥 CLOUDFLARE R2 CLEANUP & UPLOAD LOGIC
    if (updateData.image !== undefined && updateData.image !== existingUser.image) {
      finalImage = await replaceImageInR2(existingUser.image, updateData.image);
    }

    // Only allow updating specific fields to prevent mass assignment
    const sanitizedData = {
      ...(updateData.name && { name: updateData.name }),
      ...(updateData.phoneNumber !== undefined && { phoneNumber: updateData.phoneNumber }),
      ...(finalImage !== undefined && { image: finalImage }),
    };

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: sanitizedData,
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        phoneNumber: true,
        role: true,
      },
    });

    return updatedUser;
  }

  /**
   * Securely change the user's password and terminate other sessions
   */
  static async changePassword(userId, currentPassword, newPassword) {
    const userAccount = await prisma.account.findFirst({
      where: { userId: userId, providerId: 'credentials' },
    });

    if (!userAccount || !userAccount.password) {
      throw new AppError('Password change is only available for email/password accounts.', 400);
    }

    const isMatch = await bcrypt.compare(currentPassword, userAccount.password);
    if (!isMatch) throw new AppError('Incorrect current password.', 401);

    const hashedNewPassword = await bcrypt.hash(newPassword, 12);

    // Update password AND kill all active sessions to force re-login on other devices
    await prisma.$transaction([
      prisma.account.update({
        where: { id: userAccount.id },
        data: { password: hashedNewPassword },
      }),
      prisma.session.deleteMany({
        where: { userId: userId },
      }),
    ]);

    return { message: 'Password updated successfully. You have been logged out of all other devices.' };
  }

  /**
   * Delete own account (GDPR Compliance)
   */
  static async deleteMyAccount(userId) {
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { image: true },
    });

    if (existingUser?.image) {
      deleteFromR2(existingUser.image).catch(err => console.error("Failed to delete old R2 profile image:", err));
    }

    // Prisma's `onDelete: Cascade` handles deleting sessions, accounts, posts, etc.
    await prisma.user.delete({
      where: { id: userId },
    });
    return { message: 'Your account and all associated data have been permanently deleted.' };
  }


  // ==========================================
  // 2. PUBLIC PROFILES (For Authors/Writers)
  // ==========================================

  /**
   * Get a user's public profile (e.g., clicking on an Author's name on a blog)
   */
  static async getPublicProfile(targetUserId) {
    const user = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        name: true,
        image: true,
        role: true,
        createdAt: true,
        // Only fetch posts that are actually PUBLISHED
        posts: {
          where: { status: 'PUBLISHED' },
          orderBy: { createdAt: 'desc' },
          take: 5, // Just get the 5 most recent for the profile preview
          select: {
            id: true,
            title: true,
            slug: true,
            excerpt: true,
            createdAt: true,
          }
        },
        _count: {
          select: {
            posts: { where: { status: 'PUBLISHED' } },
          }
        }
      },
    });

    if (!user || user.isBanned) throw new AppError('User not found or is no longer active.', 404);
    
    return user;
  }


  /**
   * Author Analytics: Get aggregate stats for the current user's posts
   */
  static async getAuthorAnalytics(authorId) {
    const metrics = await prisma.post.aggregate({
      where: { authorId: authorId, status: 'PUBLISHED' },
      _sum: { viewCount: true, likeCount: true, shareCount: true },
      _count: { id: true },
    });
    
    // Total comments received on their posts
    const commentsCount = await prisma.comment.count({
      where: { post: { authorId: authorId } }
    });

    return {
      totalPublishedPosts: metrics._count.id,
      totalViews: metrics._sum.viewCount || 0,
      totalLikes: metrics._sum.likeCount || 0,
      totalShares: metrics._sum.shareCount || 0,
      totalCommentsReceived: commentsCount
    };
  }

  // ==========================================
  // 3. ADMIN OPERATIONS (Strictly Protected)
  // ==========================================

  /**
   * Get all users using Advanced ApiFeatures
   */
  static async getAllUsers(queryString) {
    // We use the new enterprise ApiFeatures engine!
    const features = new ApiFeatures({}, queryString)
      .filter()
      .search(['name', 'email'])
      .sort()
      .limitFields()
      .paginate();

    // Default select if none specified in fields
    if (!features.prismaQueryObj.select) {
      features.prismaQueryObj.select = {
        id: true,
        name: true,
        email: true,
        role: true,
        isBanned: true,
        createdAt: true,
        _count: { select: { posts: true } }
      };
    }

    const [users, totalCount] = await prisma.$transaction([
      prisma.user.findMany(features.query()),
      prisma.user.count({ where: features.query().where }),
    ]);

    return {
      users,
      pagination: {
        total: totalCount,
        page: features.paginationMeta.page,
        limit: features.paginationMeta.limit,
        totalPages: Math.ceil(totalCount / features.paginationMeta.limit),
      },
    };
  }

  /**
   * Admin Analytics: Get User Aggregations
   */
  static async getAdminStats() {
    const userRoleCounts = await prisma.user.groupBy({
      by: ['role'],
      _count: { _all: true },
    });

    // Calculate users joined in the last 30 days
    const thirtyDaysAgo = new Date(new Date() - 30 * 24 * 60 * 60 * 1000);
    const recentSignups = await prisma.user.count({
      where: {
        createdAt: {
          gte: thirtyDaysAgo
        }
      }
    });

    return { userRoleCounts, recentSignups };
  }

  /**
   * Promote or Demote a User (e.g., USER -> WRITER -> AUTHOR)
   */
  static async updateUserRole(targetUserId, newRole) {
    if (!['USER', 'WRITER', 'AUTHOR', 'ADMIN'].includes(newRole)) {
      throw new AppError('Invalid role specified.', 400);
    }

    const updatedUser = await prisma.user.update({
      where: { id: targetUserId },
      data: { role: newRole },
      select: { id: true, name: true, email: true, role: true },
    });

    // Security: If demoting from ADMIN/AUTHOR, kill their sessions so they lose access immediately
    if (newRole === 'USER' || newRole === 'WRITER') {
      await prisma.session.deleteMany({ where: { userId: targetUserId } });
    }

    return updatedUser;
  }

  /**
   * Ban or Unban a User
   */
  static async toggleUserBan(targetUserId, isBanned) {
    const updatedUser = await prisma.user.update({
      where: { id: targetUserId },
      data: { isBanned },
      select: { id: true, name: true, email: true, isBanned: true },
    });

    // If banning the user, instantly kill all their active login sessions
    if (isBanned) {
      await prisma.session.deleteMany({ where: { userId: targetUserId } });
    }

    return {
      message: isBanned ? `User ${updatedUser.email} has been banned.` : `User ${updatedUser.email} has been unbanned.`,
      user: updatedUser,
    };
  }

  /**
   * Force Delete a User (Admin Action)
   */
  static async adminDeleteUser(targetUserId) {
    const existingUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { image: true },
    });

    if (existingUser?.image) {
      deleteFromR2(existingUser.image).catch(err => console.error("Failed to delete old R2 profile image:", err));
    }

    await prisma.user.delete({
      where: { id: targetUserId },
    });

    return { message: 'User and all associated data have been permanently deleted.' };
  }
}

export default UserService;