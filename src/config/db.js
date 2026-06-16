import { PrismaClient } from '@prisma/client';
import { env } from './env.js';

const globalForPrisma = globalThis;

// Enterprise optimization: Prevents exhausting DB connections during Nodemon hot-reloads in dev
const prisma = globalForPrisma.prisma || new PrismaClient({
  log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'], // Removed 'query' to stop terminal spam unless debugging
});

if (env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;