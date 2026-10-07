import type { CreateTaskData, TaskListQuery, UpdateTaskData } from '@taskline/shared';
import type { Request, Response } from 'express';

import { getAuth } from '../../middleware/authenticate';
import * as service from './tasks.service';

type WithId = Request<{ id: string }>;

export async function list(req: Request, res: Response) {
  res.json(await service.listTasks(getAuth(req).userId, req.validatedQuery as TaskListQuery));
}

export async function getOne(req: WithId, res: Response) {
  res.json({ task: await service.getTask(getAuth(req).userId, req.params.id) });
}

export async function create(req: Request, res: Response) {
  const task = await service.createTask(getAuth(req).userId, req.body as CreateTaskData, req.ip);
  res.status(201).json({ task });
}

export async function update(req: WithId, res: Response) {
  const task = await service.updateTask(getAuth(req).userId, req.params.id, req.body as UpdateTaskData, req.ip);
  res.json({ task });
}

export async function remove(req: WithId, res: Response) {
  await service.deleteTask(getAuth(req).userId, req.params.id, req.ip);
  res.status(204).end();
}
