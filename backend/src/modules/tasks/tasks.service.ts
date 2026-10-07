import type { Prisma } from '@prisma/client';
import {
  TASK_STATUS_LABELS,
  type CreateTaskData,
  type Paginated,
  type Task as TaskDto,
  type TaskListQuery,
  type UpdateTaskData,
} from '@taskline/shared';

import { AUDIT_ACTIONS, recordAudit } from '../../lib/audit';
import { HttpError } from '../../lib/http-error';
import { prisma } from '../../lib/prisma';
import { fromDateOnly, pageMeta, serializeTask } from '../../lib/serializers';
import { findOwnedProject } from '../projects/projects.service';

// Tasks don't store a user id. Ownership is always checked through the parent project
// (project.userId), so there is a single source of truth for who owns what.

const projectSummary = { select: { id: true, name: true, status: true } } as const;

const notFound = () => HttpError.notFound('Task not found');

async function findOwnedTask(userId: string, taskId: string) {
  const task = await prisma.task.findFirst({
    where: { id: taskId, project: { userId } },
    include: { project: projectSummary },
  });
  if (!task) throw notFound();
  return task;
}

/** COMPLETED stamps completedAt; moving a task back to an open status clears it. */
function completedAtFor(status: TaskDto['status'] | undefined, current: Date | null = null) {
  if (status === undefined) return undefined;
  if (status === 'COMPLETED') return current ?? new Date();
  return null;
}

export async function listTasks(userId: string, query: TaskListQuery): Promise<Paginated<TaskDto>> {
  if (query.projectId) await findOwnedProject(userId, query.projectId);

  const where: Prisma.TaskWhereInput = {
    project: { userId },
    ...(query.projectId ? { projectId: query.projectId } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.priority ? { priority: query.priority } : {}),
    ...(query.dueOn ? { dueDate: fromDateOnly(query.dueOn) } : {}),
    ...(query.search ? { name: { contains: query.search, mode: 'insensitive' } } : {}),
  };

  const orderBy: Prisma.TaskOrderByWithRelationInput[] = [
    query.sortBy === 'dueDate' ? { dueDate: { sort: query.order, nulls: 'last' } } : { [query.sortBy]: query.order },
    { createdAt: 'desc' },
    { id: 'asc' },
  ];

  const [total, tasks] = await prisma.$transaction([
    prisma.task.count({ where }),
    prisma.task.findMany({
      where,
      orderBy,
      include: { project: projectSummary },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
  ]);

  return { data: tasks.map(serializeTask), meta: pageMeta(query.page, query.limit, total) };
}

export async function getTask(userId: string, taskId: string) {
  return serializeTask(await findOwnedTask(userId, taskId));
}

export async function createTask(userId: string, data: CreateTaskData, ip?: string) {
  const project = await findOwnedProject(userId, data.projectId);

  const task = await prisma.$transaction(async (tx) => {
    const created = await tx.task.create({
      data: {
        projectId: project.id,
        name: data.name,
        description: data.description ?? null,
        priority: data.priority,
        status: data.status,
        dueDate: fromDateOnly(data.dueDate) ?? null,
        completedAt: completedAtFor(data.status) ?? null,
      },
      include: { project: projectSummary },
    });
    await recordAudit(tx, {
      userId,
      action: AUDIT_ACTIONS.TASK_CREATED,
      entityType: 'TASK',
      entityId: created.id,
      summary: `Added task "${created.name}" to "${project.name}"`,
      ipAddress: ip,
    });
    return created;
  });

  return serializeTask(task);
}

export async function updateTask(userId: string, taskId: string, data: UpdateTaskData, ip?: string) {
  const existing = await findOwnedTask(userId, taskId);

  // Moving a task is allowed, but only into another project the user owns.
  if (data.projectId && data.projectId !== existing.projectId) {
    await findOwnedProject(userId, data.projectId);
  }

  const justCompleted = data.status === 'COMPLETED' && existing.status !== 'COMPLETED';
  const statusChanged = data.status !== undefined && data.status !== existing.status;

  const task = await prisma.$transaction(async (tx) => {
    const updated = await tx.task.update({
      where: { id: existing.id },
      data: {
        projectId: data.projectId,
        name: data.name,
        description: data.description,
        priority: data.priority,
        status: data.status,
        dueDate: fromDateOnly(data.dueDate),
        completedAt: completedAtFor(data.status, existing.completedAt),
      },
      include: { project: projectSummary },
    });

    let summary = `Edited task "${updated.name}"`;
    if (justCompleted) summary = `Completed task "${updated.name}"`;
    else if (statusChanged)
      summary = `Moved task "${updated.name}" to ${TASK_STATUS_LABELS[updated.status].toLowerCase()}`;

    await recordAudit(tx, {
      userId,
      action: justCompleted ? AUDIT_ACTIONS.TASK_COMPLETED : AUDIT_ACTIONS.TASK_UPDATED,
      entityType: 'TASK',
      entityId: updated.id,
      summary,
      metadata: { fields: Object.keys(data).filter((key) => data[key as keyof UpdateTaskData] !== undefined) },
      ipAddress: ip,
    });
    return updated;
  });

  return serializeTask(task);
}

export async function deleteTask(userId: string, taskId: string, ip?: string) {
  const existing = await findOwnedTask(userId, taskId);
  await prisma.$transaction(async (tx) => {
    await tx.task.delete({ where: { id: existing.id } });
    await recordAudit(tx, {
      userId,
      action: AUDIT_ACTIONS.TASK_DELETED,
      entityType: 'TASK',
      entityId: null,
      summary: `Deleted task "${existing.name}" from "${existing.project.name}"`,
      ipAddress: ip,
    });
  });
}
