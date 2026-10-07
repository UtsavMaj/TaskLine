import {
  formatDate,
  PROJECT_STATUS_LABELS,
  PROJECT_STATUSES,
  type Project,
  type ProjectStatus,
} from '@taskline/shared';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { ErrorView, OfflineBanner } from '@/components/status-views';
import { Chips, EmptyState, LoadingView, ProgressBar, SearchBar, StatusBadge } from '@/components/ui';
import { api } from '@/lib/api';
import { keys } from '@/lib/query';
import { radius, space, useColors } from '@/lib/theme';

const statusOptions: { value: ProjectStatus | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'All' },
  ...PROJECT_STATUSES.map((value) => ({ value, label: PROJECT_STATUS_LABELS[value] })),
];

export default function ProjectsScreen() {
  const c = useColors();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [term, setTerm] = useState('');
  const [status, setStatus] = useState<ProjectStatus | 'ALL'>('ALL');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setTerm(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const filters = { search: term || undefined, status: status === 'ALL' ? undefined : status, limit: 15 };
  const query = useInfiniteQuery({
    queryKey: keys.projects(filters),
    queryFn: ({ pageParam }) => api.projects({ ...filters, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.meta.page < last.meta.totalPages ? last.meta.page + 1 : undefined),
  });
  const projects = query.data?.pages.flatMap((page) => page.data) ?? [];

  const onRefresh = async () => {
    setRefreshing(true);
    await query.refetch().catch(() => undefined);
    setRefreshing(false);
  };

  return (
    <FlatList
      style={{ backgroundColor: c.bg }}
      contentContainerStyle={styles.content}
      data={projects}
      keyExtractor={(project) => project.id}
      renderItem={({ item }) => (
        <ProjectCard
          project={item}
          onPress={() => router.push({ pathname: '/project/[id]', params: { id: item.id } })}
        />
      )}
      ItemSeparatorComponent={() => <View style={{ height: space.md }} />}
      ListHeaderComponent={
        <View style={styles.header}>
          <OfflineBanner hasData={projects.length > 0} />
          <SearchBar
            placeholder="Search projects"
            value={search}
            onChangeText={setSearch}
            accessibilityLabel="Search projects by name"
          />
          <Chips label="Status" options={statusOptions} value={status} onChange={setStatus} />
        </View>
      }
      ListEmptyComponent={
        query.isPending ? (
          <LoadingView label="Loading projects…" />
        ) : query.isError ? (
          <ErrorView error={query.error} onRetry={() => query.refetch()} />
        ) : (
          <EmptyState
            icon="folder"
            title={term || status !== 'ALL' ? 'No projects match' : 'No projects yet'}
            message={
              term || status !== 'ALL' ? 'Try another name or status.' : 'Projects you create on the web show up here.'
            }
          />
        )
      }
      ListFooterComponent={
        query.isFetchingNextPage ? <ActivityIndicator color={c.accent} style={{ margin: space.lg }} /> : null
      }
      onEndReachedThreshold={0.4}
      onEndReached={() => {
        if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
      }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[c.accent]} tintColor={c.accent} />
      }
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    />
  );
}

function ProjectCard({ project, onPress }: { project: Project; onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.card, { backgroundColor: pressed ? c.sunk : c.surface, borderColor: c.line }]}
    >
      <View style={styles.cardTop}>
        <Text style={[styles.name, { color: c.ink }]} numberOfLines={2}>
          {project.name}
        </Text>
        <StatusBadge status={project.status} />
      </View>
      {project.description ? (
        <Text style={{ color: c.ink2, fontSize: 13.5 }} numberOfLines={2}>
          {project.description}
        </Text>
      ) : null}
      <ProgressBar value={project.progress} />
      <View style={styles.cardBottom}>
        <Text style={{ color: c.ink3, fontSize: 12.5 }}>
          {project.taskCounts.completed} of {project.taskCounts.total} tasks done
        </Text>
        {project.endDate ? (
          <Text style={{ color: c.ink3, fontSize: 12.5 }}>Ends {formatDate(project.endDate)}</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, paddingBottom: 48 },
  header: { gap: space.md, marginBottom: space.lg },
  card: { padding: space.lg, borderWidth: 1, borderRadius: radius.md, gap: space.md },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: space.md },
  name: { flex: 1, fontSize: 16.5, fontWeight: '700' },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between' },
});
