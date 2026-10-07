import { createTaskSchema, idParamSchema, taskListQuerySchema, updateTaskSchema } from '@taskline/shared';
import { Router } from 'express';

import { authenticate } from '../../middleware/authenticate';
import { validate } from '../../middleware/validate';
import * as controller from './tasks.controller';

const byId = validate({ params: idParamSchema });

export const tasksRouter = Router();
tasksRouter.use(authenticate);

tasksRouter.get('/', validate({ query: taskListQuerySchema }), controller.list);
tasksRouter.get('/:id', byId, controller.getOne);
tasksRouter.post('/', validate({ body: createTaskSchema }), controller.create);
tasksRouter.put('/:id', byId, validate({ body: updateTaskSchema }), controller.update);
tasksRouter.delete('/:id', byId, controller.remove);
