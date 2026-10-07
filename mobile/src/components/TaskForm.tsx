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
  type TaskPriority,
  type TaskStatus,
} from '@taskline/shared';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Controller, useForm, type Path } from 'react-hook-form';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { api, ApiError, errorMessage } from '@/lib/api';
import { keys } from '@/lib/query';
import { space, useColors } from '@/lib/theme';

import { DateField } from './DateField';
import { Banner, Button, Chips, Field, FieldError, FieldLabel } from './ui';

const FIELDS = ['projectId', 'name', 'description', 'priority', 'status', 'dueDate'] as const;

interface TaskFormProps {
  task?: Task;
  projectId?: string;
  submitLabel: string;
  onSubmit: (data: CreateTaskData) => Promise<unknown>;
  footer?: React.ReactNode;
}

/**
 * Create / edit form. Validated with the same zod schema the API uses, then the API's own
 * field errors (if any) are shown under the matching input.
 */
export function TaskForm({ task, projectId, submitLabel, onSubmit, footer }: TaskFormProps) {
  const c = useColors();
  const [formError, setFormError] = useState<string | null>(null);
  const pickProject = !projectId && !task;

  const projects = useQuery({
    queryKey: keys.projects({ picker: true }),
    queryFn: () => api.projects({ limit: 100 }),
    enabled: pickProject,
  });

  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreateTaskInput, unknown, CreateTaskData>({
    resolver: zodResolver(createTaskSchema),
    defaultValues: {
      projectId: task?.projectId ?? projectId ?? '',
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
      if (error instanceof ApiError && error.details.length) {
        for (const detail of error.details) {
          if ((FIELDS as readonly string[]).includes(detail.field)) {
            setError(detail.field as Path<CreateTaskInput>, { message: detail.message });
          }
        }
      }
      setFormError(errorMessage(error));
    }
  });

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={{ backgroundColor: c.bg }}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {formError ? <Banner tone="error">{formError}</Banner> : null}

        {pickProject ? (
          <View style={styles.group}>
            <FieldLabel>Project</FieldLabel>
            {projects.data?.data.length === 0 ? (
              <Banner>Create a project on the web app first, every task belongs to a project.</Banner>
            ) : (
              <Controller
                control={control}
                name="projectId"
                render={({ field }) => (
                  <Chips
                    label="Project"
                    scroll={false}
                    value={field.value}
                    onChange={field.onChange}
                    options={(projects.data?.data ?? []).map((p) => ({ value: p.id, label: p.name }))}
                  />
                )}
              />
            )}
            <FieldError message={errors.projectId?.message} />
          </View>
        ) : null}

        <Controller
          control={control}
          name="name"
          render={({ field }) => (
            <Field
              label="Task name"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={errors.name?.message}
              maxLength={160}
              returnKeyType="next"
              autoFocus={!task}
            />
          )}
        />

        <Controller
          control={control}
          name="description"
          render={({ field }) => (
            <Field
              label="Description (optional)"
              value={field.value ?? ''}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={errors.description?.message}
              multiline
              maxLength={2000}
              style={{ minHeight: 96, textAlignVertical: 'top' }}
            />
          )}
        />

        <View style={styles.group}>
          <FieldLabel>Priority</FieldLabel>
          <Controller
            control={control}
            name="priority"
            render={({ field }) => (
              <Chips<TaskPriority>
                label="Priority"
                scroll={false}
                value={field.value ?? 'MEDIUM'}
                onChange={field.onChange}
                options={TASK_PRIORITIES.map((value) => ({ value, label: TASK_PRIORITY_LABELS[value] }))}
              />
            )}
          />
        </View>

        <View style={styles.group}>
          <FieldLabel>Status</FieldLabel>
          <Controller
            control={control}
            name="status"
            render={({ field }) => (
              <Chips<TaskStatus>
                label="Status"
                scroll={false}
                value={field.value ?? 'PENDING'}
                onChange={field.onChange}
                options={TASK_STATUSES.map((value) => ({ value, label: TASK_STATUS_LABELS[value] }))}
              />
            )}
          />
        </View>

        <Controller
          control={control}
          name="dueDate"
          render={({ field }) => (
            <DateField
              label="Due date (optional)"
              value={field.value ?? ''}
              onChange={field.onChange}
              error={errors.dueDate?.message}
            />
          )}
        />

        <Button title={submitLabel} loading={isSubmitting} onPress={submit} style={{ marginTop: space.sm }} />
        {footer}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, gap: space.lg, paddingBottom: 48 },
  group: { gap: 8 },
});
