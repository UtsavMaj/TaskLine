import type { CreateProjectInput, CreateTaskInput, UpdateProjectInput, UpdateTaskInput } from '@taskline/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  auditApi,
  dashboardApi,
  projectsApi,
  tasksApi,
  type ProjectListParams,
  type TaskListParams,
} from '@/api/endpoints';

/**
 * Query keys are grouped by resource so one mutation can invalidate everything that
 * depends on it, e.g. completing a task refreshes task lists, project progress and the dashboard.
 */
export const keys = {
  dashboard: ['dashboard'] as const,
  projects: ['projects'] as const,
  projectList: (params: ProjectListParams) => ['projects', 'list', params] as const,
  project: (id: string) => ['projects', 'detail', id] as const,
  tasks: ['tasks'] as const,
  taskList: (params: TaskListParams) => ['tasks', 'list', params] as const,
  audit: (page: number) => ['audit', page] as const,
};

export function useDashboard() {
  return useQuery({ queryKey: keys.dashboard, queryFn: ({ signal }) => dashboardApi.get(signal) });
}

export function useProjects(params: ProjectListParams) {
  return useQuery({
    queryKey: keys.projectList(params),
    queryFn: ({ signal }) => projectsApi.list(params, signal),
    placeholderData: keepPreviousData, // keep the old page on screen while the next one loads
  });
}

export function useProject(id: string) {
  return useQuery({
    queryKey: keys.project(id),
    queryFn: ({ signal }) => projectsApi.get(id, signal).then((r) => r.project),
  });
}

export function useTasks(params: TaskListParams, enabled = true) {
  return useQuery({
    queryKey: keys.taskList(params),
    queryFn: ({ signal }) => tasksApi.list(params, signal),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useAuditLogs(page: number) {
  return useQuery({
    queryKey: keys.audit(page),
    queryFn: ({ signal }) => auditApi.list(page, signal),
    placeholderData: keepPreviousData,
  });
}

function useInvalidateAll() {
  const client = useQueryClient();
  return () =>
    Promise.all([
      client.invalidateQueries({ queryKey: keys.projects }),
      client.invalidateQueries({ queryKey: keys.tasks }),
      client.invalidateQueries({ queryKey: keys.dashboard }),
      client.invalidateQueries({ queryKey: ['audit'] }),
    ]);
}

export function useCreateProject() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (body: CreateProjectInput) => projectsApi.create(body).then((r) => r.project),
    onSuccess: invalidate,
  });
}

export function useUpdateProject(id: string) {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (body: UpdateProjectInput) => projectsApi.update(id, body).then((r) => r.project),
    onSuccess: invalidate,
  });
}

export function useDeleteProject() {
  const client = useQueryClient();
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (id: string) => projectsApi.remove(id),
    onSuccess: (_data, id) => {
      client.removeQueries({ queryKey: keys.project(id) });
      return invalidate();
    },
  });
}

export function useCreateTask() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (body: CreateTaskInput) => tasksApi.create(body).then((r) => r.task),
    onSuccess: invalidate,
  });
}

export function useUpdateTask() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateTaskInput }) => tasksApi.update(id, body).then((r) => r.task),
    onSuccess: invalidate,
  });
}

export function useDeleteTask() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (id: string) => tasksApi.remove(id),
    onSuccess: invalidate,
  });
}
