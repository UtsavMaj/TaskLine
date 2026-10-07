import {
  CLIENT_HEADER,
  ERROR_CODES,
  type ApiErrorBody,
  type AuditLogEntry,
  type AuthResponse,
  type CreateTaskInput,
  type DashboardStats,
  type FieldError,
  type LoginInput,
  type Paginated,
  type Project,
  type ProjectStatus,
  type RegisterInput,
  type Task,
  type TaskPriority,
  type TaskSortField,
  type TaskStatus,
  type SortOrder,
  type UpdateTaskInput,
  type User,
  todayLocal,
} from '@taskline/shared';

import { API_BASE, REQUEST_TIMEOUT_MS } from './config';
import { secureStorage } from './secure-storage';

export type ClientErrorCode = ApiErrorBody['error']['code'] | 'NETWORK_ERROR';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ClientErrorCode,
    message: string,
    public readonly details: FieldError[] = [],
  ) {
    super(message);
    this.name = 'ApiError';
  }

  get isNetworkError() {
    return this.code === 'NETWORK_ERROR';
  }
}

export function errorMessage(error: unknown, fallback = 'Something went wrong. Please try again.') {
  return error instanceof ApiError ? error.message : fallback;
}

const networkError = () =>
  new ApiError(0, 'NETWORK_ERROR', 'Can’t reach the Taskline server. Check your internet connection and try again.');

// ---- session plumbing ------------------------------------------------------
// The access token is short-lived and kept in memory only. The refresh token lives in
// the Android Keystore (see secure-storage.ts) and is rotated on every refresh.

let accessToken: string | null = null;
export const setAccessToken = (token: string | null) => {
  accessToken = token;
};

type Listener = () => void;
const expiredListeners = new Set<Listener>();
export function onSessionExpired(listener: Listener) {
  expiredListeners.add(listener);
  return () => {
    expiredListeners.delete(listener);
  };
}

async function fetchWithTimeout(url: string, init: RequestInit) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch {
    throw networkError();
  } finally {
    clearTimeout(timer);
  }
}

export type RefreshResult = { ok: true; session: AuthResponse } | { ok: false; reason: 'expired' | 'missing' };

let refreshInFlight: Promise<RefreshResult> | null = null;

/**
 * Trades the stored refresh token for a new access token (and a rotated refresh token).
 * Shared between concurrent callers, rotating twice in parallel would revoke the session.
 * Throws a NETWORK_ERROR ApiError when the server can't be reached.
 */
export function refreshSession(): Promise<RefreshResult> {
  refreshInFlight ??= (async (): Promise<RefreshResult> => {
    try {
      const refreshToken = await secureStorage.get('refreshToken');
      if (!refreshToken) return { ok: false, reason: 'missing' };

      const res = await fetchWithTimeout(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', [CLIENT_HEADER]: 'mobile' },
        body: JSON.stringify({ refreshToken }),
      });

      if (res.status === 401 || res.status === 400) {
        await secureStorage.remove('refreshToken');
        setAccessToken(null);
        return { ok: false, reason: 'expired' };
      }
      if (!res.ok)
        throw new ApiError(res.status, ERROR_CODES.INTERNAL_ERROR, 'The server had a problem. Try again shortly.');

      const session = (await res.json()) as AuthResponse;
      await storeSession(session);
      return { ok: true, session };
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

export async function storeSession(session: AuthResponse) {
  setAccessToken(session.accessToken);
  if (session.refreshToken) await secureStorage.set('refreshToken', session.refreshToken);
  await secureStorage.set('user', JSON.stringify(session.user));
}

// ---- requests --------------------------------------------------------------

type QueryValue = string | number | null | undefined;

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  query?: Record<string, QueryValue>;
  auth?: boolean;
}

function buildUrl(path: string, query?: Record<string, QueryValue>) {
  const parts = Object.entries(query ?? {})
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  return `${API_BASE}${path}${parts.length ? `?${parts.join('&')}` : ''}`;
}

function send(path: string, options: RequestOptions) {
  const headers: Record<string, string> = { Accept: 'application/json', [CLIENT_HEADER]: 'mobile' };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.auth !== false && accessToken) headers.Authorization = `Bearer ${accessToken}`;
  return fetchWithTimeout(buildUrl(path, options.query), {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
}

async function toApiError(res: Response) {
  try {
    const body = (await res.json()) as ApiErrorBody;
    return new ApiError(res.status, body.error.code, body.error.message, body.error.details);
  } catch {
    return new ApiError(res.status, ERROR_CODES.INTERNAL_ERROR, `Request failed (${res.status})`);
  }
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let res = await send(path, options);

  if (res.status === 401 && options.auth !== false) {
    const refreshed = await refreshSession();
    if (refreshed.ok) res = await send(path, options);
    if (!refreshed.ok || res.status === 401) {
      setAccessToken(null);
      await secureStorage.remove('refreshToken');
      expiredListeners.forEach((listener) => listener());
      throw new ApiError(401, ERROR_CODES.SESSION_EXPIRED, 'Your session has expired. Please sign in again.');
    }
  }

  if (!res.ok) throw await toApiError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// ---- endpoints (same API the web app uses) ------------------------------------

export interface TaskQuery {
  projectId?: string;
  search?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueOn?: string;
  sortBy?: TaskSortField;
  order?: SortOrder;
  page?: number;
  limit?: number;
}

export interface ProjectQuery {
  search?: string;
  status?: ProjectStatus;
  page?: number;
  limit?: number;
}

export const api = {
  login: (body: LoginInput) => request<AuthResponse>('/auth/login', { method: 'POST', body, auth: false }),
  register: (body: RegisterInput) => request<AuthResponse>('/auth/register', { method: 'POST', body, auth: false }),
  logout: () => request<void>('/auth/logout', { method: 'POST' }),
  me: () => request<{ user: User }>('/auth/me'),

  dashboard: () => request<DashboardStats>('/dashboard', { query: { today: todayLocal() } }),

  projects: (query: ProjectQuery) =>
    request<Paginated<Project>>('/projects', { query: { sortBy: 'createdAt', order: 'desc', ...query } }),
  project: (id: string) => request<{ project: Project }>(`/projects/${id}`).then((r) => r.project),

  tasks: (query: TaskQuery) => request<Paginated<Task>>('/tasks', { query: { ...query } }),
  task: (id: string) => request<{ task: Task }>(`/tasks/${id}`).then((r) => r.task),
  createTask: (body: CreateTaskInput) =>
    request<{ task: Task }>('/tasks', { method: 'POST', body }).then((r) => r.task),
  updateTask: (id: string, body: UpdateTaskInput) =>
    request<{ task: Task }>(`/tasks/${id}`, { method: 'PUT', body }).then((r) => r.task),
  deleteTask: (id: string) => request<void>(`/tasks/${id}`, { method: 'DELETE' }),

  activity: (page = 1) => request<Paginated<AuditLogEntry>>('/audit-logs', { query: { page, limit: 20 } }),

  registerPushToken: (token: string, timezone: string) =>
    request<void>('/push-tokens', { method: 'POST', body: { token, timezone } }),
  removePushToken: (token: string) => request<void>('/push-tokens', { method: 'DELETE', body: { token } }),
};
