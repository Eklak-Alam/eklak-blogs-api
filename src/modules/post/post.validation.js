import { z } from 'zod';

// ==========================================
// 1. REUSABLE VALIDATORS
// ==========================================
const cuidParam = z.object({
  params: z.object({
    id: z.string({ required_error: 'ID is required in the URL parameters' })
         .min(1, 'Invalid ID format. Must be a valid ID.'),
  }),
});

const slugParam = z.object({
  params: z.object({
    slug: z.string({ required_error: 'Slug is required in the URL parameters' })
           .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Invalid slug format. Use lowercase letters, numbers, and hyphens only.'),
  }),
});

// Coerce (force convert) query strings into numbers for pagination engine
const paginationQuery = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  search: z.string().optional(),
});

/**
 * Enterprise Custom Validator: Dual-Mode Image Uploads
 * Accepts standard HTTP/HTTPS URLs OR Base64 Encoded Image Data Streams 
 * required by our Cloudflare R2 utility.
 */
const dualModeImageValidator = z.string()
  .max(7500000, 'Image payload is too large. Maximum size is 5MB.')
  .refine((val) => {
    if (val.startsWith('http://') || val.startsWith('https://')) return true;
    if (/^data:image\/(jpeg|jpg|png|webp|gif|avif|bmp|tiff|svg(\+xml)?);base64,/.test(val)) return true;
    return false;
  }, {
    message: "Image must be a valid public URL or a valid Base64 encoded image string.",
  });

// ==========================================
// 2. CREATE POST SCHEMA
// ==========================================
export const createPostSchema = z.object({
  body: z.object({
    title: z.string({ required_error: 'Title is required' })
      .min(3, 'Title must be at least 3 characters')
      .max(120, 'Title cannot exceed 120 characters')
      .trim(),
      
    content: z.string({ required_error: 'Content is required' })
      .min(10, 'Content must be at least 10 characters long')
      .trim(),
      
    excerpt: z.string()
      .max(300, 'Excerpt cannot exceed 300 characters')
      .trim()
      .optional(),
      
    // Utilizing the new dual-mode Cloudflare compatible validator
    coverImage: dualModeImageValidator.optional(),
      
    // Default to DRAFT. Authorization logic in controller will restrict who can pass 'PUBLISHED'.
    status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).default('DRAFT'),

    // Relationships
    categoryId: z.string().min(1, 'Invalid Category ID format').optional(),
    
    tags: z.array(z.string().min(1, 'Invalid Tag ID format'))
      .max(10, 'You cannot attach more than 10 tags to a single post')
      .optional(),

    // SEO Metadata
    metaTitle: z.string()
      .max(60, 'SEO Title should not exceed 60 characters for optimal Google ranking')
      .trim()
      .optional(),
      
    metaDescription: z.string()
      .max(160, 'SEO Description should not exceed 160 characters')
      .trim()
      .optional(),
      
    canonicalUrl: z.string()
      .url('Canonical URL must be a valid URL')
      .optional(),
      
  }).strict('Unrecognized payload fields are blocked by the firewall.'),
});

// ==========================================
// 3. UPDATE POST SCHEMA
// ==========================================
export const updatePostSchema = z.object({
  params: cuidParam.shape.params,
  body: z.object({
    title: z.string().min(3).max(120).trim().optional(),
    content: z.string().min(10).trim().optional(),
    excerpt: z.string().max(300).trim().optional(),
    
    // Allow null so authors can explicitly delete/remove their cover image
    coverImage: dualModeImageValidator.optional().nullable(),
    
    status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional(),
    
    categoryId: z.string().min(1).optional().nullable(), // Allow null to un-link a category
    tags: z.array(z.string().min(1)).max(10).optional(),
    
    metaTitle: z.string().max(60).trim().optional().nullable(),
    metaDescription: z.string().max(160).trim().optional().nullable(),
    canonicalUrl: z.string().url().optional().nullable(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided to execute an update transaction.",
  }),
});

// ==========================================
// 4. QUERY / FILTER POSTS SCHEMA
// ==========================================
export const getAllPostsSchema = z.object({
  query: paginationQuery.extend({
    status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional(),
    categoryId: z.string().min(1).optional(),
    tagSlug: z.string().optional(),
    authorId: z.string().min(1).optional(),
  }),
});

// ==========================================
// 5. SHARED EXPORTS
// ==========================================
export const getPostBySlugSchema = slugParam;
export const deletePostSchema = cuidParam;