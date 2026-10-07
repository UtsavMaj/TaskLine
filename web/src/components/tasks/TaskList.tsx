import {
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  TASK_STATUSES,
  type CreateTaskData,
  type SortOrder,
  type Task,
  type TaskPriority,
  type TaskSortField,
  type TaskStatus,
} from '@taskline/shared';
import { Plus } from 'lucide-react';
import { useState } from 'react';

import { errorMessage } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { FilterSelect, SearchInput } from '@/components/ui/Field';
import { ConfirmDialog, Modal } from '@/components/ui/Modal';
import { Pagination } from '@/components/ui/Pagination';
import { Skeleton } from '@/components/ui/Spinner';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { useCreateTask, useDeleteTask, useTasks, useUpdateTask } from '@/hooks/queries';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';

import { TaskForm } from './TaskForm';
import { TaskRow } from './TaskRow';
import styles from './tasks.module.css';

const SORTS: { value: `${TaskSortField}:${SortOrder}`; label: string }[] = [
  { value: 'createdAt:desc', label: 'Newest first' },
  { value: 'dueDate:asc', label: 'Due date' },
  { value: 'priority:desc', label: 'Priority' },
  { value: 'name:asc', label: 'Name A–Z' },
];

const PAGE_SIZE = 15;

interface TaskListProps {
  /** Scope to one project; omit to show tasks from every project. */
  projectId?: string;
  title?: string;
}

/**
 * Search, filters, sorting and paging all happen on the server; this component only keeps
 * the current choices in state and renders whatever page comes back.
 */
export function TaskList({ projectId, title = 'Tasks' }: TaskListProps) {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<TaskStatus | ''>('');
  const [priority, setPriority] = useState<TaskPriority | ''>('');
  const [sort, setSort] = useState<(typeof SORTS)[number]['value']>('createdAt:desc');
  const [page, setPage] = useState(1);

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [deleting, setDeleting] = useState<Task | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const debouncedSearch = useDebouncedValue(search.trim());
  const [sortBy, order] = sort.split(':') as [TaskSortField, SortOrder];

  const query = useTasks({
    projectId,
    search: debouncedSearch,
    status,
    priority,
    sortBy,
    order,
    page,
    limit: PAGE_SIZE,
  });

  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();

  // Any filter change sends the user back to page 1.
  const resetPage =
    <T,>(setter: (value: T) => void) =>
    (value: T) => {
      setter(value);
      setPage(1);
    };

  const changeStatus = async (task: Task, next: TaskStatus) => {
    setBusyId(task.id);
    try {
      await updateTask.mutateAsync({ id: task.id, body: { status: next } });
      if (next === 'COMPLETED') toast.success(`“${task.name}” marked as done`);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusyId(null);
    }
  };

  const handleCreate = async (data: CreateTaskData) => {
    await createTask.mutateAsync(data);
    setCreating(false);
    toast.success('Task added');
  };

  const handleEdit = async (data: CreateTaskData) => {
    if (!editing) return;
    await updateTask.mutateAsync({ id: editing.id, body: data });
    setEditing(null);
    toast.success('Task updated');
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await deleteTask.mutateAsync(deleting.id);
      toast.success('Task deleted');
      setDeleting(null);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const filtered = Boolean(debouncedSearch || status || priority);
  const tasks = query.data?.data ?? [];

  return (
    <section className="panel" aria-labelledby="task-list-title">
      <div className="panel-head">
        <h2 id="task-list-title">{title}</h2>
        <Button variant="primary" size="small" icon={<Plus size={15} />} onClick={() => setCreating(true)}>
          Add task
        </Button>
      </div>

      <div className={`toolbar ${styles.toolbar}`}>
        <div className="grow">
          <SearchInput
            label="Search tasks by name"
            placeholder="Search tasks"
            value={search}
            onChange={(event) => resetPage(setSearch)(event.target.value)}
          />
        </div>
        <FilterSelect
          label="Filter by status"
          value={status}
          onChange={(e) => resetPage(setStatus)(e.target.value as TaskStatus | '')}
        >
          <option value="">Any status</option>
          {TASK_STATUSES.map((s) => (
            <option key={s} value={s}>
              {TASK_STATUS_LABELS[s]}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect
          label="Filter by priority"
          value={priority}
          onChange={(e) => resetPage(setPriority)(e.target.value as TaskPriority | '')}
        >
          <option value="">Any priority</option>
          {TASK_PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {TASK_PRIORITY_LABELS[p]}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect
          label="Sort tasks"
          value={sort}
          onChange={(e) => resetPage(setSort)(e.target.value as typeof sort)}
        >
          {SORTS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </FilterSelect>
      </div>

      {query.isPending ? (
        <ul className={styles.list} aria-label="Loading tasks">
          {[0, 1, 2, 3].map((n) => (
            <li key={n} className={styles.skeletonRow}>
              <Skeleton width={20} height={20} />
              <Skeleton width="45%" />
              <Skeleton width={70} />
            </li>
          ))}
        </ul>
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : tasks.length === 0 ? (
        filtered ? (
          <EmptyState title="No matching tasks">Try a different search or clear the filters.</EmptyState>
        ) : (
          <EmptyState
            title="No tasks yet"
            action={
              <Button variant="primary" size="small" icon={<Plus size={15} />} onClick={() => setCreating(true)}>
                Add the first task
              </Button>
            }
          >
            Break the work into small steps you can tick off.
          </EmptyState>
        )
      ) : (
        <ul className={styles.list} style={{ opacity: query.isPlaceholderData ? 0.6 : 1 }}>
          {tasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              showProject={!projectId}
              busy={busyId === task.id}
              onStatusChange={(next) => changeStatus(task, next)}
              onEdit={() => setEditing(task)}
              onDelete={() => setDeleting(task)}
            />
          ))}
        </ul>
      )}

      {query.data && <Pagination meta={query.data.meta} onPage={setPage} noun="tasks" />}

      <Modal open={creating} title="New task" onClose={() => setCreating(false)}>
        <TaskForm
          fixedProjectId={projectId}
          submitLabel="Add task"
          onSubmit={handleCreate}
          onCancel={() => setCreating(false)}
        />
      </Modal>

      <Modal open={Boolean(editing)} title="Edit task" onClose={() => setEditing(null)}>
        {editing && (
          <TaskForm task={editing} submitLabel="Save changes" onSubmit={handleEdit} onCancel={() => setEditing(null)} />
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete this task?"
        message={<>“{deleting?.name}” will be removed for good. This can’t be undone.</>}
        busy={deleteTask.isPending}
        onConfirm={handleDelete}
        onClose={() => setDeleting(null)}
      />
    </section>
  );
}
