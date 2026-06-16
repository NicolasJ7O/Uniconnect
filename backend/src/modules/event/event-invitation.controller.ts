import type { Request, Response } from 'express';
import { catchAsync } from '../../lib/catch-async.js';
import { createEventInvitation, consumeEventInvitation, listEventInvitations, rejectEventInvitation } from './event-invitation.service.js';

export const createEventInvitationHandler = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.sub;
  const result = await createEventInvitation(req.params.id, userId, req.body?.email);
  res.status(result.duplicate ? 200 : 201).json(result);
});

export const listEventInvitationsHandler = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.sub;
  const invitations = await listEventInvitations(req.params.id, userId);
  res.json(invitations);
});

export const acceptEventInvitationHandler = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.sub;
  const result = await consumeEventInvitation(req.params.token, userId);
  res.json(result);
});

export const rejectEventInvitationHandler = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.sub;
  const result = await rejectEventInvitation(req.params.token, userId);
  res.json(result);
});
