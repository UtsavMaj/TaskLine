import { CLIENT_HEADER, loginSchema, refreshSchema, registerSchema } from '@taskline/shared';
import { Router, type NextFunction, type Request, type Response } from 'express';

import { HttpError } from '../../lib/http-error';
import { authenticate } from '../../middleware/authenticate';
import { authLimiter, loginLimiter } from '../../middleware/rate-limit';
import { validate } from '../../middleware/validate';
import * as controller from './auth.controller';

/**
 * The refresh endpoint is the only one that relies on a cookie, so it is the only CSRF target.
 * A cross-site <form> can't set custom headers, so requiring ours is enough to block it.
 */
function requireClientHeader(req: Request, _res: Response, next: NextFunction) {
  if (!req.get(CLIENT_HEADER)) throw HttpError.badRequest(`Missing ${CLIENT_HEADER} header`);
  next();
}

export const authRouter = Router();

authRouter.post('/register', authLimiter, validate({ body: registerSchema }), controller.register);
authRouter.post('/login', loginLimiter, validate({ body: loginSchema }), controller.login);
authRouter.post('/refresh', authLimiter, requireClientHeader, validate({ body: refreshSchema }), controller.refresh);
authRouter.post('/logout', authenticate, controller.logout);
authRouter.get('/me', authenticate, controller.me);
