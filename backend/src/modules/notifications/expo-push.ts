import { env } from '../../config/env';
import { logger } from '../../lib/logger';

/**
 * Minimal client for Expo's push service (https://docs.expo.dev/push-notifications/sending-notifications/).
 * Expo forwards each message to FCM, so the backend doesn't need any Firebase credentials.
 */

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const BATCH_SIZE = 100; // Expo's limit per request

export interface PushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: 'default' | null;
  channelId?: string;
}

export type PushTicket =
  { status: 'ok'; id: string } | { status: 'error'; message: string; details?: { error?: string } };

/** Sends messages and returns one ticket per message, in the same order. Swappable in tests. */
export type PushSender = (messages: PushMessage[]) => Promise<PushTicket[]>;

export const expoPushSender: PushSender = async (messages) => {
  const tickets: PushTicket[] = [];

  for (let i = 0; i < messages.length; i += BATCH_SIZE) {
    const batch = messages.slice(i, i + BATCH_SIZE);
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...(env.EXPO_ACCESS_TOKEN ? { Authorization: `Bearer ${env.EXPO_ACCESS_TOKEN}` } : {}),
        },
        body: JSON.stringify(batch),
        signal: AbortSignal.timeout(15_000),
      });
      const body = (await res.json()) as { data?: PushTicket[]; errors?: unknown };
      if (!res.ok || !Array.isArray(body.data)) {
        logger.error({ status: res.status, errors: body.errors }, 'Expo push request failed');
        tickets.push(...batch.map(() => ({ status: 'error' as const, message: 'Push request failed' })));
      } else {
        tickets.push(...body.data);
      }
    } catch (error) {
      logger.error({ err: error }, 'Could not reach the Expo push service');
      tickets.push(...batch.map(() => ({ status: 'error' as const, message: 'Push service unreachable' })));
    }
  }

  return tickets;
};
