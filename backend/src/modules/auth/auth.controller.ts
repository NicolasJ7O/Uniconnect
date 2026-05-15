import { Request, Response } from 'express';
import { googleAuthSchema, googleWebAuthSchema, simpleAuthSchema, refreshSchema, auth0AuthSchema } from './auth.schemas.js';
import { logout, refreshSession, signInWithGoogle, signInWithGoogleAccessToken, signInSimple, signInWithAuth0 } from './auth.service.js';
import { catchAsync } from '../../lib/catch-async.js';

function getDeviceContext(req: Request): { ip?: string; userAgent?: string } {
  const forwardedFor = req.headers['x-forwarded-for'];
  const ip = Array.isArray(forwardedFor)
    ? forwardedFor[0]
    : typeof forwardedFor === 'string'
      ? forwardedFor.split(',')[0]?.trim()
      : req.ip;

  return {
    ip: ip ?? undefined,
    userAgent: Array.isArray(req.headers['user-agent']) ? req.headers['user-agent'][0] : req.headers['user-agent'],
  };
}

export const googleSignInHandler = catchAsync(async (req: Request, res: Response) => {
  const data = googleAuthSchema.parse(req.body);
  const authData = await signInWithGoogle(data.idToken, getDeviceContext(req));
  return res.status(200).json(authData);
});

export const googleWebSignInHandler = catchAsync(async (req: Request, res: Response) => {
  const data = googleWebAuthSchema.parse(req.body);
  const authData = await signInWithGoogleAccessToken(data.accessToken, getDeviceContext(req));
  return res.status(200).json(authData);
});

export const auth0SignInHandler = catchAsync(async (req: Request, res: Response) => {
  const data = auth0AuthSchema.parse(req.body);
  const authData = await signInWithAuth0(data.accessToken, getDeviceContext(req));
  return res.status(200).json(authData);
});

export const refreshHandler = catchAsync(async (req: Request, res: Response) => {
  const data = refreshSchema.parse(req.body);

  const authData = await refreshSession(data.refreshToken, getDeviceContext(req));
  return res.status(200).json(authData);
});

export const logoutHandler = catchAsync(async (req: Request, res: Response) => {
  const data = refreshSchema.parse(req.body);

  await logout(data.refreshToken);
  return res.status(204).send();
});

export const simpleSignInHandler = catchAsync(async (req: Request, res: Response) => {
  const data = simpleAuthSchema.parse(req.body);

  const authData = await signInSimple(data.email, data.name, getDeviceContext(req));
  return res.status(200).json(authData);
});
