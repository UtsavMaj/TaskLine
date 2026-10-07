import type { LoginInput, RegisterInput, User } from '@taskline/shared';
import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { onSessionExpired, refreshSession, setAccessToken } from '@/api/client';
import { authApi } from '@/api/endpoints';

type Status = 'loading' | 'authenticated' | 'anonymous';

interface AuthContextValue {
  status: Status;
  user: User | null;
  /** Why the user was signed out, shown on the login page. */
  signedOutReason: 'expired' | null;
  bootError: string | null;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  retryBoot: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<Status>('loading');
  const [user, setUser] = useState<User | null>(null);
  const [signedOutReason, setSignedOutReason] = useState<'expired' | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);
  const [bootAttempt, setBootAttempt] = useState(0);

  // On first load the access token is gone (it was only in memory), so try the refresh cookie.
  useEffect(() => {
    let cancelled = false;
    setBootError(null);
    refreshSession()
      .then((session) => {
        if (cancelled) return;
        setUser(session?.user ?? null);
        setStatus(session ? 'authenticated' : 'anonymous');
      })
      .catch((error: Error) => {
        if (cancelled) return;
        setBootError(error.message);
        setStatus('anonymous');
      });
    return () => {
      cancelled = true;
    };
  }, [bootAttempt]);

  useEffect(
    () =>
      onSessionExpired(() => {
        setUser(null);
        setStatus('anonymous');
        setSignedOutReason('expired');
        queryClient.clear();
      }),
    [queryClient],
  );

  const login = useCallback(async (input: LoginInput) => {
    const session = await authApi.login(input);
    setAccessToken(session.accessToken);
    setSignedOutReason(null);
    setUser(session.user);
    setStatus('authenticated');
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    const session = await authApi.register(input);
    setAccessToken(session.accessToken);
    setSignedOutReason(null);
    setUser(session.user);
    setStatus('authenticated');
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // Even if the server can't be reached we still drop the local session.
    }
    setAccessToken(null);
    setUser(null);
    setSignedOutReason(null);
    setStatus('anonymous');
    queryClient.clear();
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      signedOutReason,
      bootError,
      login,
      register,
      logout,
      retryBoot: () => setBootAttempt((n) => n + 1),
    }),
    [status, user, signedOutReason, bootError, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
