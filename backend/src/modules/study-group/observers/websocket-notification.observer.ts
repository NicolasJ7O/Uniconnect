import { emitToUser } from '../../../lib/socket.js';
import { IObserver, GrupoEstudioEvent } from './grupo-estudio.subject.js';

export class WebSocketNotificationObserver implements IObserver {
  async update(event: GrupoEstudioEvent, data: any): Promise<void> {
    const notifPayload = data.notif || data;
    
    switch (event) {
      case 'SOLICITUD_INGRESO':
        emitToUser(data.ownerId, 'new-notification', notifPayload);
        break;
      case 'MIEMBRO_ACEPTADO':
        emitToUser(data.userId, 'study-group-request-accepted', { groupId: data.groupId, groupName: data.groupName });
        emitToUser(data.userId, 'new-notification', notifPayload);
        break;
      case 'MIEMBRO_RECHAZADO':
        emitToUser(data.userId, 'study-group-request-rejected', { groupId: data.groupId, groupName: data.groupName, requesterName: data.ownerName });
        emitToUser(data.userId, 'new-notification', notifPayload);
        break;
      case 'TRANSFERENCIA_ADMIN_SOLICITADA':
        emitToUser(data.toId, 'ownership-transfer-requested', { id: data.id, groupId: data.groupId, groupName: data.groupName, fromName: data.fromName });
        emitToUser(data.toId, 'new-notification', notifPayload);
        break;
      case 'TRANSFERENCIA_ADMIN_ACEPTADA':
        emitToUser(data.fromId, 'ownership-transfer-accepted', { groupId: data.groupId, groupName: data.groupName });
        emitToUser(data.fromId, 'new-notification', notifPayload);
        break;
    }
  }
}
