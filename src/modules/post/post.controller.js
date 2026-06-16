import PostService from './post.service.js';
import catchAsync from '../../utils/catchAsync.js';
import ApiResponse from '../../utils/ApiResponse.js';

class PostController {
  // ==========================================
  // 1. PUBLIC READER OPERATIONS
  // ==========================================

  static getPublishedPosts = catchAsync(async (req, res) => {
    // Pass the full query object to the advanced ApiFeatures engine
    const { posts, pagination } = await PostService.getPublishedPosts(req.query);

    return new ApiResponse(200, posts, 'Published posts retrieved successfully', pagination).send(res);
  });

  static getPostBySlug = catchAsync(async (req, res) => {
    const { slug } = req.params;
    const post = await PostService.getPostBySlug(slug);

    return new ApiResponse(200, post, 'Post retrieved successfully').send(res);
  });

  static incrementShareCount = catchAsync(async (req, res) => {
    const { id } = req.params;
    const result = await PostService.incrementShareCount(id);
    return new ApiResponse(200, null, result.message).send(res);
  });

  // ==========================================
  // 2. AUTHOR OPERATIONS (Self-Service)
  // ==========================================

  static createPost = catchAsync(async (req, res) => {
    const post = await PostService.createPost(req.user.id, req.body);
    return new ApiResponse(201, post, 'Post created successfully.').send(res);
  });

  static getMyPosts = catchAsync(async (req, res) => {
    const { posts, pagination } = await PostService.getMyPosts(req.user.id, req.query);
    return new ApiResponse(200, posts, 'Author posts retrieved successfully', pagination).send(res);
  });

  static updateMyPost = catchAsync(async (req, res) => {
    const { id } = req.params;
    const updatedPost = await PostService.updateMyPost(req.user.id, id, req.body);
    return new ApiResponse(200, updatedPost, 'Post updated successfully.').send(res);
  });

  static deleteMyPost = catchAsync(async (req, res) => {
    const { id } = req.params;
    const result = await PostService.deleteMyPost(req.user.id, id);
    return new ApiResponse(200, null, result.message).send(res);
  });

  // ==========================================
  // 3. ADMIN OPERATIONS (Total Control)
  // ==========================================

  static getAllPostsAdmin = catchAsync(async (req, res) => {
    const { posts, pagination } = await PostService.getAllPostsAdmin(req.query);
    return new ApiResponse(200, posts, 'Admin dashboard posts retrieved successfully', pagination).send(res);
  });

  static getAdminStats = catchAsync(async (req, res) => {
    const stats = await PostService.getAdminStats();
    return new ApiResponse(200, stats, 'Admin post statistics retrieved successfully').send(res);
  });

  static bulkAdminUpdatePostStatus = catchAsync(async (req, res) => {
    const { postIds, status } = req.body;
    const result = await PostService.bulkAdminUpdatePostStatus(postIds, status);
    return new ApiResponse(200, result, `Successfully updated ${result.updatedCount} posts to ${status}.`).send(res);
  });

  static adminUpdatePostStatus = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    const updatedPost = await PostService.adminUpdatePostStatus(id, status);
    return new ApiResponse(200, updatedPost, `Post status forcefully updated to ${status}.`).send(res);
  });

  static adminDeletePost = catchAsync(async (req, res) => {
    const { id } = req.params;
    const result = await PostService.adminDeletePost(id);
    return new ApiResponse(200, null, result.message).send(res);
  });
}

export default PostController;