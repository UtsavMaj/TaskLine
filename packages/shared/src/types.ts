import type { ErrorCode, ProjectStatus, TaskPriority, TaskStatus, UserRole } from './constants';

/** Response shapes of the REST API. Dates are ISO strings, calendar dates are YYYY-MM-DD. */

export interface User {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  createdAt: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  /** ISO timestamp when the access token stops being accepted. */
  accessTokenExpiresAt: string;
  /** Only returned to native clients; browsers get it as an httpOnly cookie. */
  refreshToken?: string;
  refreshTokenExpiresAt?: string;
}

export interface TaskCounts {
  total: number;
  completed: number;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  updatedAt: string;
  taskCounts: TaskCounts;
  /** Completed tasks / total tasks, 0-100. */
  progress: number;
}

export interface ProjectSummary {
  id: string;
  name: string;
  status: ProjectStatus;
}

export interface Task {
  id: string;
  projectId: string;
  project: ProjectSummary;
  name: string;
  description: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface Paginated<T> {
  data: T[];
  meta: PageMeta;
}

export interface DashboardStats {
  totalProjects: number;
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  inProgressTasks: number;
  overdueTasks: number;
  projectsInProgress: number;
  projectsByStatus: Record<ProjectStatus, number>;
  tasksByStatus: Record<TaskStatus, number>;
  tasksByPriority: Record<TaskPriority, number>;
  /** 0-100, completed tasks out of all tasks. */
  completionRate: number;
  /** Open tasks with the nearest due dates. */
  upcomingTasks: Task[];
}

export interface AuditLogEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  summary: string;
  createdAt: string;
}

export interface FieldError {
  field: string;
  message: string;
}

export interface ApiErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    details?: FieldError[];
    requestId?: string;
  };
}
