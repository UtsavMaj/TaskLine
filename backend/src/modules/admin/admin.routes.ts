import { paginationQuery } from '@taskline/shared';
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';

import { prisma } from '../../lib/prisma';
import { pageMeta, serializeUser } from '../../lib/serializers';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/require-role';
import { validate } from '../../middleware/validate';

/**
 * Admin-only overview of accounts. Deliberately returns counts, not anyone's projects or
 * tasks: even an admin can't read another user's data through the API.
 */
const usersQuery = z.object({ page: paginationQuery.page, limit: paginationQuery.limit });

async function listUsers(req: Request, res: Response) {
  const { page, limit } = req.validatedQuery as z.output<typeof usersQuery>;
  const [total, users] = await prisma.$transaction([
    prisma.user.count(),
    prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        createdAt: true,
        _count: { select: { projects: true } },
      },
    }),
  ]);

  res.json({
    data: users.map((user) => ({ ...serializeUser(user), projectCount: user._count.projects })),
    meta: pageMeta(page, limit, total),
  });
}

export const adminRouter = Router();
adminRouter.use(authenticate, requireRole('ADMIN'));
adminRouter.get('/users', validate({ query: usersQuery }), listUsers);
