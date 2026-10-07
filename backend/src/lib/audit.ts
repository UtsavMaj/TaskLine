import type { Prisma } from '@prisma/client';

import { prisma } from './prisma';

export const AUDIT_ACTIONS = {
  USER_REGISTERED: 'USER_REGISTERED',
  USER_LOGGED_IN: 'USER_LOGGED_IN',
  USER_LOGGED_OUT: 'USER_LOGGED_OUT',
  PROJECT_CREATED: 'PROJECT_CREATED',
  PROJECT_UPDATED: 'PROJECT_UPDATED',
  PROJECT_DELETED: 'PROJECT_DELETED',
  TASK_CREATED: 'TASK_CREATED',
  TASK_UPDATED: 'TASK_UPDATED',
  TASK_COMPLETED: 'TASK_COMPLETED',
  TASK_DELETED: 'TASK_DELETED',
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

export interface AuditEntry {
  userId: string;
  action: AuditAction;
  entityType: 'USER' | 'PROJECT' | 'TASK';
  entityId?: string | null;
  summary: string;
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string | null;
}

type Client = Prisma.TransactionClient | typeof prisma;

/**
 * Writes one audit row. Pass the transaction client from a `$transaction` so the log entry
 * is committed (or rolled back) together with the change it describes.
 */
export function recordAudit(client: Client, entry: AuditEntry) {
  return client.auditLog.create({
    data: {
      userId: entry.userId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      summary: entry.summary.slice(0, 255),
      metadata: entry.metadata,
      ipAddress: entry.ipAddress ?? null,
    },
  });
}
