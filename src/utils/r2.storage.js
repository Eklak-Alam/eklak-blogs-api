import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import crypto from 'node:crypto';
import { env } from '../config/env.js';
import AppError from './AppError.js';

// Initialize the S3 Client pointed to Cloudflare's Edge Network
const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  requestChecksumCalculation: "WHEN_REQUIRED", // Fixes AWS empty file checksum bug
  credentials: {
    accessKeyId: env.CLOUDFLARE_ACCESS_KEY,
    secretAccessKey: env.CLOUDFLARE_SECRET_KEY,
  },
});

/**
 * Generates a Presigned URL so the Frontend can upload directly to Cloudflare R2
 * @param {string} rawFileName - Original file name from the user
 * @param {string} fileType - MIME type (e.g., 'image/jpeg', 'image/webp')
 */
export const generateUploadUrl = async (rawFileName, fileType) => {
  try {
    // Clean filename to prevent path traversal and broken URLs
    const sanitizedFileName = rawFileName
      .toLowerCase()
      .replace(/[^a-z0-9.-]/g, '-') 
      .replace(/-+/g, '-');

    // Make it 100% Unique
    const uniqueId = crypto.randomUUID().split('-')[0];
    const finalFileName = `covers/${Date.now()}-${uniqueId}-${sanitizedFileName}`;

    const command = new PutObjectCommand({
      Bucket: env.CLOUDFLARE_BUCKET_NAME,
      Key: finalFileName,
      ContentType: fileType,
    });

    // URL is valid for 5 minutes (300 seconds)
    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 });
    const publicUrl = `${env.CLOUDFLARE_PUBLIC_DOMAIN}/${finalFileName}`;

    return { signedUrl, publicUrl };
  } catch (error) {
    console.error("🚨 Cloudflare R2 URL Generation Error:", error);
    throw new AppError("Failed to generate secure upload URL for Cloudflare.", 500);
  }
};

/**
 * Deletes an asset out of your Cloudflare R2 bucket
 * @param {string} publicUrl - The complete public URL of the asset saved in the DB
 */
export const deleteFromR2 = async (publicUrl) => {
  try {
    if (!publicUrl) return;
    
    const key = publicUrl.replace(`${env.CLOUDFLARE_PUBLIC_DOMAIN}/`, '');
    
    const command = new DeleteObjectCommand({
      Bucket: env.CLOUDFLARE_BUCKET_NAME,
      Key: key,
    });

    await s3Client.send(command);
  } catch (err) {
    console.error('🚨 Failed to clean old R2 object:', err.message);
  }
};

/**
 * Uploads a base64 encoded image string directly to Cloudflare R2 and returns the public URL.
 * Enforces strict MIME types and a 5MB size limit.
 * @param {string} base64String - The base64 encoded image string (e.g. data:image/png;base64,...)
 */
export const uploadBase64ToR2 = async (base64String) => {
  try {
    if (!base64String || !base64String.startsWith('data:image/')) return null;

    const matches = base64String.match(/^data:image\/(jpeg|png|webp|gif);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      throw new AppError("Invalid or unsupported base64 image format. Only JPEG, PNG, WEBP, and GIF are allowed.", 400);
    }

    const fileExtension = matches[1];
    const base64Data = matches[2];
    
    // Security: Calculate exact byte size to prevent memory-busting payloads
    // Base64 inflates size by 4/3. So bytes = (string length * 3/4) - padding
    const padding = (base64Data.endsWith("==") ? 2 : base64Data.endsWith("=") ? 1 : 0);
    const sizeInBytes = (base64Data.length * 0.75) - padding;
    
    // 5MB limit
    if (sizeInBytes > 5 * 1024 * 1024) {
       throw new AppError("Image exceeds the maximum allowed size of 5MB.", 400);
    }

    const buffer = Buffer.from(base64Data, 'base64');

    const uniqueId = crypto.randomUUID().split('-')[0];
    const finalFileName = `covers/${Date.now()}-${uniqueId}.${fileExtension}`;

    const command = new PutObjectCommand({
      Bucket: env.CLOUDFLARE_BUCKET_NAME,
      Key: finalFileName,
      Body: buffer,
      ContentType: `image/${fileExtension}`,
    });

    await s3Client.send(command);

    return `${env.CLOUDFLARE_PUBLIC_DOMAIN}/${finalFileName}`;
  } catch (error) {
    if (error instanceof AppError) throw error;
    console.error("🚨 Cloudflare R2 Base64 Upload Error:", error);
    throw new AppError("Failed to upload image to Cloudflare.", 500);
  }
};

/**
 * Replaces an existing image in R2 with a new one.
 * Safely deletes the old image and uploads the new base64 string.
 * @param {string} oldUrl - The old public URL to delete
 * @param {string} newBase64String - The new base64 string to upload
 */
export const replaceImageInR2 = async (oldUrl, newBase64String) => {
  if (oldUrl && oldUrl !== newBase64String) {
    await deleteFromR2(oldUrl).catch(err => console.error("Failed to delete old R2 image:", err));
  }
  
  if (newBase64String && newBase64String.startsWith('data:image/')) {
    return await uploadBase64ToR2(newBase64String);
  }
  
  return newBase64String || null; // Returns original url if it's not base64, or null if cleared
};