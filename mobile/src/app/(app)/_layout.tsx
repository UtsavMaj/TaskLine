import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { syncReminders } from '@/lib/reminders';
import { useColors } from '@/lib/theme';

export default function AppLayout() {
  const c = useColors();

  // Keep the "due tomorrow" reminder in step with the data whenever the app is opened.
  useEffect(() => {
    void syncReminders();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void syncReminders();
    });
    return () => sub.remove();
  }, []);

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: c.surface },
        headerTintColor: c.ink,
        headerTitleStyle: { fontWeight: '700' },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: c.bg },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="project/[id]" options={{ title: 'Project' }} />
      <Stack.Screen name="task/new" options={{ title: 'New task', presentation: 'modal' }} />
      <Stack.Screen name="task/[id]" options={{ title: 'Edit task', presentation: 'modal' }} />
    </Stack>
  );
}
