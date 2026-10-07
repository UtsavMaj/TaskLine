import { formatDate, isOverdue, type DashboardStats } from '@taskline/shared';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ErrorView, OfflineBanner } from '@/components/status-views';
import { Card, LoadingView, OverdueBadge, PriorityTag, ProgressBar, SectionLabel } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { keys } from '@/lib/query';
import { radius, space, type, useColors } from '@/lib/theme';

function greeting() {
  const hour = new Date().getHours();
  return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
}

export default function DashboardScreen() {
  const c = useColors();
  const { user } = useAuth();
  const dashboard = useQuery({ queryKey: keys.dashboard, queryFn: api.dashboard });
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await dashboard.refetch().catch(() => undefined);
    setRefreshing(false);
  };

  return (
    <ScrollView
      style={{ backgroundColor: c.bg }}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[c.accent]} tintColor={c.accent} />
      }
    >
      <View style={{ marginBottom: space.lg }}>
        <Text style={[type.small, { color: c.ink3 }]}>{greeting()},</Text>
        <Text style={[type.title, { color: c.ink }]}>{user?.fullName.split(' ')[0] ?? 'there'}</Text>
      </View>

      <OfflineBanner hasData={Boolean(dashboard.data)} />

      {dashboard.data ? (
        <DashboardBody stats={dashboard.data} />
      ) : dashboard.isError ? (
        <ErrorView error={dashboard.error} onRetry={() => dashboard.refetch()} />
      ) : (
        <LoadingView label="Loading your overview…" />
      )}
    </ScrollView>
  );
}

function DashboardBody({ stats }: { stats: DashboardStats }) {
  const c = useColors();
  const router = useRouter();

  const tiles: { label: string; value: number; color?: string }[] = [
    { label: 'Total projects', value: stats.totalProjects },
    { label: 'Projects in progress', value: stats.projectsInProgress, color: c.ochre },
    { label: 'Total tasks', value: stats.totalTasks },
    { label: 'Completed tasks', value: stats.completedTasks, color: c.olive },
    { label: 'Pending tasks', value: stats.pendingTasks, color: c.accent },
    { label: 'Overdue', value: stats.overdueTasks, color: stats.overdueTasks ? c.brick : undefined },
  ];

  return (
    <View style={{ gap: space.xl }}>
      <View style={[styles.grid, { borderColor: c.line, backgroundColor: c.surface }]}>
        {tiles.map((tile, i) => (
          <View
            key={tile.label}
            style={[
              styles.tile,
              { borderColor: c.line },
              i % 2 === 0 && { borderRightWidth: 1 },
              i < tiles.length - 2 && { borderBottomWidth: 1 },
            ]}
            accessible
            accessibilityLabel={`${tile.label}: ${tile.value}`}
          >
            <Text style={[type.label, { color: c.ink3 }]}>{tile.label}</Text>
            <Text style={[styles.number, { color: tile.color ?? c.ink }]}>{tile.value}</Text>
          </View>
        ))}
      </View>

      <Card>
        <SectionLabel>Completion</SectionLabel>
        <Text style={[styles.rate, { color: c.ink }]}>{stats.completionRate}%</Text>
        <Text style={{ color: c.ink2, marginBottom: space.md }}>of all your tasks are done</Text>
        <ProgressBar value={stats.completionRate} />
      </Card>

      <View>
        <SectionLabel>Due next</SectionLabel>
        {stats.upcomingTasks.length === 0 ? (
          <Card>
            <Text style={{ color: c.ink2 }}>No open tasks with a due date. Nice.</Text>
          </Card>
        ) : (
          <View style={{ gap: space.sm }}>
            {stats.upcomingTasks.map((task) => (
              <Pressable
                key={task.id}
                onPress={() => router.push({ pathname: '/task/[id]', params: { id: task.id } })}
                style={({ pressed }) => [
                  styles.upcoming,
                  { backgroundColor: pressed ? c.sunk : c.surface, borderColor: c.line },
                ]}
              >
                <View
                  style={[
                    styles.dateChip,
                    isOverdue(task) ? { borderColor: c.brick, backgroundColor: c.brickSoft } : { borderColor: c.line },
                  ]}
                >
                  <Text style={{ color: isOverdue(task) ? c.brick : c.ink2, fontSize: 12.5, fontWeight: '600' }}>
                    {formatDate(task.dueDate).split(' ').slice(0, 2).join(' ')}
                  </Text>
                </View>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text numberOfLines={1} style={{ color: c.ink, fontWeight: '600', fontSize: 15 }}>
                    {task.name}
                  </Text>
                  <Text numberOfLines={1} style={{ color: c.ink3, fontSize: 12.5 }}>
                    {task.project.name}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  {isOverdue(task) ? <OverdueBadge /> : null}
                  <PriorityTag priority={task.priority} />
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, paddingBottom: 48 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', borderWidth: 1, borderRadius: radius.md, overflow: 'hidden' },
  tile: { width: '50%', padding: space.lg, gap: 8 },
  number: { fontSize: 34, fontWeight: '800', letterSpacing: -1, fontVariant: ['tabular-nums'] },
  rate: { fontSize: 40, fontWeight: '800', letterSpacing: -1.2 },
  upcoming: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderWidth: 1,
    borderRadius: radius.md,
  },
  dateChip: { width: 58, paddingVertical: 6, borderWidth: 1, borderRadius: radius.sm, alignItems: 'center' },
});
