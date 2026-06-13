import { Router } from 'express';
import { chatController } from './chat.controller.js';
import { requireAuth } from '../auth/auth.middleware.js';
import { upload } from '../../lib/upload.js';

export const chatRouter = Router();

chatRouter.use(requireAuth);

chatRouter.get('/group/:groupId', chatController.getGroupHistory);
chatRouter.post('/group/:groupId', upload.single('file'), chatController.sendGroupMsg);
chatRouter.get('/group/:groupId/polls/:pollId', chatController.getPoll);
chatRouter.post('/group/:groupId/polls/:pollId/votes', chatController.votePoll);

chatRouter.get('/conversations', chatController.getConversations);

chatRouter.get('/private/:otherUserId', chatController.getPrivateHistory);
chatRouter.post('/private/:otherUserId', upload.single('file'), chatController.sendPrivateMsg);
