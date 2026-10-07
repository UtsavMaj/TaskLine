import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';

import { buildOpenApiSpec } from '../docs/openapi';
import { prisma } from '../lib/prisma';
import { adminRouter } from '../modules/admin/admin.routes';
import { auditRouter } from '../modules/audit/audit.routes';
import { authRouter } from '../modules/auth/auth.routes';
import { dashboardRouter } from '../modules/dashboard/dashboard.routes';
import { jobsRouter, pushTokensRouter } from '../modules/notifications/notifications.routes';
import { projectsRouter } from '../modules/projects/projects.routes';
import { tasksRouter } from '../modules/tasks/tasks.routes';

export const apiRouter = Router();

/** Liveness + DB check, used by Docker/Render health checks. Public on purpose. */
apiRouter.get('/health', async (_req, res) => {
  await prisma.$queryRaw`SELECT 1`;
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Interactive API reference (Swagger UI) and the raw OpenAPI document.
const openApiSpec = buildOpenApiSpec();
apiRouter.get('/openapi.json', (_req, res) => {
  res.json(openApiSpec);
});
apiRouter.use(
  '/docs',
  swaggerUi.serve,
  swaggerUi.setup(openApiSpec, {
    customSiteTitle: 'Taskline API',
    swaggerOptions: { persistAuthorization: true, displayRequestDuration: true },
  }),
);

apiRouter.use('/auth', authRouter);
apiRouter.use('/projects', projectsRouter);
apiRouter.use('/tasks', tasksRouter);
apiRouter.use('/dashboard', dashboardRouter);
apiRouter.use('/audit-logs', auditRouter);
apiRouter.use('/admin', adminRouter);
apiRouter.use('/push-tokens', pushTokensRouter);
apiRouter.use('/jobs', jobsRouter);
