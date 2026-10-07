import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { Fab } from '@/components/Fab';
import { TaskListView } from '@/components/TaskListView';

export default function TasksScreen() {
  const router = useRouter();
  return (
    <View style={{ flex: 1 }}>
      <TaskListView />
      <Fab label="Add task" onPress={() => router.push('/task/new')} />
    </View>
  );
}
