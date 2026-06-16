import { z } from 'zod';

// ==========================================
// 1. REUSABLE VALIDATORS
// ==========================================
const cuidParam = z.object({
  params: z.object({
    id: z.string({ required_error: 'ID is required in the URL parameters' })
         .min(1, 'Invalid ID format.'),
  })
});

// SLUG REGEX: Only allows lowercase letters, numbers, and hyphens. 
// No spaces, no special characters, no trailing hyphens.
// Valid: "engineering-updates", "react-18" | Invalid: "Engineering Updates", "react_18"
const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// ==========================================
// 2. CATEGORY VALIDATION SCHEMAS
// ==========================================

export const createCategorySchema = z.object({
  body: z.object({
    name: z.string({ required_error: 'Category name is required' })
      .min(2, 'Category name must be at least 2 characters')
      .max(50, 'Category name cannot exceed 50 characters')
      .trim(),
      
    // Slug is optional because our Service layer will auto-generate it from the name if the user doesn't provide one
    slug: z.string()
      .regex(slugRegex, 'Slug must contain only lowercase letters, numbers, and hyphens')
      .optional(),
      
    description: z.string()
      .max(500, 'Description cannot exceed 500 characters')
      .trim()
      .optional(),
  }).strict('Unrecognized fields are not allowed.'),
});

export const updateCategorySchema = z.object({
  params: cuidParam.shape.params,
  body: z.object({
    name: z.string()
      .min(2, 'Category name must be at least 2 characters')
      .max(50, 'Category name cannot exceed 50 characters')
      .trim()
      .optional(),
      
    slug: z.string()
      .regex(slugRegex, 'Slug must contain only lowercase letters, numbers, and hyphens')
      .optional(),
      
    description: z.string()
      .max(500, 'Description cannot exceed 500 characters')
      .trim()
      .optional(),
  }).strict().refine((data) => Object.keys(data).length > 0, {
    message: "At least one field (name, slug, or description) must be provided to update.",
  }),
});

// ==========================================
// 3. TAG VALIDATION SCHEMAS
// ==========================================

export const createTagSchema = z.object({
  body: z.object({
    name: z.string({ required_error: 'Tag name is required' })
      .min(2, 'Tag name must be at least 2 characters')
      .max(30, 'Tag name cannot exceed 30 characters') // Tags should be shorter than categories
      .trim(),
      
    slug: z.string()
      .regex(slugRegex, 'Slug must contain only lowercase letters, numbers, and hyphens')
      .optional(),
  }).strict('Unrecognized fields are not allowed.'),
});

export const updateTagSchema = z.object({
  params: cuidParam.shape.params,
  body: z.object({
    name: z.string()
      .min(2, 'Tag name must be at least 2 characters')
      .max(30, 'Tag name cannot exceed 30 characters')
      .trim()
      .optional(),
      
    slug: z.string()
      .regex(slugRegex, 'Slug must contain only lowercase letters, numbers, and hyphens')
      .optional(),
  }).strict().refine((data) => Object.keys(data).length > 0, {
    message: "At least one field (name or slug) must be provided to update.",
  }),
});

// ==========================================
// 4. SHARED EXPORTS
// ==========================================
export const getByIdSchema = cuidParam;
export const deleteSchema = cuidParam;