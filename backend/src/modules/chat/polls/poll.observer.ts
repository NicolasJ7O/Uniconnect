import { getIO } from '../../../lib/socket.js';
import { IPollObserver, PollEvent } from './poll.subject.js';

export class PollGroupObserver implements IPollObserver {
  async update(event: PollEvent, data: { groupId: string; poll: any }): Promise<void> {
    const io = getIO();

    if (event === 'ENCUESTA_ACTUALIZADA') {
      io.to(`group-${data.groupId}`).emit('poll-updated', data.poll);
    }

    if (event === 'ENCUESTA_CERRADA') {
      io.to(`group-${data.groupId}`).emit('poll-closed', data.poll);
    }
  }
}
