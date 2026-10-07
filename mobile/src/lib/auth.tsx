import type { LoginInput, RegisterInput, User } from '@taskline/shared';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { api, onSessionExpired, refreshSession, setAccessToken, storeSession } from './api';
import { persister, queryClient } from './query';
import { resetReminders } from './reminders';
import { secureStorage } from './secure-storage';

type Status = 'loading' | 'authenticated' | 'anonymous';

interface AuthState {
  status: Status;
  user: User | null;
  /** Set when the user was bounced to the login screen, so it can explain why. */
  notice: 'expired' | null;
  /** True when we started without network and are showing cached data. */
  startedOffline: boolean;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  clearNotice: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

async function wipeLocalSession() {
  setAccessToken(null);
  await secureStorage.clear();
  queryClient.clear();
  await persister.removeClient();
  await resetReminders();
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [user, setUser] = useState<User | null>(null);
  const [notice, setNotice] = useState<'expired' | null>(null);
  const [startedOffline, setStartedOffline] = useState(false);

  // App start: if a refresh token is stored, swap it for a fresh access token.
  useEffect(() => {
    (async () => {
      try {
        const result = await refreshSession();
        if (result.ok) {
          setUser(result.session.user);
          setStatus('authenticated');
          return;
        }
        if (result.reason === 'expired') {
          await wipeLocalSession();
          setNotice('expired');
        }
        setStatus('anonymous');
      } catch {
        // No network. If this device was signed in before, open the app with cached data
        // instead of a dead end; the first successful request will refresh the token.
        const cached = await secureStorage.get('user');
        const hasToken = Boolean(await secureStorage.get('refreshToken'));
        if (cached && hasToken) {
          setUser(JSON.parse(cached) as User);
          setStartedOffline(true);
          setStatus('authenticated');
        } else {
          setStatus('anonymous');
        }
      }
    })();
  }, []);

  useEffect(
    () =>
      onSessionExpired(() => {
        void wipeLocalSession();
        setUser(null);
        setNotice('expired');
        setStatus('anonymous');
      }),
    [],
  );

  const login = useCallback(async (input: LoginInput) => {
    const session = await api.login(input);
    await storeSession(session);
    setNotice(null);
    setStartedOffline(false);
    setUser(session.user);
    setStatus('authenticated');
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    const session = await api.register(input);
    await storeSession(session);
    setNotice(null);
    setUser(session.user);
    setStatus('authenticated');
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout(); // revokes this device's session on the server
    } catch {
      // Offline or already expired: still sign out locally.
    }
    await wipeLocalSession();
    setUser(null);
    setNotice(null);
    setStatus('anonymous');
  }, []);

  const value = useMemo<AuthState>(
    () => ({ status, user, notice, startedOffline, login, register, logout, clearNotice: () => setNotice(null) }),
    [status, user, notice, startedOffline, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
