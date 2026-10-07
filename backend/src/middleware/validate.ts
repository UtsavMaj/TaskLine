import { toFieldErrors } from '@taskline/shared';
import type { NextFunction, Request, Response } from 'express';
import type { z } from 'zod';

import { HttpError } from '../lib/http-error';

interface Schemas {
  body?: z.ZodType;
  query?: z.ZodType;
  params?: z.ZodType;
}

/**
 * Validates and normalises the request with the shared zod schemas before the controller runs.
 * The parsed body replaces `req.body`, so controllers only ever see trimmed, typed data and
 * unknown keys are dropped. Errors come back as 400 with one message per field.
 */
export function validate(schemas: Schemas) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (schemas.params) {
      const result = schemas.params.safeParse(req.params);
      // A malformed id can't match anything, answer the same way as for a missing record.
      if (!result.success) throw HttpError.notFound();
    }

    if (schemas.query) {
      const result = schemas.query.safeParse(req.query);
      if (!result.success) throw HttpError.badRequest('Invalid query parameters', toFieldErrors(result.error));
      req.validatedQuery = result.data;
    }

    if (schemas.body) {
      const result = schemas.body.safeParse(req.body ?? {});
      if (!result.success)
        throw HttpError.badRequest('Please check the highlighted fields', toFieldErrors(result.error));
      req.body = result.data;
    }

    next();
  };
}
