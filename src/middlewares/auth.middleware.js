import jwt from 'jsonwebtoken';
import AppError from '../utils/AppError.js';
import prisma from '../config/db.js';
import catchAsync from '../utils/catchAsync.js';
import { env } from '../config/env.js';

export const protect = catchAsync(async (req, res, next) => {
  let token;
  
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies?.accessToken) {
    token = req.cookies.accessToken;
  }

  if (!token) {
    return next(new AppError('Authentication failed. Please log in to gain access.', 401));
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);

    // Enterprise Optimization: Select ONLY what we need. Avoid fetching password hashes/heavy relations.
    const currentUser = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, role: true, isBanned: true }
    });

    if (!currentUser) {
      return next(new AppError('The user associated with this active token no longer exists.', 401));
    }

    if (currentUser.isBanned) {
      return next(new AppError('Access Denied. This account context has been suspended.', 403));
    }

    req.user = currentUser;
    next();
  } catch (error) {
    // Specifically catch JWT errors so frontend can trigger silent refresh
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'TOKEN_EXPIRED' });
    }
    return next(new AppError('Invalid token. Please log in again.', 401));
  }
});

export const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(new AppError('Forbidden: Unauthorized execution permissions.', 403));
    }
    next();
  };
};