import type { CreateTaskData } from '@taskline/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { TaskForm } from '@/components/TaskForm';
import { api } from '@/lib/api';
import { invalidateAfterTaskChange } from '@/lib/query';
import { syncReminders } from '@/lib/reminders';

export default function NewTaskScreen() {
  const { projectId } = useLocalSearchParams<{ projectId?: string }>();
  const router = useRouter();

  const create = async (data: CreateTaskData) => {
    await api.createTask(data);
    await invalidateAfterTaskChange();
    void syncReminders();
    router.back();
  };

  return <TaskForm projectId={projectId} submitLabel="Add task" onSubmit={create} />;
}
