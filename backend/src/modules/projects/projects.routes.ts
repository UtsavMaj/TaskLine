import { createProjectSchema, idParamSchema, projectListQuerySchema, updateProjectSchema } from '@taskline/shared';
import { Router } from 'express';

import { authenticate } from '../../middleware/authenticate';
import { validate } from '../../middleware/validate';
import * as controller from './projects.controller';

const byId = validate({ params: idParamSchema });

export const projectsRouter = Router();
projectsRouter.use(authenticate);

projectsRouter.get('/', validate({ query: projectListQuerySchema }), controller.list);
projectsRouter.get('/:id', byId, controller.getOne);
projectsRouter.post('/', validate({ body: createProjectSchema }), controller.create);
projectsRouter.put('/:id', byId, validate({ body: updateProjectSchema }), controller.update);
projectsRouter.delete('/:id', byId, controller.remove);
