import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';

import { env } from './config/env.js';
import apiRoutes from './routes/index.js'; // <-- CHANGED THIS LINE!
import { errorHandler } from './middlewares/error.middleware.js';
import AppError from './utils/AppError.js';

const app = express();

// ==========================================
// 1. TRUST PROXY (CRITICAL FOR CLOUD DEPLOYMENTS)
// ==========================================
// Required for express-rate-limit to extract the real user IP when behind upstream proxies (AWS, Render, Vercel)
app.set('trust proxy', 1);

// ==========================================
// 2. GLOBAL SECURITY & MIDDLEWARES
// ==========================================

// Set robust security HTTP headers using Helmet
app.use(helmet());

const allowedOrigins = [
  env.NODE_ENV === 'production' ? 'https://gaprio.com' : 'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:5500' // <-- ADD THIS FOR LIVE SERVER!
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    // Allow server-to-server requests, mobile applications, or tools like Postman (where origin is undefined)
    if (!origin) return callback(null, true); 
    
    if (allowedOrigins.indexOf(origin) === -1) {
      return callback(new AppError('The CORS policy for this system does not allow access from the specified Origin.', 403), false);
    }
    return callback(null, true);
  },
  credentials: true, // Allows HTTP-Only session or refresh cookies to pass securely across domains
}));

// Global Rate Limiter to prevent brute-force attacks and volumetric DDoS
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 Minute window
  max: 200, // Limit each isolated IP to 200 requests per window
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: { 
    success: false, 
    status: 'fail',
    message: 'Too many requests processed from this IP endpoint. Operational execution paused. Please try again later.' 
  }
});

// Activate system rate limiting explicitly in production to maintain server performance
if (env.NODE_ENV === 'production') {
  app.use('/api', globalLimiter); 
}

// Global Body parsers (Optimized capacity limit for handling heavy rich text blog blocks)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Secure Cookie parser for reading incoming HTTP-Only identification metadata
app.use(cookieParser());

// ==========================================
// 3. HEALTH CHECK & SYSTEMS ROUTING
// ==========================================

// Root Landing Diagnostic Route
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Welcome to the Gaprio Blogs API Engine 🚀',
    version: '1.0.0',
    environment: env.NODE_ENV,
    healthCheck: 'Visit /health for server operational status',
    mainAPI: 'Visit /api/v1 for accessible application endpoints'
  });
});

// Isolated System Health Check for monitoring software pings (AWS Target Groups, Render Liveness Probes)
app.get('/health', (req, res) => {
  res.status(200).json({ 
    success: true, 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    message: 'Gaprio API core services are fully operational.' 
  });
});

// Mount the Main API Version 1 Module Routing Tree
app.use('/api/v1', apiRoutes);

// ==========================================
// 4. FALLBACKS & ERROR HANDLING PIPELINE
// ==========================================

// 404 Unmapped Resource Interceptor
app.use((req, res, next) => {
  next(new AppError(`The requested endpoint [${req.method}] ${req.originalUrl} does not exist on this application instance.`, 404));
});

// Master Error Orchestration Middleware
app.use(errorHandler);

export default app;