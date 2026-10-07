import { afterEach, describe, expect, it, vi } from 'vitest';

import { apiRequest, ApiError, onSessionExpired, setAccessToken } from './client';

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

const expired = { error: { code: 'TOKEN_EXPIRED', message: 'expired' } };

afterEach(() => {
  vi.unstubAllGlobals();
  setAccessToken(null);
});

describe('apiRequest', () => {
  it('refreshes once on 401 and retries with the new token', async () => {
    setAccessToken('old-token');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json(401, expired))
      .mockResolvedValueOnce(json(200, { accessToken: 'new-token', user: {} }))
      .mockResolvedValueOnce(json(200, { ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiRequest('/projects')).resolves.toEqual({ ok: true });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1]![0]).toMatch(/\/api\/auth\/refresh$/);
    const retryHeaders = fetchMock.mock.calls[2]![1].headers as Record<string, string>;
    expect(retryHeaders.Authorization).toBe('Bearer new-token');
  });

  it('ends the session when the refresh token is no longer valid', async () => {
    setAccessToken('old-token');
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(json(401, expired))
        .mockResolvedValueOnce(json(401, { error: { code: 'SESSION_EXPIRED', message: 'gone' } })),
    );
    const listener = vi.fn();
    const unsubscribe = onSessionExpired(listener);

    const error = await apiRequest('/projects').catch((e: unknown) => e);
    unsubscribe();

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe('SESSION_EXPIRED');
    expect(listener).toHaveBeenCalledOnce();
  });

  it('turns API errors into ApiError with field details', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(
        json(400, {
          error: { code: 'VALIDATION_ERROR', message: 'Check fields', details: [{ field: 'name', message: 'Required' }] },
        }),
      ),
    );
    const error = (await apiRequest('/projects', { method: 'POST', body: {} }).catch((e: unknown) => e)) as ApiError;
    expect(error.status).toBe(400);
    expect(error.details).toEqual([{ field: 'name', message: 'Required' }]);
  });

  it('reports a friendly message when the network is down', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new TypeError('Failed to fetch')));
    const error = (await apiRequest('/dashboard').catch((e: unknown) => e)) as ApiError;
    expect(error.isNetworkError).toBe(true);
    expect(error.message).toMatch(/can’t reach the server/i);
  });
});
