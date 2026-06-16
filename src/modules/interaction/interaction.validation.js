import { z } from 'zod';

// ==========================================
// 1. REUSABLE VALIDATORS
// ==========================================

// Standard ID parameter validation
const cuidParam = z.object({
  params: z.object({
    id: z.string({ required_error: 'ID is required in the URL' })
         .min(1, 'Invalid ID format.'),
  }),
});

// Interactions are tied to posts, so we extract postId from the URL
const postIdParam = z.object({
  params: z.object({
    postId: z.string({ required_error: 'Post ID is required' })
           .min(1, 'Invalid Post ID format.'),
  }),
});

// Reusable Pagination for fetching nested comments safely
const paginationQuery = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(50).default(10), // Hard cap at 50 to protect DB memory
  }),
});

// ==========================================
// 2. COMMENT SCHEMAS (Threaded Discussions)
// ==========================================

export const createCommentSchema = z.object({
  params: postIdParam.shape.params,
  body: z.object({
    content: z.string({ required_error: 'Comment content is required' })
      .min(1, 'Comment cannot be empty')
      .max(2000, 'Comment is too long. Keep it under 2000 characters.') // Spam protection
      .trim(),
      
    // For nested replies: If replying, frontend sends the parent comment ID
    parentId: z.string()
      .min(1, 'Invalid Parent Comment ID format')
      .optional()
      .nullable(),
  }).strict('Unrecognized fields are not allowed in the comment body.'),
});

export const updateCommentSchema = z.object({
  params: cuidParam.shape.params,
  body: z.object({
    content: z.string({ required_error: 'Comment content is required' })
      .min(1, 'Comment cannot be empty')
      .max(2000, 'Comment is too long.')
      .trim(),
  }).strict(),
});

// ==========================================
// 3. ADMIN MODERATION SCHEMAS
// ==========================================

export const moderateCommentSchema = z.object({
  params: cuidParam.shape.params,
  body: z.object({
    isApproved: z.boolean({ required_error: 'isApproved boolean flag is required' }),
  }).strict(),
});

// ==========================================
// 4. TOGGLE ACTION SCHEMAS (Likes & Bookmarks)
// ==========================================

// Likes and Bookmarks only need the postId from the URL. 
// The .strict() block drops the request if a bot tries to inject a JSON body.
export const toggleInteractionSchema = z.object({
  params: postIdParam.shape.params,
  body: z.object({}).strict('No body payload is allowed for toggle actions.'),
});

// ==========================================
// 5. SHARED EXPORTS
// ==========================================

export const deleteCommentSchema = cuidParam;

// Combine params and query validation for fetching paginated comments
export const getCommentsSchema = z.object({
  params: postIdParam.shape.params,
  query: paginationQuery.shape.query,
});