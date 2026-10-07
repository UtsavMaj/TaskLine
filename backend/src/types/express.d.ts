import type { UserRole } from '@taskline/shared';

export interface AuthContext {
  userId: string;
  sessionId: string;
  role: UserRole;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Set by the `authenticate` middleware. */
      auth?: AuthContext;
      /** Parsed + coerced query string, set by `validate({ query })` (Express 5 makes req.query read-only). */
      validatedQuery?: unknown;
    }
  }
}
