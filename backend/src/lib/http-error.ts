import { ERROR_CODES, type ErrorCode, type FieldError } from '@taskline/shared';

/** An error that maps directly onto an HTTP response. Thrown from services, rendered by the error handler. */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: FieldError[],
  ) {
    super(message);
    this.name = 'HttpError';
  }

  static badRequest(message: string, details?: FieldError[]) {
    return new HttpError(400, ERROR_CODES.VALIDATION_ERROR, message, details);
  }

  static unauthorized(message = 'Authentication required', code: ErrorCode = ERROR_CODES.UNAUTHORIZED) {
    return new HttpError(401, code, message);
  }

  static forbidden(message = 'You do not have permission to do that') {
    return new HttpError(403, ERROR_CODES.FORBIDDEN, message);
  }

  /** Also used when a record exists but belongs to someone else, so ids can't be probed. */
  static notFound(message = 'Resource not found') {
    return new HttpError(404, ERROR_CODES.NOT_FOUND, message);
  }

  static conflict(message: string, details?: FieldError[]) {
    return new HttpError(409, ERROR_CODES.CONFLICT, message, details);
  }
}
