import { getIO } from '../../../lib/socket.js';
import { IChatObserver, ChatEvent } from './chat.subject.js';

export class PrivateChatObserver implements IChatObserver {
  async update(event: ChatEvent, data: { isPrivate: boolean; message: any }): Promise<void> {
    if (event === 'NUEVO_MENSAJE' && data.isPrivate) {
      const io = getIO();
      const { senderId, receiverId } = data.message;
      io.to(`user-${receiverId}`).emit('private-message', data.message);
      io.to(`user-${senderId}`).emit('private-message', data.message);
    }
  }
}
