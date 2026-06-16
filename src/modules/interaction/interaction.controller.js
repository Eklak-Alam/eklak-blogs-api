import InteractionService from './interaction.service.js';
import catchAsync from '../../utils/catchAsync.js';

class InteractionController {
  // ==========================================
  // 1. TOGGLE ACTIONS (Likes & Bookmarks)
  // ==========================================

  static toggleLike = catchAsync(async (req, res) => {
    // req.user.id is 100% secure from the JWT token
    // req.params.postId is 100% secure from Zod
    const result = await InteractionService.toggleLike(req.user.id, req.params.postId);

    res.status(200).json({
      success: true,
      status: 'success',
      message: result.message,
      data: { isLiked: result.isLiked },
    });
  });

  static toggleBookmark = catchAsync(async (req, res) => {
    const result = await InteractionService.toggleBookmark(req.user.id, req.params.postId);

    res.status(200).json({
      success: true,
      status: 'success',
      message: result.message,
      data: { isBookmarked: result.isBookmarked },
    });
  });

  // ==========================================
  // 2. COMMENT OPERATIONS
  // ==========================================

  static getComments = catchAsync(async (req, res) => {
    const { postId } = req.params;
    const result = await InteractionService.getCommentsByPost(postId, req.query);

    res.status(200).json({
      success: true,
      status: 'success',
      results: result.comments.length,
      data: result,
    });
  });

  static addComment = catchAsync(async (req, res) => {
    const { postId } = req.params;
    const comment = await InteractionService.addComment(req.user.id, postId, req.body);

    res.status(201).json({
      success: true,
      status: 'success',
      message: 'Comment posted successfully.',
      data: { comment },
    });
  });

  static updateComment = catchAsync(async (req, res) => {
    const { id } = req.params; // This is the Comment ID
    const { content } = req.body;
    
    const updatedComment = await InteractionService.updateComment(req.user.id, id, content);

    res.status(200).json({
      success: true,
      status: 'success',
      message: 'Comment updated successfully.',
      data: { comment: updatedComment },
    });
  });

  static deleteComment = catchAsync(async (req, res) => {
    const { id } = req.params;
    // We pass both the User ID and their Role so the Service knows if an Admin is trying to delete it
    const result = await InteractionService.deleteComment(req.user.id, req.user.role, id);

    res.status(200).json({
      success: true,
      status: 'success',
      message: result.message,
    });
  });

  // ==========================================
  // 3. ADMIN MODERATION
  // ==========================================

  static moderateComment = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { isApproved } = req.body;
    
    const result = await InteractionService.moderateComment(id, isApproved);

    res.status(200).json({
      success: true,
      status: 'success',
      message: result.message,
      data: { comment: result.comment },
    });
  });
}

export default InteractionController;