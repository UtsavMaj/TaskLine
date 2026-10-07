import type { CreateTaskData } from '@taskline/shared';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';

import { ErrorView } from '@/components/status-views';
import { TaskForm } from '@/components/TaskForm';
import { Button, LoadingView } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { invalidateAfterTaskChange, keys, queryClient } from '@/lib/query';
import { syncReminders } from '@/lib/reminders';
import { space, useColors } from '@/lib/theme';

export default function EditTaskScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const c = useColors();
  const [deleting, setDeleting] = useState(false);
  const task = useQuery({ queryKey: keys.task(id), queryFn: () => api.task(id) });

  if (!task.data) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        {task.isError ? <ErrorView error={task.error} onRetry={() => task.refetch()} /> : <LoadingView />}
      </View>
    );
  }

  const save = async (data: CreateTaskData) => {
    await api.updateTask(id, data);
    await invalidateAfterTaskChange();
    void syncReminders();
    router.back();
  };

  const remove = () => {
    Alert.alert('Delete this task?', `“${task.data.name}” will be removed on all your devices.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setDeleting(true);
          try {
            await api.deleteTask(id);
            queryClient.removeQueries({ queryKey: keys.task(id) });
            await invalidateAfterTaskChange();
            void syncReminders();
            router.back();
          } catch (error) {
            setDeleting(false);
            Alert.alert('Couldn’t delete the task', errorMessage(error));
          }
        },
      },
    ]);
  };

  return (
    <TaskForm
      task={task.data}
      submitLabel="Save changes"
      onSubmit={save}
      footer={
        <Button
          title="Delete task"
          variant="danger"
          icon="trash-2"
          loading={deleting}
          onPress={remove}
          style={{ marginTop: space.sm }}
        />
      }
    />
  );
}
