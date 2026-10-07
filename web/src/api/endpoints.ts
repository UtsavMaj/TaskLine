import type {
  AuditLogEntry,
  AuthResponse,
  CreateProjectInput,
  CreateTaskInput,
  DashboardStats,
  LoginInput,
  Paginated,
  Project,
  ProjectSortField,
  ProjectStatus,
  RegisterInput,
  SortOrder,
  Task,
  TaskPriority,
  TaskSortField,
  TaskStatus,
  UpdateProjectInput,
  UpdateTaskInput,
  User,
} from '@taskline/shared';
import { todayLocal } from '@taskline/shared';

import { apiRequest } from './client';

export interface ProjectListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: ProjectStatus | '';
  sortBy?: ProjectSortField;
  order?: SortOrder;
}

export interface TaskListParams {
  page?: number;
  limit?: number;
  projectId?: string;
  search?: string;
  status?: TaskStatus | '';
  priority?: TaskPriority | '';
  sortBy?: TaskSortField;
  order?: SortOrder;
}

export const authApi = {
  login: (body: LoginInput) => apiRequest<AuthResponse>('/auth/login', { method: 'POST', body, auth: false }),
  register: (body: RegisterInput) => apiRequest<AuthResponse>('/auth/register', { method: 'POST', body, auth: false }),
  logout: () => apiRequest<void>('/auth/logout', { method: 'POST' }),
  me: () => apiRequest<{ user: User }>('/auth/me'),
};

export const projectsApi = {
  list: (params: ProjectListParams, signal?: AbortSignal) =>
    apiRequest<Paginated<Project>>('/projects', { query: { ...params }, signal }),
  get: (id: string, signal?: AbortSignal) => apiRequest<{ project: Project }>(`/projects/${id}`, { signal }),
  create: (body: CreateProjectInput) => apiRequest<{ project: Project }>('/projects', { method: 'POST', body }),
  update: (id: string, body: UpdateProjectInput) =>
    apiRequest<{ project: Project }>(`/projects/${id}`, { method: 'PUT', body }),
  remove: (id: string) => apiRequest<void>(`/projects/${id}`, { method: 'DELETE' }),
};

export const tasksApi = {
  list: (params: TaskListParams, signal?: AbortSignal) =>
    apiRequest<Paginated<Task>>('/tasks', { query: { ...params }, signal }),
  get: (id: string) => apiRequest<{ task: Task }>(`/tasks/${id}`),
  create: (body: CreateTaskInput) => apiRequest<{ task: Task }>('/tasks', { method: 'POST', body }),
  update: (id: string, body: UpdateTaskInput) => apiRequest<{ task: Task }>(`/tasks/${id}`, { method: 'PUT', body }),
  remove: (id: string) => apiRequest<void>(`/tasks/${id}`, { method: 'DELETE' }),
};

export const dashboardApi = {
  get: (signal?: AbortSignal) => apiRequest<DashboardStats>('/dashboard', { query: { today: todayLocal() }, signal }),
};

export const auditApi = {
  list: (page: number, signal?: AbortSignal) =>
    apiRequest<Paginated<AuditLogEntry>>('/audit-logs', { query: { page, limit: 25 }, signal }),
};
