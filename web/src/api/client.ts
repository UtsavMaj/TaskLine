import { CLIENT_HEADER, ERROR_CODES, type ApiErrorBody, type AuthResponse, type FieldError } from '@taskline/shared';

/**
 * Thin fetch wrapper used by every API call in the web app.
 *
 *  - The access token lives only in memory (never localStorage), so an XSS bug can't lift a
 *    long-lived credential. The refresh token is an httpOnly cookie the browser handles.
 *  - On a 401 TOKEN_EXPIRED it refreshes once (shared between parallel requests) and retries.
 *  - If the refresh fails the session is over: listeners are told, and the app sends the user
 *    to the login page with an explanation.
 */

const API_BASE = `${(import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')}/api`;

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

let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

type Listener = () => void;
const sessionExpiredListeners = new Set<Listener>();

export function onSessionExpired(listener: Listener) {
  sessionExpiredListeners.add(listener);
  return () => {
    sessionExpiredListeners.delete(listener);
  };
}

const networkError = () =>
  new ApiError(0, 'NETWORK_ERROR', 'Can’t reach the server. Check your internet connection and try again.');

let refreshInFlight: Promise<AuthResponse | null> | null = null;

/** Exchanges the refresh cookie for a new access token. Resolves null when there is no valid session. */
export function refreshSession(): Promise<AuthResponse | null> {
  refreshInFlight ??= (async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { [CLIENT_HEADER]: 'web', 'Content-Type': 'application/json' },
        body: '{}',
      });
      if (!res.ok) {
        setAccessToken(null);
        return null;
      }
      const body = (await res.json()) as AuthResponse;
      setAccessToken(body.accessToken);
      return body;
    } catch {
      throw networkError();
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

type QueryValue = string | number | boolean | null | undefined;

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  query?: Record<string, QueryValue>;
  signal?: AbortSignal;
  /** Set to false for login/register: a 401 there is a wrong password, not an expired session. */
  auth?: boolean;
}

function buildUrl(path: string, query?: Record<string, QueryValue>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  }
  const qs = params.toString();
  return `${API_BASE}${path}${qs ? `?${qs}` : ''}`;
}

async function send(path: string, options: RequestOptions) {
  const headers: Record<string, string> = { [CLIENT_HEADER]: 'web', Accept: 'application/json' };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.auth !== false && accessToken) headers.Authorization = `Bearer ${accessToken}`;

  try {
    return await fetch(buildUrl(path, options.query), {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      credentials: 'include',
      signal: options.signal,
    });
  } catch (error) {
    if ((error as Error).name === 'AbortError') throw error;
    throw networkError();
  }
}

async function toApiError(res: Response) {
  try {
    const body = (await res.json()) as ApiErrorBody;
    return new ApiError(res.status, body.error.code, body.error.message, body.error.details);
  } catch {
    return new ApiError(res.status, ERROR_CODES.INTERNAL_ERROR, `Request failed (${res.status})`);
  }
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let res = await send(path, options);

  if (res.status === 401 && options.auth !== false) {
    const refreshed = await refreshSession().catch(() => null);
    if (refreshed) {
      res = await send(path, options);
    }
    if (!refreshed || res.status === 401) {
      setAccessToken(null);
      sessionExpiredListeners.forEach((listener) => listener());
      throw new ApiError(401, ERROR_CODES.SESSION_EXPIRED, 'Your session has expired. Please sign in again.');
    }
  }

  if (!res.ok) throw await toApiError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** Friendly message for any error thrown by a query or mutation. */
export function errorMessage(error: unknown, fallback = 'Something went wrong. Please try again.') {
  if (error instanceof ApiError) return error.message;
  return fallback;
}
