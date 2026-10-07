import type { CreateProjectData, ProjectListQuery, UpdateProjectData } from '@taskline/shared';
import type { Request, Response } from 'express';

import { getAuth } from '../../middleware/authenticate';
import * as service from './projects.service';

type WithId = Request<{ id: string }>;

export async function list(req: Request, res: Response) {
  res.json(await service.listProjects(getAuth(req).userId, req.validatedQuery as ProjectListQuery));
}

export async function getOne(req: WithId, res: Response) {
  res.json({ project: await service.getProject(getAuth(req).userId, req.params.id) });
}

export async function create(req: Request, res: Response) {
  const project = await service.createProject(getAuth(req).userId, req.body as CreateProjectData, req.ip);
  res.status(201).json({ project });
}

export async function update(req: WithId, res: Response) {
  const project = await service.updateProject(
    getAuth(req).userId,
    req.params.id,
    req.body as UpdateProjectData,
    req.ip,
  );
  res.json({ project });
}

export async function remove(req: WithId, res: Response) {
  await service.deleteProject(getAuth(req).userId, req.params.id, req.ip);
  res.status(204).end();
}
