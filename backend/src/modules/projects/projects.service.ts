import type { Prisma, Project } from '@prisma/client';
import {
  isValidDateRange,
  type CreateProjectData,
  type Paginated,
  type Project as ProjectDto,
  type ProjectListQuery,
  type UpdateProjectData,
} from '@taskline/shared';

import { AUDIT_ACTIONS, recordAudit } from '../../lib/audit';
import { HttpError } from '../../lib/http-error';
import { prisma } from '../../lib/prisma';
import { fromDateOnly, pageMeta, serializeProject, toDateOnly } from '../../lib/serializers';

// Every query in this file is scoped by userId. A project id that belongs to someone else
// behaves exactly like one that doesn't exist (404), so ids can't be probed.

const notFound = () => HttpError.notFound('Project not found');

/** Total and completed task counts for a set of projects, in two grouped queries. */
async function taskCountsFor(projectIds: string[]) {
  const counts = new Map<string, { total: number; completed: number }>();
  if (projectIds.length === 0) return counts;

  const [totals, completed] = await Promise.all([
    prisma.task.groupBy({ by: ['projectId'], where: { projectId: { in: projectIds } }, _count: { _all: true } }),
    prisma.task.groupBy({
      by: ['projectId'],
      where: { projectId: { in: projectIds }, status: 'COMPLETED' },
      _count: { _all: true },
    }),
  ]);

  for (const id of projectIds) counts.set(id, { total: 0, completed: 0 });
  for (const row of totals) counts.get(row.projectId)!.total = row._count._all;
  for (const row of completed) counts.get(row.projectId)!.completed = row._count._all;
  return counts;
}

async function withCounts(project: Project): Promise<ProjectDto> {
  const counts = await taskCountsFor([project.id]);
  return serializeProject(project, counts.get(project.id)!);
}

export async function findOwnedProject(userId: string, projectId: string) {
  const project = await prisma.project.findFirst({ where: { id: projectId, userId } });
  if (!project) throw notFound();
  return project;
}

export async function listProjects(userId: string, query: ProjectListQuery): Promise<Paginated<ProjectDto>> {
  const where: Prisma.ProjectWhereInput = {
    userId,
    ...(query.status ? { status: query.status } : {}),
    ...(query.search ? { name: { contains: query.search, mode: 'insensitive' } } : {}),
  };

  const isNullableDate = query.sortBy === 'startDate' || query.sortBy === 'endDate';
  const orderBy: Prisma.ProjectOrderByWithRelationInput[] = [
    isNullableDate ? { [query.sortBy]: { sort: query.order, nulls: 'last' } } : { [query.sortBy]: query.order },
    { createdAt: 'desc' },
    { id: 'asc' }, // tie-breaker keeps pages stable
  ];

  const [total, projects] = await prisma.$transaction([
    prisma.project.count({ where }),
    prisma.project.findMany({
      where,
      orderBy,
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
  ]);

  const counts = await taskCountsFor(projects.map((p) => p.id));
  return {
    data: projects.map((p) => serializeProject(p, counts.get(p.id)!)),
    meta: pageMeta(query.page, query.limit, total),
  };
}

export async function getProject(userId: string, projectId: string) {
  return withCounts(await findOwnedProject(userId, projectId));
}

export async function createProject(userId: string, data: CreateProjectData, ip?: string) {
  const project = await prisma.$transaction(async (tx) => {
    const created = await tx.project.create({
      data: {
        userId,
        name: data.name,
        description: data.description ?? null,
        status: data.status,
        startDate: fromDateOnly(data.startDate) ?? null,
        endDate: fromDateOnly(data.endDate) ?? null,
      },
    });
    await recordAudit(tx, {
      userId,
      action: AUDIT_ACTIONS.PROJECT_CREATED,
      entityType: 'PROJECT',
      entityId: created.id,
      summary: `Created project "${created.name}"`,
      ipAddress: ip,
    });
    return created;
  });
  return serializeProject(project, { total: 0, completed: 0 });
}

export async function updateProject(userId: string, projectId: string, data: UpdateProjectData, ip?: string) {
  const existing = await findOwnedProject(userId, projectId);

  // The body may change only one of the two dates, so validate the range against what's stored.
  const startDate = data.startDate !== undefined ? data.startDate : toDateOnly(existing.startDate);
  const endDate = data.endDate !== undefined ? data.endDate : toDateOnly(existing.endDate);
  if (!isValidDateRange(startDate, endDate)) {
    throw HttpError.badRequest('Please check the highlighted fields', [
      { field: 'endDate', message: 'End date cannot be before the start date' },
    ]);
  }

  const project = await prisma.$transaction(async (tx) => {
    const updated = await tx.project.update({
      where: { id: existing.id },
      data: {
        name: data.name,
        description: data.description,
        status: data.status,
        startDate: fromDateOnly(data.startDate),
        endDate: fromDateOnly(data.endDate),
      },
    });
    await recordAudit(tx, {
      userId,
      action: AUDIT_ACTIONS.PROJECT_UPDATED,
      entityType: 'PROJECT',
      entityId: updated.id,
      summary:
        data.status && data.status !== existing.status
          ? `Moved project "${updated.name}" to ${data.status.replace('_', ' ').toLowerCase()}`
          : `Edited project "${updated.name}"`,
      metadata: { fields: Object.keys(data).filter((key) => data[key as keyof UpdateProjectData] !== undefined) },
      ipAddress: ip,
    });
    return updated;
  });

  return withCounts(project);
}

export async function deleteProject(userId: string, projectId: string, ip?: string) {
  const existing = await findOwnedProject(userId, projectId);
  await prisma.$transaction(async (tx) => {
    // Tasks go with it through ON DELETE CASCADE.
    await tx.project.delete({ where: { id: existing.id } });
    await recordAudit(tx, {
      userId,
      action: AUDIT_ACTIONS.PROJECT_DELETED,
      entityType: 'PROJECT',
      entityId: null,
      summary: `Deleted project "${existing.name}" and its tasks`,
      ipAddress: ip,
    });
  });
}
