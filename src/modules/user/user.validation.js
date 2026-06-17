import { z } from 'zod';

// ==========================================
// 1. REUSABLE VALIDATORS
// ==========================================
const cuidParam = z.object({
  id: z.string({ required_error: 'User ID is required in the URL parameters' })
       .min(1, 'Invalid User ID format'),
});

/**
 * Enterprise Custom Validator: Dual-Mode Image Uploads
 * Accepts standard HTTP/HTTPS URLs OR Base64 Encoded Image Data Streams.
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
// 2. USER PROFILE MANAGEMENT (Self-Service)
// ==========================================

export const updateProfileSchema = z.object({
  body: z.object({
    name: z.string()
      .min(2, 'Name must be at least 2 characters')
      .max(50, 'Name cannot exceed 50 characters')
      .trim()
      .optional(),
      
    phoneNumber: z.string()
      .regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format. Include country code (e.g., +91).')
      .optional()
      // We allow empty strings to be parsed as null if the user wants to remove their phone number
      .transform(val => val === '' ? null : val),

    image: dualModeImageValidator.optional(),
  }).strict('Unrecognized fields are not allowed in this request.'), // .strict() drops hackers trying to inject {"role": "ADMIN"}
});

export const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string({ required_error: 'Current password is required' })
      .min(1, 'Current password cannot be empty'),
      
    newPassword: z.string({ required_error: 'New password is required' })
      .min(8, 'New password must be at least 8 characters')
      .regex(/[A-Z]/, 'New password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'New password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'New password must contain at least one number')
  }).refine((data) => data.currentPassword !== data.newPassword, {
    message: "New password must be different from the current password",
    path: ["newPassword"], // Now it correctly points to just 'newPassword' inside body
  })
});

// ==========================================
// 3. ADMIN / ROLE MANAGEMENT (Strictly Protected)
// ==========================================

export const getUserSchema = z.object({
  params: cuidParam,
});

export const updateRoleSchema = z.object({
  params: cuidParam,
  body: z.object({
    role: z.enum(['USER', 'WRITER', 'AUTHOR', 'ADMIN'], {
      required_error: 'Role is required',
      invalid_type_error: 'Invalid role. Must be USER, WRITER, AUTHOR, or ADMIN',
    }),
  }),
});

export const banUserSchema = z.object({
  params: cuidParam,
  body: z.object({
    isBanned: z.boolean({
      required_error: 'isBanned boolean flag is required',
      invalid_type_error: 'isBanned must be true or false',
    }),
  }),
});