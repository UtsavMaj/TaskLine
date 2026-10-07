import { useEffect, useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { Button, Card, SectionLabel } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { API_URL } from '@/lib/config';
import { reminderMode, remindersEnabled, remindersSupported, setRemindersEnabled } from '@/lib/reminders';
import { space, type, useColors } from '@/lib/theme';

export default function AccountScreen() {
  const c = useColors();
  const { user, logout } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const [reminders, setReminders] = useState(false);
  const [mode, setMode] = useState<'push' | 'local' | null>(null);

  useEffect(() => {
    remindersEnabled().then(setReminders);
    reminderMode().then(setMode);
  }, []);

  const toggleReminders = async (next: boolean) => {
    const result = await setRemindersEnabled(next);
    setReminders(result);
    setMode(await reminderMode());
    if (next && !result) {
      Alert.alert('Notifications are off', 'Allow notifications for Taskline in your phone settings to get reminders.');
    }
  };

  const confirmLogout = () => {
    Alert.alert('Sign out?', 'You can sign back in with the same account on any device.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          setSigningOut(true);
          await logout();
        },
      },
    ]);
  };

  const initials = (user?.fullName ?? '?')
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  return (
    <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={styles.content}>
      <Card style={styles.profile}>
        <View style={[styles.avatar, { backgroundColor: c.accentSoft }]}>
          <Text style={{ color: c.accent, fontWeight: '800', fontSize: 18 }}>{initials}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[type.heading, { color: c.ink }]}>{user?.fullName}</Text>
          <Text style={{ color: c.ink2 }}>{user?.email}</Text>
        </View>
      </Card>

      <View>
        <SectionLabel>Reminders</SectionLabel>
        <Card style={styles.settingRow}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ color: c.ink, fontWeight: '600', fontSize: 15 }}>Tasks due tomorrow</Text>
            <Text style={{ color: c.ink2, fontSize: 13 }}>
              {!remindersSupported
                ? 'Available in the installed app (APK). Expo Go doesn’t support notifications.'
                : reminders && mode === 'push'
                  ? 'Push notification from the server at 6 pm the evening before.'
                  : 'A notification at 6 pm the evening before.'}
            </Text>
          </View>
          <Switch
            value={reminders}
            onValueChange={toggleReminders}
            disabled={!remindersSupported}
            trackColor={{ true: c.accent, false: c.lineStrong }}
            thumbColor="#fff"
            accessibilityLabel="Remind me about tasks due tomorrow"
          />
        </Card>
      </View>

      <View>
        <SectionLabel>About</SectionLabel>
        <Card style={{ gap: 6 }}>
          <Text style={{ color: c.ink2, fontSize: 13 }}>Connected to</Text>
          <Text style={{ color: c.ink, fontFamily: Platform.select({ android: 'monospace', ios: 'Menlo' }) }}>
            {API_URL}
          </Text>
          <Text style={{ color: c.ink3, fontSize: 12.5, marginTop: 6 }}>
            Same account and data as the Taskline web app. Pull down on any list to refresh.
          </Text>
        </Card>
      </View>

      <Button title="Sign out" variant="danger" icon="log-out" loading={signingOut} onPress={confirmLogout} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, gap: space.xl, paddingBottom: 48 },
  profile: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  avatar: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  settingRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
});
