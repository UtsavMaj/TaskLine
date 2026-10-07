import { paginationQuery } from '@taskline/shared';
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';

import { prisma } from '../../lib/prisma';
import { pageMeta, serializeAuditLog } from '../../lib/serializers';
import { authenticate, getAuth } from '../../middleware/authenticate';
import { validate } from '../../middleware/validate';

const auditQuery = z.object({ page: paginationQuery.page, limit: paginationQuery.limit });

/** The signed-in user's own activity trail (sign-ins, edits, deletions...), newest first. */
async function list(req: Request, res: Response) {
  const { page, limit } = req.validatedQuery as z.output<typeof auditQuery>;
  const where = { userId: getAuth(req).userId };

  const [total, logs] = await prisma.$transaction([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  res.json({ data: logs.map(serializeAuditLog), meta: pageMeta(page, limit, total) });
}

export const auditRouter = Router();
auditRouter.get('/', authenticate, validate({ query: auditQuery }), list);
