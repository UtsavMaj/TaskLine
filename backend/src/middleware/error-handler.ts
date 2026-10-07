import { Prisma } from '@prisma/client';
import { ERROR_CODES, toFieldErrors, type ApiErrorBody } from '@taskline/shared';
import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

import { HttpError } from '../lib/http-error';

export function notFoundHandler(req: Request, _res: Response, next: NextFunction) {
  next(HttpError.notFound(`Route ${req.method} ${req.path} does not exist`));
}

/** Turns anything thrown in a route into a consistent `{ error: { code, message } }` body. */
function toHttpError(error: unknown): HttpError {
  if (error instanceof HttpError) return error;

  if (error instanceof ZodError) {
    return HttpError.badRequest('Please check the highlighted fields', toFieldErrors(error));
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') return HttpError.conflict('A record with these details already exists');
    if (error.code === 'P2025') return HttpError.notFound();
    if (error.code === 'P2003') return HttpError.badRequest('A related record does not exist');
  }

  // body-parser errors carry a `type` and an HTTP status we can trust.
  const parserError = error as { type?: string; status?: number };
  if (parserError.type === 'entity.parse.failed') return HttpError.badRequest('Request body is not valid JSON');
  if (parserError.type === 'entity.too.large') {
    return new HttpError(413, ERROR_CODES.VALIDATION_ERROR, 'Request body is too large');
  }

  return new HttpError(500, ERROR_CODES.INTERNAL_ERROR, 'Something went wrong on our side. Please try again.');
}

// Express recognises error handlers by their 4 arguments, so `_next` has to stay.
export function errorHandler(error: unknown, req: Request, res: Response, _next: NextFunction) {
  const httpError = toHttpError(error);

  if (httpError.status >= 500) {
    // Full error (with stack) goes to the logs only. The client gets a generic message.
    req.log.error({ err: error }, 'Unhandled error');
  } else {
    req.log.debug({ code: httpError.code, status: httpError.status }, httpError.message);
  }

  const body: ApiErrorBody = {
    error: {
      code: httpError.code,
      message: httpError.message,
      ...(httpError.details?.length ? { details: httpError.details } : {}),
      requestId: String(req.id),
    },
  };
  res.status(httpError.status).json(body);
}
