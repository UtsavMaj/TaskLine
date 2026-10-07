import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';

import { ApiError, errorMessage } from '@/api/client';

/**
 * Puts the API's per-field validation messages under the matching inputs.
 * Returns a message for anything that isn't tied to a field (shown above the form).
 */
export function applyServerErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fields: readonly string[],
): string | null {
  if (error instanceof ApiError && error.details.length) {
    let unmatched: string | null = null;
    for (const detail of error.details) {
      if (fields.includes(detail.field)) {
        setError(detail.field as Path<T>, { type: 'server', message: detail.message }, { shouldFocus: true });
      } else {
        unmatched ??= detail.message;
      }
    }
    return unmatched;
  }
  return errorMessage(error);
}
