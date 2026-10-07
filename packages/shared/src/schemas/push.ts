import { z } from 'zod';

/** Tokens issued by Expo's push service look like `ExponentPushToken[xxxxxxxx]`. */
export const EXPO_PUSH_TOKEN_PATTERN = /^Expo(nent)?PushToken\[[A-Za-z0-9_-]+\]$/;

/** True for IANA zone names the runtime knows, e.g. "Asia/Kolkata". */
export function isValidTimeZone(zone: string) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

const tokenField = z
  .string({ error: 'Push token is required' })
  .trim()
  .max(255, 'Push token is too long')
  .regex(EXPO_PUSH_TOKEN_PATTERN, 'Not a valid Expo push token');

export const registerPushTokenSchema = z.object({
  token: tokenField,
  // The device's zone, so "6 pm the evening before" means 6 pm where the user actually is.
  timezone: z
    .string()
    .trim()
    .max(64)
    .refine(isValidTimeZone, 'Unknown time zone')
    .optional()
    .transform((zone) => zone ?? 'UTC'),
});

export const removePushTokenSchema = z.object({ token: tokenField });

export type RegisterPushTokenInput = z.input<typeof registerPushTokenSchema>;
export type RegisterPushTokenData = z.output<typeof registerPushTokenSchema>;
