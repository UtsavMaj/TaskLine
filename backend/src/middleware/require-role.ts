import type { UserRole } from '@taskline/shared';
import type { NextFunction, Request, Response } from 'express';

import { HttpError } from '../lib/http-error';

/** Role-based access control. Use after `authenticate`. */
export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) throw HttpError.unauthorized();
    if (!roles.includes(req.auth.role)) throw HttpError.forbidden();
    next();
  };
}
