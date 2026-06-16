import app from './app.js';
import { env } from './config/env.js';
import prisma from './config/db.js';

// ==========================================
// HANDLE UNCAUGHT EXCEPTIONS (Synchronous System Guard)
// ==========================================
// Must remain at the absolute top of the initialization stack to register core event hooks
process.on('uncaughtException', (err) => {
  console.error('💥 CRITICAL UNCAUGHT EXCEPTION RUNTIME CRASH! Initiating immediate shutdown...');
  console.error(`${err.name}: ${err.message}\n${err.stack}`);
  process.exit(1);
});

const PORT = env.PORT || 8000;
let server;

// ==========================================
// INITIALIZE APPLICATION ENGINE & DATA CONNECTIONS
// ==========================================
const startServer = async () => {
  try {
    // Assert active database connection before opening the server port to traffic
    await prisma.$connect();
    console.log('📦 Database connection layer initialized successfully.');

    server = app.listen(PORT, () => {
      console.log(`🚀 Gaprio API Engine is running in [${env.NODE_ENV}] mode on port ${PORT}`);
    });
  } catch (error) {
    console.error('🚨 CRITICAL COMPONENT STARTUP FAULT:', error);
    process.exit(1);
  }
};

startServer();

// ==========================================
// HANDLE UNHANDLED REJECTIONS (Asynchronous Promise Guard)
// ==========================================
// Intercepts unmanaged runtime asynchronous failures gracefully
process.on('unhandledRejection', (err) => {
  console.error('💥 CRITICAL UNHANDLED REJECTION! Closing connection instances gracefully...');
  console.error(`${err.name}: ${err.message}`);
  
  if (server) {
    server.close(() => {
      process.exit(1);
    });
  } else {
    process.exit(1);
  }
});

// ==========================================
// SYSTEM GRACEFUL SHUTDOWN INTERCEPTORS
// ==========================================
// Managed process evacuation sequence for zero-downtime platform rolling updates
const gracefulShutdown = async (signal) => {
  console.log(`\n🛑 System received signature event ${signal}. Terminating active worker processes...`);
  
  if (server) {
    server.close(async () => {
      console.log('✅ Active HTTP server context closed cleanly.');
      await prisma.$disconnect();
      console.log('✅ Prisma proxy pool disconnected.');
      process.exit(0);
    });
  } else {
    await prisma.$disconnect();
    process.exit(0);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));