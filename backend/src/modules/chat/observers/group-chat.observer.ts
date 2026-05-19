import { getIO } from '../../../lib/socket.js';
import { IChatObserver, ChatEvent } from './chat.subject.js';

export class GroupChatObserver implements IChatObserver {
  async update(event: ChatEvent, data: { isPrivate: boolean; message: any }): Promise<void> {
    if (event === 'NUEVO_MENSAJE' && !data.isPrivate) {
      const io = getIO();
      io.to(`group-${data.message.groupId}`).emit('group-message', data.message);
    }
  }
}
