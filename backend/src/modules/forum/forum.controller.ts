import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../errors/app-error.js';
import { catchAsync } from '../../lib/catch-async.js';
import { prisma } from '../../lib/prisma.js';
import {
  getForumQuestions,
  getQuestionThread,
  createQuestion,
  createAnswer,
  voteQuestion,
  voteAnswer,
  acceptAnswer,
  getStudentForumHistory
} from './forum.service.js';
import { ForumRequestContext } from './handlers/forum-handler.js';
import { AuthHandler } from './handlers/auth.handler.js';
import { EnrollmentHandler } from './handlers/enrollment.handler.js';
import { ContentFormatHandler } from './handlers/content-format.handler.js';
import { LengthHandler } from './handlers/length.handler.js';
import { ModerationHandler } from './handlers/moderation.handler.js';

// Helper to run the Chain of Responsibility
async function validateForumRequest(context: ForumRequestContext) {
  const authHandler = new AuthHandler();
  const enrollmentHandler = new EnrollmentHandler();
  const contentFormatHandler = new ContentFormatHandler();
  const lengthHandler = new LengthHandler();
  const moderationHandler = new ModerationHandler();

  // Link the chain
  authHandler
    .setNext(enrollmentHandler)
    .setNext(contentFormatHandler)
    .setNext(lengthHandler)
    .setNext(moderationHandler);

  // Execute
  await authHandler.handle(context);
}

// Helper to resolve DB internal user ID in case of Auth0 mismatch (matches student.service.ts)
async function resolveDbUserId(userId: string, email?: string): Promise<string> {
  if (email) {
    const existing = await prisma.user.findUnique({
      where: { email },
      select: { id: true }
    });
    if (existing) {
      return existing.id;
    }
  }
  return userId;
}

export const getQuestionsHandler = catchAsync(async (req: Request, res: Response) => {
  const { subjectId } = req.params;
  const payload = req.user!;
  const userId = await resolveDbUserId(payload.sub, payload.email);

  await validateForumRequest({
    userId,
    subjectId,
    action: 'VIEW_FORUM' as any, // Extend action validation
    data: {}
  });

  const questions = await getForumQuestions(subjectId);
  res.json(questions);
});

export const getQuestionThreadHandler = catchAsync(async (req: Request, res: Response) => {
  const { questionId } = req.params;
  const payload = req.user!;
  const userId = await resolveDbUserId(payload.sub, payload.email);

  const question = await prisma.forumQuestion.findUnique({
    where: { id: questionId },
    select: { subjectId: true }
  });

  if (!question) {
    throw new AppError(404, 'La pregunta no existe');
  }

  await validateForumRequest({
    userId,
    subjectId: question.subjectId,
    action: 'VIEW_FORUM' as any,
    data: {}
  });

  const thread = await getQuestionThread(questionId);
  res.json(thread);
});

export const createQuestionHandler = catchAsync(async (req: Request, res: Response) => {
  const { subjectId } = req.params;
  const { title, content } = req.body;
  const payload = req.user!;
  const userId = await resolveDbUserId(payload.sub, payload.email);

  await validateForumRequest({
    userId,
    subjectId,
    action: 'CREATE_QUESTION',
    data: { title, content }
  });

  const newQuestion = await createQuestion(subjectId, userId, title, content);
  res.status(201).json(newQuestion);
});

export const createAnswerHandler = catchAsync(async (req: Request, res: Response) => {
  const { questionId } = req.params;
  const { content } = req.body;
  const payload = req.user!;
  const userId = await resolveDbUserId(payload.sub, payload.email);

  const question = await prisma.forumQuestion.findUnique({
    where: { id: questionId },
    select: { subjectId: true }
  });

  if (!question) {
    throw new AppError(404, 'La pregunta no existe');
  }

  await validateForumRequest({
    userId,
    subjectId: question.subjectId,
    action: 'CREATE_ANSWER',
    data: { content, questionId }
  });

  const newAnswer = await createAnswer(questionId, userId, content);
  res.status(201).json(newAnswer);
});

export const voteQuestionHandler = catchAsync(async (req: Request, res: Response) => {
  const { questionId } = req.params;
  const { value } = req.body; // 1 or -1
  const payload = req.user!;
  const userId = await resolveDbUserId(payload.sub, payload.email);

  const question = await prisma.forumQuestion.findUnique({
    where: { id: questionId },
    select: { subjectId: true }
  });

  if (!question) {
    throw new AppError(404, 'La pregunta no existe');
  }

  await validateForumRequest({
    userId,
    subjectId: question.subjectId,
    action: 'VOTE_QUESTION',
    data: { value, questionId }
  });

  const updatedQuestion = await voteQuestion(questionId, userId, Number(value));
  res.json(updatedQuestion);
});

export const voteAnswerHandler = catchAsync(async (req: Request, res: Response) => {
  const { answerId } = req.params;
  const { value } = req.body; // 1 or -1
  const payload = req.user!;
  const userId = await resolveDbUserId(payload.sub, payload.email);

  const answer = await prisma.forumAnswer.findUnique({
    where: { id: answerId },
    include: { question: { select: { subjectId: true } } }
  });

  if (!answer) {
    throw new AppError(404, 'La respuesta no existe');
  }

  await validateForumRequest({
    userId,
    subjectId: answer.question.subjectId,
    action: 'VOTE_ANSWER',
    data: { value, answerId }
  });

  const updatedAnswer = await voteAnswer(answerId, userId, Number(value));
  res.json(updatedAnswer);
});

export const acceptAnswerHandler = catchAsync(async (req: Request, res: Response) => {
  const { answerId } = req.params;
  const payload = req.user!;
  const userId = await resolveDbUserId(payload.sub, payload.email);

  const answer = await prisma.forumAnswer.findUnique({
    where: { id: answerId },
    include: { question: { select: { subjectId: true } } }
  });

  if (!answer) {
    throw new AppError(404, 'La respuesta no existe');
  }

  await validateForumRequest({
    userId,
    subjectId: answer.question.subjectId,
    action: 'ACCEPT_ANSWER',
    data: { answerId }
  });

  const updatedAnswer = await acceptAnswer(answerId, userId);
  res.json(updatedAnswer);
});

export const getHistoryHandler = catchAsync(async (req: Request, res: Response) => {
  const { subjectId } = req.params;
  const payload = req.user!;
  const userId = await resolveDbUserId(payload.sub, payload.email);

  await validateForumRequest({
    userId,
    subjectId,
    action: 'VIEW_FORUM' as any,
    data: {}
  });

  const history = await getStudentForumHistory(subjectId, userId);
  res.json(history);
});
