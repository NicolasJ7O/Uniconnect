import { Router } from 'express';
import { googleSignInHandler, googleWebSignInHandler, simpleSignInHandler, logoutHandler, refreshHandler, auth0SignInHandler } from './auth.controller.js';

export const authRouter = Router();

authRouter.post('/google', googleSignInHandler);
authRouter.post('/google/web', googleWebSignInHandler);
authRouter.post('/auth0', auth0SignInHandler);
authRouter.post('/simple', simpleSignInHandler);
authRouter.post('/refresh', refreshHandler);
authRouter.post('/logout', logoutHandler);
