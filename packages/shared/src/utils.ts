import type { ZodError } from 'zod';

import type { FieldError } from './types';

/** Flattens zod issues into `{ field, message }` pairs, one per field (first message wins). */
export function toFieldErrors(error: ZodError): FieldError[] {
  const seen = new Set<string>();
  const out: FieldError[] = [];
  for (const issue of error.issues) {
    const field = issue.path.length ? issue.path.map(String).join('.') : '_';
    if (seen.has(field)) continue;
    seen.add(field);
    out.push({ field, message: issue.message });
  }
  return out;
}

/** Today's date as YYYY-MM-DD in the device's local timezone. */
export function todayLocal(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** A task is overdue when it has a due date in the past and is not completed. */
export function isOverdue(task: { dueDate: string | null; status: string }, today = todayLocal()): boolean {
  return Boolean(task.dueDate && task.status !== 'COMPLETED' && task.dueDate < today);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-03-09" -> "9 Mar 2026". Parsed by hand so the result never shifts with the timezone. */
export function formatDate(value: string | null | undefined, fallback = '—'): string {
  if (!value) return fallback;
  const [y, m, d] = value.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return fallback;
  return `${d} ${MONTHS[m - 1]} ${y}`;
}
