import {
  PROJECT_STATUSES,
  TASK_PRIORITIES,
  TASK_STATUSES,
  type DashboardStats,
  type ProjectStatus,
  type TaskPriority,
  type TaskStatus,
} from '@taskline/shared';

import { prisma } from '../../lib/prisma';
import { fromDateOnly, serializeTask } from '../../lib/serializers';

function zeroed<K extends string>(keys: readonly K[]) {
  return Object.fromEntries(keys.map((key) => [key, 0])) as Record<K, number>;
}

/**
 * All numbers come from grouped COUNT queries scoped to the signed-in user,
 * so the dashboard costs a handful of queries no matter how many tasks there are.
 *
 * @param today the client's local date (YYYY-MM-DD) so "overdue" matches what the user sees.
 */
export async function getDashboard(userId: string, today: string): Promise<DashboardStats> {
  const taskScope = { project: { userId } };
  const todayDate = fromDateOnly(today)!;

  const [projectGroups, statusGroups, priorityGroups, overdueTasks, upcoming] = await Promise.all([
    prisma.project.groupBy({ by: ['status'], where: { userId }, _count: { _all: true } }),
    prisma.task.groupBy({ by: ['status'], where: taskScope, _count: { _all: true } }),
    prisma.task.groupBy({ by: ['priority'], where: taskScope, _count: { _all: true } }),
    prisma.task.count({ where: { ...taskScope, status: { not: 'COMPLETED' }, dueDate: { lt: todayDate } } }),
    prisma.task.findMany({
      where: { ...taskScope, status: { not: 'COMPLETED' }, dueDate: { not: null } },
      orderBy: [{ dueDate: 'asc' }, { priority: 'desc' }],
      take: 6,
      include: { project: { select: { id: true, name: true, status: true } } },
    }),
  ]);

  const projectsByStatus = zeroed<ProjectStatus>(PROJECT_STATUSES);
  for (const row of projectGroups) projectsByStatus[row.status] = row._count._all;

  const tasksByStatus = zeroed<TaskStatus>(TASK_STATUSES);
  for (const row of statusGroups) tasksByStatus[row.status] = row._count._all;

  const tasksByPriority = zeroed<TaskPriority>(TASK_PRIORITIES);
  for (const row of priorityGroups) tasksByPriority[row.priority] = row._count._all;

  const totalProjects = Object.values(projectsByStatus).reduce((sum, n) => sum + n, 0);
  const totalTasks = Object.values(tasksByStatus).reduce((sum, n) => sum + n, 0);

  return {
    totalProjects,
    totalTasks,
    completedTasks: tasksByStatus.COMPLETED,
    pendingTasks: tasksByStatus.PENDING,
    inProgressTasks: tasksByStatus.IN_PROGRESS,
    overdueTasks,
    projectsInProgress: projectsByStatus.IN_PROGRESS,
    projectsByStatus,
    tasksByStatus,
    tasksByPriority,
    completionRate: totalTasks === 0 ? 0 : Math.round((tasksByStatus.COMPLETED / totalTasks) * 100),
    upcomingTasks: upcoming.map(serializeTask),
  };
}
