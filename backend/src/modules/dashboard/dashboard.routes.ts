import { dateString, emptyToUndefined } from '@taskline/shared';
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';

import { authenticate, getAuth } from '../../middleware/authenticate';
import { validate } from '../../middleware/validate';
import { getDashboard } from './dashboard.service';

const dashboardQuery = z.object({
  // Optional: the client's local date. Falls back to the server's UTC date.
  today: emptyToUndefined(dateString),
});

async function show(req: Request, res: Response) {
  const { today } = req.validatedQuery as z.output<typeof dashboardQuery>;
  const stats = await getDashboard(getAuth(req).userId, today ?? new Date().toISOString().slice(0, 10));
  res.json(stats);
}

export const dashboardRouter = Router();
dashboardRouter.get('/', authenticate, validate({ query: dashboardQuery }), show);
