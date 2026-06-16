import { env } from '../config/env.js';

// Prisma Error Handlers
const handlePrismaUniqueConstraint = (err) => {
  const field = err.meta.target;
  const message = `Duplicate field value entered for ${field}. Please use another value.`;
  return new AppError(message, 409);
};

const handlePrismaRecordNotFound = () => {
  return new AppError('The requested record was not found in the database.', 404);
};

export const errorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  let error = Object.assign(err);

  // Trap specific Prisma DB Errors so they don't show up as generic 500 crashes
  if (err.code === 'P2002') error = handlePrismaUniqueConstraint(error);
  if (err.code === 'P2025') error = handlePrismaRecordNotFound();

  if (env.NODE_ENV === 'development') {
    res.status(error.statusCode).json({
      success: false,
      status: error.status,
      message: error.message,
      errors: error.errors || null,
      stack: error.stack,
    });
  } else {
    // Production Mode
    if (error.isOperational) {
      res.status(error.statusCode).json({
        success: false,
        status: error.status,
        message: error.message,
        errors: error.errors || undefined, // Only send if it exists
      });
    } else {
      // System/Uncaught low-level errors (hide implementation details from users)
      console.error('💥 SYSTEM FAULT RUNTIME CRASH:', error);
      res.status(500).json({
        success: false,
        status: 'error',
        message: 'An internal server processing fault occurred. Our engineers have been notified.',
      });
    }
  }
};