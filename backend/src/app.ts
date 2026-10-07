import { randomUUID } from 'node:crypto';

import { CLIENT_HEADER } from '@taskline/shared';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';

import { env } from './config/env';
import { logger } from './lib/logger';
import { errorHandler, notFoundHandler } from './middleware/error-handler';
import { apiLimiter } from './middleware/rate-limit';
import { apiRouter } from './routes';

/**
 * Builds the Express app without listening, so tests can drive it with supertest.
 * Middleware order matters: security headers -> CORS -> logging -> parsing -> rate limit -> routes -> errors.
 */
export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', env.TRUST_PROXY);
  app.set('query parser', 'simple'); // no nested objects from ?a[b]=c, values are plain strings

  app.use(helmet());

  // Only the configured web origins get CORS headers. The mobile app isn't a browser, so CORS
  // doesn't apply to it; it is authenticated by its token like every other client.
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin) return callback(null, true);
        callback(null, env.corsOrigins.includes(origin));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', CLIENT_HEADER, 'X-Request-Id'],
      exposedHeaders: ['X-Request-Id', 'RateLimit', 'RateLimit-Policy', 'Retry-After'],
      maxAge: 600,
    }),
  );

  app.use(
    pinoHttp({
      logger,
      genReqId(req, res) {
        const incoming = req.headers['x-request-id'];
        const id = typeof incoming === 'string' && /^[\w-]{8,64}$/.test(incoming) ? incoming : randomUUID();
        res.setHeader('X-Request-Id', id);
        return id;
      },
      customLogLevel(_req, res, error) {
        if (error || res.statusCode >= 500) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
      },
      serializers: {
        req: (req) => ({ id: req.id, method: req.method, url: req.url }),
        res: (res) => ({ statusCode: res.statusCode }),
      },
      autoLogging: { ignore: (req) => req.url === '/api/health' },
    }),
  );

  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  app.use('/api', apiLimiter, apiRouter);

  app.get('/', (_req, res) => {
    res.json({ name: 'Taskline API', docs: 'See docs/API.md in the repository', health: '/api/health' });
  });

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
