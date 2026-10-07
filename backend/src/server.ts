import { createApp } from './app';
import { env } from './config/env';
import { logger } from './lib/logger';
import { prisma } from './lib/prisma';
import { startReminderScheduler } from './modules/notifications/reminders.service';

async function main() {
  await prisma.$connect();
  const app = createApp();

  const server = app.listen(env.PORT, () => {
    logger.info(`Taskline API listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
    logger.info(`CORS allowed origins: ${env.corsOrigins.join(', ') || '(none)'}`);
  });

  const stopScheduler = env.REMINDER_SCHEDULER ? startReminderScheduler() : () => undefined;

  // Let in-flight requests finish and close DB connections when the platform stops the container.
  const shutdown = (signal: string) => {
    logger.info(`${signal} received, shutting down`);
    stopScheduler();
    server.close(async () => {
      await prisma.$disconnect();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, 'Unhandled promise rejection');
});

main().catch(async (error) => {
  logger.fatal({ err: error }, 'Failed to start the server');
  await prisma.$disconnect();
  process.exit(1);
});
