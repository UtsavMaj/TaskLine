import {
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  TASK_STATUSES,
  type Task,
  type TaskPriority,
  type TaskStatus,
} from '@taskline/shared';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { ActivityIndicator, Alert, FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { api, errorMessage } from '@/lib/api';
import { invalidateAfterTaskChange, keys } from '@/lib/query';
import { syncReminders } from '@/lib/reminders';
import { space, useColors } from '@/lib/theme';

import { ErrorView, OfflineBanner } from './status-views';
import { TaskItem } from './TaskItem';
import { Chips, EmptyState, LoadingView, SearchBar } from './ui';

const PAGE_SIZE = 20;

const statusOptions: { value: TaskStatus | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'All' },
  ...TASK_STATUSES.map((value) => ({ value, label: TASK_STATUS_LABELS[value] })),
];
const priorityOptions: { value: TaskPriority | 'ANY'; label: string }[] = [
  { value: 'ANY', label: 'Any priority' },
  ...[...TASK_PRIORITIES].reverse().map((value) => ({ value, label: TASK_PRIORITY_LABELS[value] })),
];

function useDebounced<T>(value: T, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

interface TaskListViewProps {
  projectId?: string;
  /** Rendered above the filters and scrolls with the list (project summary, etc.). */
  header?: ReactElement;
}

/**
 * Searchable, filterable, infinitely scrolling task list with pull-to-refresh.
 * Search and filters are applied by the API, so results match the web app exactly.
 */
export function TaskListView({ projectId, header }: TaskListViewProps) {
  const c = useColors();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<TaskStatus | 'ALL'>('ALL');
  const [priority, setPriority] = useState<TaskPriority | 'ANY'>('ANY');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const term = useDebounced(search.trim());

  const filters = {
    projectId,
    search: term || undefined,
    status: status === 'ALL' ? undefined : status,
    priority: priority === 'ANY' ? undefined : priority,
    sortBy: 'createdAt' as const,
    order: 'desc' as const,
    limit: PAGE_SIZE,
  };

  const query = useInfiniteQuery({
    queryKey: keys.tasks(filters),
    queryFn: ({ pageParam }) => api.tasks({ ...filters, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.meta.page < last.meta.totalPages ? last.meta.page + 1 : undefined),
  });

  const tasks = query.data?.pages.flatMap((page) => page.data) ?? [];

  const onRefresh = async () => {
    setRefreshing(true);
    await query.refetch().catch(() => undefined);
    setRefreshing(false);
  };

  const toggle = useCallback(async (task: Task) => {
    setBusyId(task.id);
    try {
      await api.updateTask(task.id, { status: task.status === 'COMPLETED' ? 'PENDING' : 'COMPLETED' });
      await invalidateAfterTaskChange();
      void syncReminders();
    } catch (error) {
      Alert.alert('Couldn’t update the task', errorMessage(error));
    } finally {
      setBusyId(null);
    }
  }, []);

  const open = useCallback((task: Task) => router.push({ pathname: '/task/[id]', params: { id: task.id } }), [router]);

  const filtered = Boolean(term) || status !== 'ALL' || priority !== 'ANY';

  const listHeader = (
    <View style={styles.header}>
      {header}
      <OfflineBanner hasData={tasks.length > 0} />
      <SearchBar
        placeholder="Search tasks"
        value={search}
        onChangeText={setSearch}
        accessibilityLabel="Search tasks by name"
      />
      <Chips label="Status" options={statusOptions} value={status} onChange={setStatus} />
      <Chips label="Priority" options={priorityOptions} value={priority} onChange={setPriority} />
    </View>
  );

  return (
    <FlatList
      data={tasks}
      keyExtractor={(task) => task.id}
      renderItem={({ item }) => (
        <TaskItem task={item} showProject={!projectId} busy={busyId === item.id} onToggle={toggle} onPress={open} />
      )}
      ItemSeparatorComponent={() => <View style={{ height: space.sm }} />}
      ListHeaderComponent={listHeader}
      ListEmptyComponent={
        query.isPending ? (
          <LoadingView label="Loading tasks…" />
        ) : query.isError ? (
          <ErrorView error={query.error} onRetry={() => query.refetch()} />
        ) : filtered ? (
          <EmptyState icon="search" title="No matching tasks" message="Try another search or clear the filters." />
        ) : (
          <EmptyState title="No tasks yet" message="Tap the + button to add one." />
        )
      }
      ListFooterComponent={
        query.isFetchingNextPage ? <ActivityIndicator style={{ marginVertical: space.lg }} color={c.accent} /> : null
      }
      onEndReachedThreshold={0.4}
      onEndReached={() => {
        if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
      }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[c.accent]} tintColor={c.accent} />
      }
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      style={{ backgroundColor: c.bg }}
    />
  );
}

const styles = StyleSheet.create({
  header: { gap: space.md, marginBottom: space.md },
  content: { padding: space.lg, paddingBottom: 120 },
});
