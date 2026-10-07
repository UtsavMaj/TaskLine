import { zodResolver } from '@hookform/resolvers/zod';
import {
  createTaskSchema,
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  TASK_STATUSES,
  type CreateTaskData,
  type CreateTaskInput,
  type Task,
} from '@taskline/shared';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { Button } from '@/components/ui/Button';
import { SelectField, TextArea, TextField } from '@/components/ui/Field';
import { Banner } from '@/components/ui/States';
import { useProjects } from '@/hooks/queries';
import { applyServerErrors } from '@/lib/forms';

import styles from './tasks.module.css';

const FIELDS = ['projectId', 'name', 'description', 'priority', 'status', 'dueDate'] as const;

interface TaskFormProps {
  task?: Task;
  /** When set, the task belongs to this project and the project picker is hidden. */
  fixedProjectId?: string;
  submitLabel: string;
  onSubmit: (data: CreateTaskData) => Promise<unknown>;
  onCancel: () => void;
}

export function TaskForm({ task, fixedProjectId, submitLabel, onSubmit, onCancel }: TaskFormProps) {
  const [formError, setFormError] = useState<string | null>(null);
  const needsPicker = !fixedProjectId;
  const projects = useProjects({ limit: 100, sortBy: 'name', order: 'asc' });

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreateTaskInput, unknown, CreateTaskData>({
    resolver: zodResolver(createTaskSchema),
    defaultValues: {
      projectId: task?.projectId ?? fixedProjectId ?? '',
      name: task?.name ?? '',
      description: task?.description ?? '',
      priority: task?.priority ?? 'MEDIUM',
      status: task?.status ?? 'PENDING',
      dueDate: task?.dueDate ?? '',
    },
  });

  const submit = handleSubmit(async (data) => {
    setFormError(null);
    try {
      await onSubmit(data);
    } catch (error) {
      setFormError(applyServerErrors(error, setError, FIELDS));
    }
  });

  const noProjects = needsPicker && projects.data?.data.length === 0;

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      {formError && <Banner tone="error">{formError}</Banner>}
      {noProjects && <Banner>Create a project first, every task belongs to one.</Banner>}

      {needsPicker && (
        <SelectField
          label="Project"
          error={errors.projectId?.message}
          disabled={projects.isLoading}
          {...register('projectId')}
        >
          <option value="">{projects.isLoading ? 'Loading projects…' : 'Choose a project'}</option>
          {projects.data?.data.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </SelectField>
      )}

      <TextField label="Task name" autoFocus maxLength={160} error={errors.name?.message} {...register('name')} />
      <TextArea
        label="Description"
        optional
        maxLength={2000}
        error={errors.description?.message}
        {...register('description')}
      />

      <div className={styles.threeCol}>
        <SelectField label="Priority" error={errors.priority?.message} {...register('priority')}>
          {TASK_PRIORITIES.map((priority) => (
            <option key={priority} value={priority}>
              {TASK_PRIORITY_LABELS[priority]}
            </option>
          ))}
        </SelectField>
        <SelectField label="Status" error={errors.status?.message} {...register('status')}>
          {TASK_STATUSES.map((status) => (
            <option key={status} value={status}>
              {TASK_STATUS_LABELS[status]}
            </option>
          ))}
        </SelectField>
        <TextField label="Due date" type="date" optional error={errors.dueDate?.message} {...register('dueDate')} />
      </div>

      <div className={styles.formActions}>
        <Button variant="ghost" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={isSubmitting} disabled={noProjects}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
