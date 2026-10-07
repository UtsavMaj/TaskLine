import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { focusManager, onlineManager, QueryClient } from '@tanstack/react-query';
import { AppState, Platform } from 'react-native';

import { ApiError } from './api';

/**
 * Server state lives in TanStack Query. The cache is also written to AsyncStorage, which is
 * what lets the app show the last loaded projects and tasks with no connection (offline viewing).
 * Only API data is persisted here; tokens stay in SecureStore.
 */

const DAY = 24 * 60 * 60 * 1000;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      gcTime: DAY, // must be >= maxAge below or persisted entries get dropped
      // 'always' = try even when NetInfo says offline: the request fails fast with a clear
      // "no internet" error instead of sitting in a paused state with a spinner.
      networkMode: 'always',
      retry: (count, error) => {
        if (error instanceof ApiError && (error.isNetworkError || error.status < 500)) return false;
        return count < 2;
      },
    },
    mutations: { networkMode: 'always', retry: false },
  },
});

export const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'taskline.query-cache',
  throttleTime: 1000,
});

export const persistOptions = {
  persister,
  maxAge: DAY,
  buster: 'v1',
};

// React Query doesn't know about React Native's network and app state by itself.
onlineManager.setEventListener((setOnline) =>
  NetInfo.addEventListener((state) => {
    setOnline(Boolean(state.isConnected) && state.isInternetReachable !== false);
  }),
);

if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (status) => focusManager.setFocused(status === 'active'));
}

export const keys = {
  dashboard: ['dashboard'] as const,
  projects: (filters: object) => ['projects', 'list', filters] as const,
  project: (id: string) => ['projects', 'detail', id] as const,
  tasks: (filters: object) => ['tasks', 'list', filters] as const,
  task: (id: string) => ['tasks', 'detail', id] as const,
};

/** After any write, everything that could show the changed task is refetched. */
export function invalidateAfterTaskChange() {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ['tasks'] }),
    queryClient.invalidateQueries({ queryKey: ['projects'] }),
    queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
  ]);
}
