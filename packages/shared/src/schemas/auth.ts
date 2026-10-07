import { z } from 'zod';

export const emailSchema = z
  .string({ error: 'Email is required' })
  .trim()
  .min(1, 'Email is required')
  .max(254, 'Email is too long')
  .pipe(z.email({ error: 'Enter a valid email address' }))
  .transform((email) => email.toLowerCase());

// bcrypt only looks at the first 72 bytes, so we cap the length instead of silently truncating.
export const passwordSchema = z
  .string({ error: 'Password is required' })
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be at most 72 characters')
  .regex(/[A-Za-z]/, 'Password must contain at least one letter')
  .regex(/\d/, 'Password must contain at least one number');

export const registerSchema = z.object({
  fullName: z
    .string({ error: 'Full name is required' })
    .trim()
    .min(2, 'Full name must be at least 2 characters')
    .max(100, 'Full name must be at most 100 characters'),
  email: emailSchema,
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  // No strength rules on login: we only check it is present, the hash comparison does the rest.
  password: z.string({ error: 'Password is required' }).min(1, 'Password is required').max(72, 'Invalid password'),
});

export const refreshSchema = z.object({
  refreshToken: z.string().trim().min(1).max(512).optional(),
});

export type RegisterInput = z.input<typeof registerSchema>;
export type RegisterData = z.output<typeof registerSchema>;
export type LoginInput = z.input<typeof loginSchema>;
export type LoginData = z.output<typeof loginSchema>;
