import {
  createProjectSchema,
  createTaskSchema,
  loginSchema,
  PROJECT_SORT_FIELDS,
  PROJECT_STATUSES,
  refreshSchema,
  registerPushTokenSchema,
  registerSchema,
  removePushTokenSchema,
  TASK_PRIORITIES,
  TASK_SORT_FIELDS,
  TASK_STATUSES,
  updateProjectSchema,
  updateTaskSchema,
} from '@taskline/shared';
import { z } from 'zod';

/**
 * OpenAPI 3.1 description of the API, served at /api/openapi.json and rendered at /api/docs.
 * Request bodies are generated from the same zod schemas the `validate` middleware uses,
 * so the documented rules are always the enforced rules.
 */

type Json = Record<string, unknown>;

function bodySchema(schema: z.ZodType): Json {
  const { $schema: _ignored, ...json } = z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' }) as Json;
  return json;
}

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const json = (schema: Json) => ({ 'application/json': { schema } });
const body = (schema: z.ZodType, required = true) => ({ required, content: json(bodySchema(schema)) });
const ok = (description: string, schema?: Json) => ({ description, ...(schema ? { content: json(schema) } : {}) });
const noContent = { description: 'Done, no body' };
const err = (description: string) => ({ description, content: json(ref('Error')) });

const commonErrors = {
  400: err('Validation failed: `error.details` lists each invalid field'),
  401: err(
    'Missing/invalid token (`UNAUTHORIZED`), expired token (`TOKEN_EXPIRED`) or ended session (`SESSION_EXPIRED`)',
  ),
};
const notFound = { 404: err('Not found, or it belongs to another user') };

const idParam = { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } };
const query = (name: string, schema: Json, description?: string) => ({
  name,
  in: 'query',
  required: false,
  schema,
  description,
});
const paging = [
  query('page', { type: 'integer', minimum: 1, default: 1 }),
  query('limit', { type: 'integer', minimum: 1, maximum: 100, default: 20 }),
  query('order', { type: 'string', enum: ['asc', 'desc'], default: 'desc' }),
  query('search', { type: 'string', maxLength: 100 }, 'Case-insensitive match on the name'),
];
const page = (item: string) => ({
  type: 'object',
  properties: { data: { type: 'array', items: ref(item) }, meta: ref('PageMeta') },
  required: ['data', 'meta'],
});

const date = { type: ['string', 'null'], format: 'date', examples: ['2026-10-20'] };
const timestamp = { type: 'string', format: 'date-time' };
const counts = (keys: readonly string[]) => ({
  type: 'object',
  properties: Object.fromEntries(keys.map((key) => [key, { type: 'integer' }])),
});

const schemas: Record<string, Json> = {
  Error: {
    type: 'object',
    properties: {
      error: {
        type: 'object',
        properties: {
          code: { type: 'string', examples: ['VALIDATION_ERROR'] },
          message: { type: 'string' },
          details: {
            type: 'array',
            items: { type: 'object', properties: { field: { type: 'string' }, message: { type: 'string' } } },
          },
          requestId: { type: 'string' },
        },
        required: ['code', 'message'],
      },
    },
  },
  User: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      fullName: { type: 'string' },
      email: { type: 'string', format: 'email' },
      role: { type: 'string', enum: ['USER', 'ADMIN'] },
      createdAt: timestamp,
    },
  },
  AuthResponse: {
    type: 'object',
    properties: {
      user: ref('User'),
      accessToken: { type: 'string' },
      accessTokenExpiresAt: timestamp,
      refreshToken: {
        type: 'string',
        description: 'Only for `x-client-platform: mobile`; browsers get an httpOnly cookie',
      },
      refreshTokenExpiresAt: timestamp,
    },
  },
  PageMeta: {
    type: 'object',
    properties: {
      page: { type: 'integer' },
      limit: { type: 'integer' },
      total: { type: 'integer' },
      totalPages: { type: 'integer' },
    },
  },
  Project: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      name: { type: 'string' },
      description: { type: ['string', 'null'] },
      status: { type: 'string', enum: [...PROJECT_STATUSES] },
      startDate: date,
      endDate: date,
      createdAt: timestamp,
      updatedAt: timestamp,
      taskCounts: { type: 'object', properties: { total: { type: 'integer' }, completed: { type: 'integer' } } },
      progress: { type: 'integer', minimum: 0, maximum: 100 },
    },
  },
  Task: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      projectId: { type: 'string', format: 'uuid' },
      project: {
        type: 'object',
        properties: { id: { type: 'string' }, name: { type: 'string' }, status: { type: 'string' } },
      },
      name: { type: 'string' },
      description: { type: ['string', 'null'] },
      priority: { type: 'string', enum: [...TASK_PRIORITIES] },
      status: { type: 'string', enum: [...TASK_STATUSES] },
      dueDate: date,
      completedAt: { type: ['string', 'null'], format: 'date-time' },
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  },
  Dashboard: {
    type: 'object',
    properties: {
      totalProjects: { type: 'integer' },
      totalTasks: { type: 'integer' },
      completedTasks: { type: 'integer' },
      pendingTasks: { type: 'integer' },
      inProgressTasks: { type: 'integer' },
      overdueTasks: { type: 'integer' },
      projectsInProgress: { type: 'integer' },
      projectsByStatus: counts(PROJECT_STATUSES),
      tasksByStatus: counts(TASK_STATUSES),
      tasksByPriority: counts(TASK_PRIORITIES),
      completionRate: { type: 'integer' },
      upcomingTasks: { type: 'array', items: ref('Task') },
    },
  },
  AuditLog: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      action: { type: 'string', examples: ['TASK_COMPLETED'] },
      entityType: { type: 'string' },
      entityId: { type: ['string', 'null'] },
      summary: { type: 'string' },
      createdAt: timestamp,
    },
  },
};

const clientHeader = {
  name: 'x-client-platform',
  in: 'header',
  required: false,
  schema: { type: 'string', enum: ['web', 'mobile'] },
  description: '`mobile` returns the refresh token in the body instead of a cookie',
};

const secured = [{ bearerAuth: [] }];

export function buildOpenApiSpec(serverUrl = '/api') {
  return {
    openapi: '3.1.0',
    info: {
      title: 'Taskline API',
      version: '1.0.0',
      description:
        'One REST API for the Taskline web and Android apps. Sign in with **POST /auth/login**, copy the ' +
        '`accessToken` into **Authorize**, then try any endpoint. Full guide: docs/API.md in the repository.',
    },
    servers: [{ url: serverUrl }],
    tags: [
      { name: 'Auth' },
      { name: 'Projects' },
      { name: 'Tasks' },
      { name: 'Dashboard' },
      { name: 'Notifications' },
      { name: 'Extras' },
    ],
    components: {
      securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
      schemas,
    },
    paths: {
      '/auth/register': {
        post: {
          tags: ['Auth'],
          summary: 'Create an account',
          parameters: [clientHeader],
          requestBody: body(registerSchema),
          responses: {
            201: ok('Signed up and signed in', ref('AuthResponse')),
            400: commonErrors[400],
            409: err('Email already registered'),
            429: err('Rate limited'),
          },
        },
      },
      '/auth/login': {
        post: {
          tags: ['Auth'],
          summary: 'Sign in',
          parameters: [clientHeader],
          requestBody: body(loginSchema),
          responses: {
            200: ok('Signed in', ref('AuthResponse')),
            400: commonErrors[400],
            401: err('Invalid email or password'),
            429: err('Too many failed attempts'),
          },
        },
      },
      '/auth/refresh': {
        post: {
          tags: ['Auth'],
          summary: 'Swap a refresh token for a new access token (rotates the refresh token)',
          parameters: [{ ...clientHeader, required: true }],
          requestBody: body(refreshSchema, false),
          responses: { 200: ok('New tokens', ref('AuthResponse')), 401: err('Session expired or token reused') },
        },
      },
      '/auth/logout': {
        post: {
          tags: ['Auth'],
          summary: 'End this device’s session',
          security: secured,
          responses: { 204: noContent, 401: commonErrors[401] },
        },
      },
      '/auth/me': {
        get: {
          tags: ['Auth'],
          summary: 'Current user',
          security: secured,
          responses: {
            200: ok('The signed-in user', { type: 'object', properties: { user: ref('User') } }),
            401: commonErrors[401],
          },
        },
      },
      '/projects': {
        get: {
          tags: ['Projects'],
          summary: 'List your projects',
          security: secured,
          parameters: [
            ...paging,
            query('status', { type: 'string', enum: [...PROJECT_STATUSES] }),
            query('sortBy', { type: 'string', enum: [...PROJECT_SORT_FIELDS], default: 'createdAt' }),
          ],
          responses: { 200: ok('A page of projects', page('Project')), ...commonErrors },
        },
        post: {
          tags: ['Projects'],
          summary: 'Create a project',
          security: secured,
          requestBody: body(createProjectSchema),
          responses: {
            201: ok('Created', { type: 'object', properties: { project: ref('Project') } }),
            ...commonErrors,
          },
        },
      },
      '/projects/{id}': {
        parameters: [idParam],
        get: {
          tags: ['Projects'],
          summary: 'Get one project',
          security: secured,
          responses: {
            200: ok('The project', { type: 'object', properties: { project: ref('Project') } }),
            ...commonErrors,
            ...notFound,
          },
        },
        put: {
          tags: ['Projects'],
          summary: 'Update a project (send only the fields to change)',
          security: secured,
          requestBody: body(updateProjectSchema),
          responses: {
            200: ok('Updated', { type: 'object', properties: { project: ref('Project') } }),
            ...commonErrors,
            ...notFound,
          },
        },
        delete: {
          tags: ['Projects'],
          summary: 'Delete a project and its tasks',
          security: secured,
          responses: { 204: noContent, ...commonErrors, ...notFound },
        },
      },
      '/tasks': {
        get: {
          tags: ['Tasks'],
          summary: 'List your tasks (all projects, or one)',
          security: secured,
          parameters: [
            ...paging,
            query('projectId', { type: 'string', format: 'uuid' }),
            query('status', { type: 'string', enum: [...TASK_STATUSES] }),
            query('priority', { type: 'string', enum: [...TASK_PRIORITIES] }),
            query('dueOn', { type: 'string', format: 'date' }, 'Only tasks due on this day'),
            query('sortBy', { type: 'string', enum: [...TASK_SORT_FIELDS], default: 'createdAt' }),
          ],
          responses: { 200: ok('A page of tasks', page('Task')), ...commonErrors, ...notFound },
        },
        post: {
          tags: ['Tasks'],
          summary: 'Create a task in one of your projects',
          security: secured,
          requestBody: body(createTaskSchema),
          responses: {
            201: ok('Created', { type: 'object', properties: { task: ref('Task') } }),
            ...commonErrors,
            ...notFound,
          },
        },
      },
      '/tasks/{id}': {
        parameters: [idParam],
        get: {
          tags: ['Tasks'],
          summary: 'Get one task',
          security: secured,
          responses: {
            200: ok('The task', { type: 'object', properties: { task: ref('Task') } }),
            ...commonErrors,
            ...notFound,
          },
        },
        put: {
          tags: ['Tasks'],
          summary: 'Update a task. `{ "status": "COMPLETED" }` marks it done',
          security: secured,
          requestBody: body(updateTaskSchema),
          responses: {
            200: ok('Updated', { type: 'object', properties: { task: ref('Task') } }),
            ...commonErrors,
            ...notFound,
          },
        },
        delete: {
          tags: ['Tasks'],
          summary: 'Delete a task',
          security: secured,
          responses: { 204: noContent, ...commonErrors, ...notFound },
        },
      },
      '/dashboard': {
        get: {
          tags: ['Dashboard'],
          summary: 'Totals for the signed-in user',
          security: secured,
          parameters: [query('today', { type: 'string', format: 'date' }, 'Client’s local date, used for "overdue"')],
          responses: { 200: ok('Dashboard numbers', ref('Dashboard')), ...commonErrors },
        },
      },
      '/push-tokens': {
        post: {
          tags: ['Notifications'],
          summary: 'Opt this phone in to "due tomorrow" push reminders',
          security: secured,
          requestBody: body(registerPushTokenSchema),
          responses: { 204: noContent, ...commonErrors },
        },
        delete: {
          tags: ['Notifications'],
          summary: 'Opt this phone out',
          security: secured,
          requestBody: body(removePushTokenSchema),
          responses: { 204: noContent, ...commonErrors },
        },
      },
      '/jobs/due-reminders': {
        post: {
          tags: ['Notifications'],
          summary: 'Send due-tomorrow pushes (for a cron, needs `x-cron-secret`)',
          parameters: [{ name: 'x-cron-secret', in: 'header', required: true, schema: { type: 'string' } }],
          responses: {
            200: ok('Run summary', {
              type: 'object',
              properties: {
                checked: { type: 'integer' },
                notified: { type: 'integer' },
                removedTokens: { type: 'integer' },
              },
            }),
            401: err('Wrong secret'),
            404: err('CRON_SECRET not configured'),
          },
        },
      },
      '/audit-logs': {
        get: {
          tags: ['Extras'],
          summary: 'Your activity history',
          security: secured,
          parameters: paging.slice(0, 2),
          responses: { 200: ok('A page of entries', page('AuditLog')), ...commonErrors },
        },
      },
      '/admin/users': {
        get: {
          tags: ['Extras'],
          summary: 'All accounts with project counts (ADMIN only)',
          security: secured,
          parameters: paging.slice(0, 2),
          responses: { 200: ok('A page of users'), ...commonErrors, 403: err('Not an admin') },
        },
      },
      '/health': {
        get: { tags: ['Extras'], summary: 'Liveness + database check', responses: { 200: ok('Healthy') } },
      },
    },
  };
}
