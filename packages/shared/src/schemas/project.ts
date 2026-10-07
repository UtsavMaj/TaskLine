import { z } from 'zod';

import { PROJECT_SORT_FIELDS, PROJECT_STATUSES } from '../constants';
import {
  emptyToUndefined,
  hasAtLeastOneKey,
  optionalDate,
  optionalText,
  paginationQuery,
  requiredText,
} from './common';

export const projectStatusSchema = z.enum(PROJECT_STATUSES, {
  error: `Status must be one of: ${PROJECT_STATUSES.join(', ')}`,
});

/** End date can't be before the start date. Only checked when both values are known. */
export function isValidDateRange(startDate?: string | null, endDate?: string | null) {
  if (!startDate || !endDate) return true;
  return endDate >= startDate; // YYYY-MM-DD strings compare correctly as text
}

const dateRangeIssue = {
  message: 'End date cannot be before the start date',
  path: ['endDate'],
};

const projectFields = {
  name: requiredText('Project name', 120),
  description: optionalText('Description', 2000),
  startDate: optionalDate,
  endDate: optionalDate,
};

export const createProjectSchema = z
  .object({
    ...projectFields,
    status: projectStatusSchema.optional().transform((status) => status ?? 'NOT_STARTED'),
  })
  .refine((project) => isValidDateRange(project.startDate, project.endDate), dateRangeIssue);

export const updateProjectSchema = z
  .object({
    name: projectFields.name.optional(),
    description: projectFields.description,
    status: projectStatusSchema.optional(),
    startDate: projectFields.startDate,
    endDate: projectFields.endDate,
  })
  .refine(hasAtLeastOneKey, { message: 'Provide at least one field to update' })
  .refine((project) => isValidDateRange(project.startDate, project.endDate), dateRangeIssue);

export const projectListQuerySchema = z.object({
  ...paginationQuery,
  status: emptyToUndefined(projectStatusSchema),
  sortBy: emptyToUndefined(
    z.enum(PROJECT_SORT_FIELDS, { error: `sortBy must be one of: ${PROJECT_SORT_FIELDS.join(', ')}` }),
  ).transform((value) => value ?? 'createdAt'),
});

export type CreateProjectInput = z.input<typeof createProjectSchema>;
export type CreateProjectData = z.output<typeof createProjectSchema>;
export type UpdateProjectInput = z.input<typeof updateProjectSchema>;
export type UpdateProjectData = z.output<typeof updateProjectSchema>;
export type ProjectListQuery = z.output<typeof projectListQuerySchema>;
