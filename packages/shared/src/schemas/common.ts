import { z } from 'zod';

import { PAGINATION, SORT_ORDERS } from '../constants';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** True when `value` (YYYY-MM-DD) is a real calendar day, e.g. rejects 2025-02-30. */
export function isRealDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return false;
  const year = date.getUTCFullYear();
  return date.toISOString().slice(0, 10) === value && year >= 1900 && year <= 2200;
}

/** A calendar date in YYYY-MM-DD form. Dates are stored as DATE columns, so no timezone games. */
export const dateString = z
  .string({ error: 'Date must be a string in YYYY-MM-DD format' })
  .trim()
  .regex(DATE_PATTERN, 'Use the YYYY-MM-DD format')
  .refine(isRealDate, 'Enter a valid calendar date');

/**
 * Optional date that can also be cleared.
 *  - undefined -> field not sent (leave unchanged)
 *  - '' / null -> clear the value
 */
export const optionalDate = z
  .union([dateString, z.literal(''), z.null()])
  .optional()
  .transform((value) => (value === undefined ? undefined : value === '' ? null : value));

/** Required, trimmed text. Whitespace-only strings are rejected as empty. */
export function requiredText(label: string, max: number) {
  return z
    .string({ error: `${label} is required` })
    .trim()
    .min(1, `${label} is required`)
    .max(max, `${label} must be at most ${max} characters`);
}

/** Optional free text; an empty string is normalised to null so the DB never stores ''. */
export function optionalText(label: string, max: number) {
  return z
    .string({ error: `${label} must be text` })
    .trim()
    .max(max, `${label} must be at most ${max} characters`)
    .nullish()
    .transform((value) => (value === undefined ? undefined : value ? value : null));
}

export const idSchema = z.uuid({ error: 'Invalid id' });

export const idParamSchema = z.object({ id: idSchema });

/** Query-string values arrive as strings; an empty `?status=` should behave like "not set". */
export function emptyToUndefined<T extends z.ZodType>(schema: T) {
  return z.preprocess((value) => (value === '' || value === null ? undefined : value), schema.optional());
}

export const paginationQuery = {
  page: emptyToUndefined(
    z.coerce
      .number({ error: 'page must be a number' })
      .int('page must be a whole number')
      .min(1, 'page must be 1 or more'),
  ).transform((value) => value ?? 1),
  limit: emptyToUndefined(
    z.coerce
      .number({ error: 'limit must be a number' })
      .int('limit must be a whole number')
      .min(1, 'limit must be 1 or more')
      .max(PAGINATION.maxLimit, `limit must be at most ${PAGINATION.maxLimit}`),
  ).transform((value) => value ?? PAGINATION.defaultLimit),
  order: emptyToUndefined(z.enum(SORT_ORDERS, { error: 'order must be asc or desc' })).transform(
    (value) => value ?? 'desc',
  ),
  search: emptyToUndefined(z.string().trim().max(100, 'search must be at most 100 characters')),
};

/** Rejects `{}` on update endpoints, there has to be at least one field to change. */
export function hasAtLeastOneKey(value: Record<string, unknown>) {
  return Object.values(value).some((field) => field !== undefined);
}
