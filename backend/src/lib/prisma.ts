import { PrismaClient } from '@prisma/client';

import { logger } from './logger';

// Single client for the whole process. Prisma always sends parameters separately from the
// SQL text, which is what keeps user input out of the query string (no SQL injection).
export const prisma = new PrismaClient({
  log: [
    { emit: 'event', level: 'error' },
    { emit: 'event', level: 'warn' },
  ],
});

prisma.$on('error', (event) => logger.error({ target: event.target }, `Prisma: ${event.message}`));
prisma.$on('warn', (event) => logger.warn({ target: event.target }, `Prisma: ${event.message}`));
