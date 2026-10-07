import { z } from 'zod';

import { TASK_PRIORITIES, TASK_SORT_FIELDS, TASK_STATUSES } from '../constants';
import {
  dateString,
  emptyToUndefined,
  hasAtLeastOneKey,
  idSchema,
  optionalDate,
  optionalText,
  paginationQuery,
  requiredText,
} from './common';

export const taskStatusSchema = z.enum(TASK_STATUSES, {
  error: `Status must be one of: ${TASK_STATUSES.join(', ')}`,
});

export const taskPrioritySchema = z.enum(TASK_PRIORITIES, {
  error: `Priority must be one of: ${TASK_PRIORITIES.join(', ')}`,
});

const taskFields = {
  name: requiredText('Task name', 160),
  description: optionalText('Description', 2000),
  dueDate: optionalDate,
};

export const createTaskSchema = z.object({
  projectId: z.uuid({ error: 'Choose a valid project' }),
  ...taskFields,
  priority: taskPrioritySchema.optional().transform((priority) => priority ?? 'MEDIUM'),
  status: taskStatusSchema.optional().transform((status) => status ?? 'PENDING'),
});

/** Every field is optional, so the same endpoint handles a full edit or a one-tap "mark as done". */
export const updateTaskSchema = z
  .object({
    projectId: idSchema.optional(),
    name: taskFields.name.optional(),
    description: taskFields.description,
    dueDate: taskFields.dueDate,
    priority: taskPrioritySchema.optional(),
    status: taskStatusSchema.optional(),
  })
  .refine(hasAtLeastOneKey, { message: 'Provide at least one field to update' });

export const taskListQuerySchema = z.object({
  ...paginationQuery,
  projectId: emptyToUndefined(z.uuid({ error: 'projectId must be a valid id' })),
  status: emptyToUndefined(taskStatusSchema),
  priority: emptyToUndefined(taskPrioritySchema),
  /** Only tasks due on this calendar day (used by the mobile "due tomorrow" reminder). */
  dueOn: emptyToUndefined(dateString),
  sortBy: emptyToUndefined(
    z.enum(TASK_SORT_FIELDS, { error: `sortBy must be one of: ${TASK_SORT_FIELDS.join(', ')}` }),
  ).transform((value) => value ?? 'createdAt'),
});

export type CreateTaskInput = z.input<typeof createTaskSchema>;
export type CreateTaskData = z.output<typeof createTaskSchema>;
export type UpdateTaskInput = z.input<typeof updateTaskSchema>;
export type UpdateTaskData = z.output<typeof updateTaskSchema>;
export type TaskListQuery = z.output<typeof taskListQuerySchema>;
