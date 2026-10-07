import { zodResolver } from '@hookform/resolvers/zod';
import {
  createProjectSchema,
  PROJECT_STATUS_LABELS,
  PROJECT_STATUSES,
  type CreateProjectData,
  type CreateProjectInput,
  type Project,
} from '@taskline/shared';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { Button } from '@/components/ui/Button';
import { SelectField, TextArea, TextField } from '@/components/ui/Field';
import { Banner } from '@/components/ui/States';
import { applyServerErrors } from '@/lib/forms';

import styles from './projects.module.css';

const FIELDS = ['name', 'description', 'status', 'startDate', 'endDate'] as const;

interface ProjectFormProps {
  project?: Project;
  submitLabel: string;
  onSubmit: (data: CreateProjectData) => Promise<unknown>;
  onCancel: () => void;
}

/** Used for both "new project" and "edit project". Same zod schema as the API, so the rules can't drift. */
export function ProjectForm({ project, submitLabel, onSubmit, onCancel }: ProjectFormProps) {
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreateProjectInput, unknown, CreateProjectData>({
    resolver: zodResolver(createProjectSchema),
    defaultValues: {
      name: project?.name ?? '',
      description: project?.description ?? '',
      status: project?.status ?? 'NOT_STARTED',
      startDate: project?.startDate ?? '',
      endDate: project?.endDate ?? '',
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

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      {formError && <Banner tone="error">{formError}</Banner>}

      <TextField label="Project name" autoFocus maxLength={120} error={errors.name?.message} {...register('name')} />
      <TextArea
        label="Description"
        optional
        maxLength={2000}
        error={errors.description?.message}
        {...register('description')}
      />
      <SelectField label="Status" error={errors.status?.message} {...register('status')}>
        {PROJECT_STATUSES.map((status) => (
          <option key={status} value={status}>
            {PROJECT_STATUS_LABELS[status]}
          </option>
        ))}
      </SelectField>
      <div className={styles.twoCol}>
        <TextField
          label="Start date"
          type="date"
          optional
          error={errors.startDate?.message}
          {...register('startDate')}
        />
        <TextField label="End date" type="date" optional error={errors.endDate?.message} {...register('endDate')} />
      </div>

      <div className={styles.formActions}>
        <Button variant="ghost" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={isSubmitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
