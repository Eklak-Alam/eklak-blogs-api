import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('8000'),
  DATABASE_URL: z.string().min(1, 'Database URL is required'),
  
  // JWT Config
  JWT_SECRET: z.string().min(32, 'JWT Secret should be at least 32 characters long'),
  JWT_EXPIRES_IN: z.string().default('15m'),
  
  // Mail Config (Resend Upgrade)
  RESEND_API_KEY: z.string().startsWith('re_', 'Resend API key must start with "re_"'),
  FROM_EMAIL: z.string().email('Valid sender email is required (e.g., admin@gaprio.com)'),

  // Cloudflare R2 Config
  CLOUDFLARE_ACCOUNT_ID: z.string().min(1, 'Cloudflare Account ID is required'),
  CLOUDFLARE_ACCESS_KEY: z.string().min(1, 'Cloudflare Access Key is required'),
  CLOUDFLARE_SECRET_KEY: z.string().min(1, 'Cloudflare Secret Key is required'),
  CLOUDFLARE_BUCKET_NAME: z.string().min(1, 'Cloudflare Bucket Name is required'),
  CLOUDFLARE_PUBLIC_DOMAIN: z.string().url('Must be a valid URL (e.g., https://pub-xxx.r2.dev)'),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error('❌ CRITICAL: Invalid system environment setup:');
  console.error(JSON.stringify(_env.error.format(), null, 2));
  process.exit(1);
}

export const env = _env.data;