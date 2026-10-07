import { formatDate } from '@taskline/shared';
import { useQuery } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Fab } from '@/components/Fab';
import { ErrorView } from '@/components/status-views';
import { TaskListView } from '@/components/TaskListView';
import { Card, LoadingView, ProgressBar, StatusBadge } from '@/components/ui';
import { api } from '@/lib/api';
import { keys } from '@/lib/query';
import { space, type, useColors } from '@/lib/theme';

export default function ProjectScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const c = useColors();
  const router = useRouter();
  const project = useQuery({ queryKey: keys.project(id), queryFn: () => api.project(id) });

  if (!project.data) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        {project.isError ? <ErrorView error={project.error} onRetry={() => project.refetch()} /> : <LoadingView />}
      </View>
    );
  }

  const p = project.data;
  const summary = (
    <Card style={{ gap: space.md }}>
      <View style={styles.titleRow}>
        <Text style={[type.heading, { color: c.ink, flex: 1 }]}>{p.name}</Text>
        <StatusBadge status={p.status} />
      </View>
      {p.description ? <Text style={{ color: c.ink2, lineHeight: 20 }}>{p.description}</Text> : null}
      <ProgressBar value={p.progress} />
      <View style={styles.facts}>
        <Text style={{ color: c.ink3, fontSize: 12.5 }}>
          {p.taskCounts.completed}/{p.taskCounts.total} tasks done
        </Text>
        <Text style={{ color: c.ink3, fontSize: 12.5 }}>
          {p.startDate || p.endDate ? `${formatDate(p.startDate, '…')} → ${formatDate(p.endDate, '…')}` : 'No dates'}
        </Text>
      </View>
    </Card>
  );

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: p.name }} />
      <TaskListView projectId={p.id} header={summary} />
      <Fab
        label="Add task to this project"
        onPress={() => router.push({ pathname: '/task/new', params: { projectId: p.id } })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  facts: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 },
});
