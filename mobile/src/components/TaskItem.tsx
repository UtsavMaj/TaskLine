import Feather from '@expo/vector-icons/Feather';
import { formatDate, isOverdue, type Task } from '@taskline/shared';
import { memo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { radius, space, useColors } from '@/lib/theme';

import { OverdueBadge, PriorityTag, StatusBadge } from './ui';

interface TaskItemProps {
  task: Task;
  showProject?: boolean;
  busy?: boolean;
  onToggle: (task: Task) => void;
  onPress: (task: Task) => void;
}

export const TaskItem = memo(function TaskItem({ task, showProject, busy, onToggle, onPress }: TaskItemProps) {
  const c = useColors();
  const done = task.status === 'COMPLETED';
  const overdue = isOverdue(task);

  return (
    <Pressable
      onPress={() => onPress(task)}
      accessibilityRole="button"
      accessibilityHint="Opens the task to edit it"
      style={({ pressed }) => [styles.row, { backgroundColor: pressed ? c.sunk : c.surface, borderColor: c.line }]}
    >
      <Pressable
        onPress={() => onToggle(task)}
        disabled={busy}
        hitSlop={10}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: done, busy }}
        accessibilityLabel={done ? `Mark ${task.name} as not done` : `Mark ${task.name} as done`}
        style={[
          styles.check,
          done
            ? { backgroundColor: c.olive, borderColor: c.olive }
            : { borderColor: c.lineStrong, backgroundColor: c.surface },
        ]}
      >
        {busy ? (
          <ActivityIndicator size="small" color={done ? '#fff' : c.ink3} />
        ) : done ? (
          <Feather name="check" size={15} color="#fff" />
        ) : null}
      </Pressable>

      <View style={styles.body}>
        <Text
          numberOfLines={2}
          style={[styles.name, { color: done ? c.ink3 : c.ink, textDecorationLine: done ? 'line-through' : 'none' }]}
        >
          {task.name}
        </Text>
        {showProject ? (
          <Text numberOfLines={1} style={[styles.project, { color: c.accent }]}>
            {task.project.name}
          </Text>
        ) : null}
        <View style={styles.meta}>
          <PriorityTag priority={task.priority} />
          {task.status !== 'PENDING' && !done ? <StatusBadge status={task.status} /> : null}
          {overdue ? <OverdueBadge /> : null}
          <Text style={[styles.due, { color: overdue ? c.brick : c.ink3 }]}>
            {task.dueDate ? formatDate(task.dueDate) : 'No due date'}
          </Text>
        </View>
      </View>
      <Feather name="chevron-right" size={18} color={c.ink3} />
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderWidth: 1,
    borderRadius: radius.md,
  },
  check: {
    width: 26,
    height: 26,
    borderRadius: 7,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, gap: 4 },
  name: { fontSize: 15.5, fontWeight: '600' },
  project: { fontSize: 13, fontWeight: '600' },
  meta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginTop: 2 },
  due: { fontSize: 12.5, fontVariant: ['tabular-nums'] },
});
