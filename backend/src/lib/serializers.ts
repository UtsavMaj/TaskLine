import type { AuditLog, Project, Task, User } from '@prisma/client';
import type { AuditLogEntry, Project as ProjectDto, Task as TaskDto, User as UserDto } from '@taskline/shared';

/**
 * Database rows never go to the client as-is. Each response is built field by field here,
 * so columns like password_hash or token hashes can't leak by accident when the schema grows.
 */

/** DATE columns come back as UTC midnight; turn them into plain YYYY-MM-DD strings. */
export function toDateOnly(value: Date | null): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

/** YYYY-MM-DD -> Date for a DATE column. `undefined` means "leave as is", `null` clears it. */
export function fromDateOnly(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return new Date(`${value}T00:00:00.000Z`);
}

export function serializeUser(user: Pick<User, 'id' | 'fullName' | 'email' | 'role' | 'createdAt'>): UserDto {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
  };
}

export function serializeProject(project: Project, counts: { total: number; completed: number }): ProjectDto {
  return {
    id: project.id,
    name: project.name,
    description: project.description,
    status: project.status,
    startDate: toDateOnly(project.startDate),
    endDate: toDateOnly(project.endDate),
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
    taskCounts: counts,
    progress: counts.total === 0 ? 0 : Math.round((counts.completed / counts.total) * 100),
  };
}

export type TaskWithProject = Task & { project: Pick<Project, 'id' | 'name' | 'status'> };

export function serializeTask(task: TaskWithProject): TaskDto {
  return {
    id: task.id,
    projectId: task.projectId,
    project: { id: task.project.id, name: task.project.name, status: task.project.status },
    name: task.name,
    description: task.description,
    priority: task.priority,
    status: task.status,
    dueDate: toDateOnly(task.dueDate),
    completedAt: task.completedAt?.toISOString() ?? null,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
}

export function serializeAuditLog(log: AuditLog): AuditLogEntry {
  return {
    id: log.id,
    action: log.action,
    entityType: log.entityType,
    entityId: log.entityId,
    summary: log.summary,
    createdAt: log.createdAt.toISOString(),
  };
}

export function pageMeta(page: number, limit: number, total: number) {
  return { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
}
