import type { Request, Response } from 'express';
import { catchAsync } from '../../lib/catch-async.js';
import {
  cancelStudySession,
  cancelStudySessionSeries,
  createStudySession,
  getMyStudySessions,
  getStudySessionById,
  updateStudySession,
  updateStudySessionSeries,
} from './study-session.service.js';
import {
  cancelStudySessionSchema,
  createStudySessionSchema,
  updateStudySessionSchema,
  updateStudySessionSeriesSchema,
} from './study-session.schemas.js';

export const getStudySessionsHandler = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.sub;
  const sessions = await getMyStudySessions(userId);
  res.json(sessions);
});

export const getStudySessionByIdHandler = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.sub;
  const session = await getStudySessionById(req.params.id, userId);
  res.json(session);
});

export const createStudySessionHandler = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.sub;
  const parsed = createStudySessionSchema.parse(req.body);
  const session = await createStudySession(userId, parsed);
  res.status(201).json(session);
});

export const updateStudySessionHandler = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.sub;
  const parsed = updateStudySessionSchema.parse(req.body);
  const session = await updateStudySession(userId, req.params.id, parsed);
  res.json(session);
});

export const updateStudySessionSeriesHandler = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.sub;
  const parsed = updateStudySessionSeriesSchema.parse(req.body);
  const session = await updateStudySessionSeries(userId, req.params.id, parsed);
  res.json(session);
});

export const cancelStudySessionHandler = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.sub;
  const parsed = cancelStudySessionSchema.safeParse(req.body);
  const result = await cancelStudySession(userId, req.params.id, parsed.success ? parsed.data.reason : undefined);
  res.json(result);
});

export const cancelStudySessionSeriesHandler = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.sub;
  const result = await cancelStudySessionSeries(userId, req.params.id);
  res.json(result);
});

