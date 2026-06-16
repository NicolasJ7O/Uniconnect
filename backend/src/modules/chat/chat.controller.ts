import type { Request, Response, NextFunction } from 'express';
import { chatService } from './chat.service.js';

export class ChatController {
  async getGroupHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const { groupId } = req.params;
      const userId = req.user?.sub;
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;

      if (!userId) return res.status(401).json({ message: 'No autenticado' });

      const messages = await chatService.getGroupMessages(groupId, userId, page, limit);
      return res.json(messages);
    } catch (error) {
      next(error);
    }
  }

  async sendGroupMsg(req: Request, res: Response, next: NextFunction) {
    try {
      const { groupId } = req.params;
      const userId = req.user?.sub;
      const { content } = req.body;
      if (!userId) return res.status(401).json({ message: 'No autenticado' });

      let fileUrl, fileName, fileType;
      if (req.file) {
        fileUrl = `/uploads/${req.file.filename}`;
        // Fix for Multer Latin1 corruption of UTF-8 headers
        fileName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
        fileType = req.file.mimetype;
      }

      const pollRaw = req.body.poll;
      const poll = pollRaw
        ? typeof pollRaw === 'string'
          ? JSON.parse(pollRaw)
          : pollRaw
        : undefined;

      const message = await chatService.sendGroupMessage({
        groupId,
        senderId: userId,
        content: content || '',
        fileUrl,
        fileName,
        fileType,
        poll,
        ip: req.ip || req.socket.remoteAddress || undefined,
        metadata: { userAgent: req.headers['user-agent'] },
      });
      return res.status(201).json(message);
    } catch (error) {
      next(error);
    }
  }

  async getPrivateHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const { otherUserId } = req.params;
      const userId = req.user?.sub;
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;

      if (!userId) return res.status(401).json({ message: 'No autenticado' });

      const messages = await chatService.getPrivateMessages(userId, otherUserId, page, limit);
      return res.json(messages);
    } catch (error) {
      next(error);
    }
  }

  async sendPrivateMsg(req: Request, res: Response, next: NextFunction) {
    try {
      const { otherUserId } = req.params;
      const userId = req.user?.sub;
      const { content } = req.body;
      if (!userId) return res.status(401).json({ message: 'No autenticado' });

      let fileUrl, fileName, fileType;
      if (req.file) {
        fileUrl = `/uploads/${req.file.filename}`;
        // Fix for Multer Latin1 corruption of UTF-8 headers
        fileName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
        fileType = req.file.mimetype;
      }

      const message = await chatService.sendPrivateMessage({
        senderId: userId,
        receiverId: otherUserId,
        content: content || '',
        fileUrl,
        fileName,
        fileType,
        ip: req.ip || req.socket.remoteAddress || undefined,
        metadata: { userAgent: req.headers['user-agent'] },
      });
      return res.status(201).json(message);
    } catch (error) {
      next(error);
    }
  }

  async getConversations(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.sub;
      if (!userId) return res.status(401).json({ message: 'No autenticado' });
      
      const conversations = await chatService.getConversations(userId);
      return res.json(conversations);
    } catch (error) {
      next(error);
    }
  }

  async getPoll(req: Request, res: Response, next: NextFunction) {
    try {
      const { groupId, pollId } = req.params;
      const userId = req.user?.sub;
      if (!userId) return res.status(401).json({ message: 'No autenticado' });

      const poll = await chatService.getPoll(groupId, pollId, userId);
      return res.json(poll);
    } catch (error) {
      next(error);
    }
  }

  async votePoll(req: Request, res: Response, next: NextFunction) {
    try {
      const { groupId, pollId } = req.params;
      const userId = req.user?.sub;
      if (!userId) return res.status(401).json({ message: 'No autenticado' });

      const optionIds = Array.isArray(req.body.optionIds)
        ? req.body.optionIds
        : req.body.optionId
          ? [req.body.optionId]
          : [];

      const poll = await chatService.voteOnGroupPoll(groupId, pollId, userId, optionIds);
      return res.json(poll);
    } catch (error) {
      next(error);
    }
  }
}

export const chatController = new ChatController();
