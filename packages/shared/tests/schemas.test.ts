import { describe, expect, it } from 'vitest';

import {
  createProjectSchema,
  createTaskSchema,
  formatDate,
  isOverdue,
  isRealDate,
  loginSchema,
  registerSchema,
  taskListQuerySchema,
  toFieldErrors,
  updateProjectSchema,
  updateTaskSchema,
} from '../src';

const uuid = '3f1c2a8e-5d4b-4c7a-9e21-0b6d8f4a2c11';

describe('isRealDate', () => {
  it.each(['2026-01-31', '2024-02-29', '2000-02-29'])('accepts %s', (d) => expect(isRealDate(d)).toBe(true));
  it.each(['2026-02-29', '2026-13-01', '2026-04-31', '26-01-01', '2026/01/01', '1800-01-01'])('rejects %s', (d) =>
    expect(isRealDate(d)).toBe(false),
  );
});

describe('registerSchema', () => {
  it('normalises name and email', () => {
    const out = registerSchema.parse({ fullName: '  Ravi  Kumar ', email: ' Ravi@Example.COM ', password: 'abcdef12' });
    expect(out).toEqual({ fullName: 'Ravi  Kumar', email: 'ravi@example.com', password: 'abcdef12' });
  });

  it('enforces a minimum password strength', () => {
    expect(registerSchema.safeParse({ fullName: 'Ravi', email: 'r@e.co', password: 'abcdefgh' }).success).toBe(false);
    expect(registerSchema.safeParse({ fullName: 'Ravi', email: 'r@e.co', password: '12345678' }).success).toBe(false);
    expect(registerSchema.safeParse({ fullName: 'Ravi', email: 'r@e.co', password: 'a1' }).success).toBe(false);
  });

  it('caps the password at bcrypt’s 72 byte limit', () => {
    const long = `a1${'x'.repeat(80)}`;
    expect(registerSchema.safeParse({ fullName: 'Ravi', email: 'r@e.co', password: long }).success).toBe(false);
  });
});

describe('loginSchema', () => {
  it('requires both fields', () => {
    const result = loginSchema.safeParse({ email: '', password: '' });
    expect(result.success).toBe(false);
    if (!result.success) expect(toFieldErrors(result.error).map((e) => e.field)).toEqual(['email', 'password']);
  });
});

describe('project schemas', () => {
  it('defaults the status and turns empty strings into null', () => {
    const out = createProjectSchema.parse({ name: 'Site', description: '   ', startDate: '' });
    expect(out).toMatchObject({ name: 'Site', status: 'NOT_STARTED', description: null, startDate: null });
  });

  it('rejects an end date before the start date', () => {
    const result = createProjectSchema.safeParse({ name: 'x', startDate: '2026-05-02', endDate: '2026-05-01' });
    expect(result.success).toBe(false);
  });

  it('keeps omitted fields undefined on update so they are not overwritten', () => {
    const out = updateProjectSchema.parse({ status: 'COMPLETED' });
    expect(out).toEqual({ status: 'COMPLETED' });
    expect(updateProjectSchema.safeParse({}).success).toBe(false);
  });
});

describe('task schemas', () => {
  it('applies priority and status defaults', () => {
    const out = createTaskSchema.parse({ projectId: uuid, name: 'Do it' });
    expect(out).toMatchObject({ priority: 'MEDIUM', status: 'PENDING' });
  });

  it('accepts a one-field update', () => {
    expect(updateTaskSchema.parse({ status: 'COMPLETED' })).toEqual({ status: 'COMPLETED' });
  });

  it('coerces and defaults list query parameters', () => {
    const out = taskListQuerySchema.parse({ page: '2', limit: '5', status: '', priority: 'HIGH' });
    expect(out).toMatchObject({
      page: 2,
      limit: 5,
      status: undefined,
      priority: 'HIGH',
      sortBy: 'createdAt',
      order: 'desc',
    });
  });
});

describe('helpers', () => {
  it('formats dates without timezone drift', () => {
    expect(formatDate('2026-03-09')).toBe('9 Mar 2026');
    expect(formatDate(null)).toBe('—');
  });

  it('knows when a task is overdue', () => {
    expect(isOverdue({ dueDate: '2026-01-01', status: 'PENDING' }, '2026-01-02')).toBe(true);
    expect(isOverdue({ dueDate: '2026-01-01', status: 'COMPLETED' }, '2026-01-02')).toBe(false);
    expect(isOverdue({ dueDate: null, status: 'PENDING' }, '2026-01-02')).toBe(false);
  });
});
