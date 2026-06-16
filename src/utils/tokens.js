import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { env } from '../config/env.js';

export const generateAccessToken = (userId, role) => {
  return jwt.sign(
    { userId, role },
    env.JWT_SECRET,
    { 
      expiresIn: env.JWT_EXPIRES_IN,
      algorithm: 'HS256' 
    }
  );
};

export const generateRefreshToken = () => {
  return crypto.randomBytes(64).toString('hex');
};

export const generateOTP = () => {
  return crypto.randomInt(100000, 1000000).toString();
};

export const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};