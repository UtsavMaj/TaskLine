import { TaskList } from '@/components/tasks/TaskList';

export function TasksPage() {
  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>All tasks</h1>
          <p className="lede">
            Every task across your projects. Search, filter by status or priority, and tick things off.
          </p>
        </div>
      </header>
      <TaskList title="Task list" />
    </div>
  );
}
