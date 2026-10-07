import { timingSafeEqual } from 'node:crypto';

import { registerPushTokenSchema, removePushTokenSchema, type RegisterPushTokenData } from '@taskline/shared';
import { Router, type Request, type Response } from 'express';

import { env } from '../../config/env';
import { HttpError } from '../../lib/http-error';
import { authenticate, getAuth } from '../../middleware/authenticate';
import { validate } from '../../middleware/validate';
import { registerPushToken, removePushToken, runDueTomorrowReminders } from './reminders.service';

// ---- /api/push-tokens: the mobile app opting a device in or out ------------

export const pushTokensRouter = Router();
pushTokensRouter.use(authenticate);

pushTokensRouter.post('/', validate({ body: registerPushTokenSchema }), async (req: Request, res: Response) => {
  const auth = getAuth(req);
  await registerPushToken(auth.userId, auth.sessionId, req.body as RegisterPushTokenData);
  res.status(204).end();
});

pushTokensRouter.delete('/', validate({ body: removePushTokenSchema }), async (req: Request, res: Response) => {
  await removePushToken(getAuth(req).userId, (req.body as { token: string }).token);
  res.status(204).end();
});

// ---- /api/jobs: endpoints for an external scheduler -------------------------

function secretMatches(given: string | undefined, expected: string) {
  if (!given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Triggered hourly by a cron (GitHub Actions, Render cron, cron-job.org...) with the header
 * `x-cron-secret: <CRON_SECRET>`. Disabled entirely when CRON_SECRET isn't configured.
 */
export const jobsRouter = Router();

jobsRouter.post('/due-reminders', async (req: Request, res: Response) => {
  if (!env.CRON_SECRET) throw HttpError.notFound();
  if (!secretMatches(req.get('x-cron-secret'), env.CRON_SECRET)) throw HttpError.unauthorized('Invalid cron secret');
  res.json(await runDueTomorrowReminders());
});
