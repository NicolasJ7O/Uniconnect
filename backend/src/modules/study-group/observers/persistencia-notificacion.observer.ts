import { prisma } from '../../../lib/prisma.js';
import { IObserver, GrupoEstudioEvent } from './grupo-estudio.subject.js';

export class PersistenciaNotificacionObserver implements IObserver {
  async update(event: GrupoEstudioEvent, data: any): Promise<void> {
    let message = '';
    let userId = '';
    let type = '';
    let metadata: any = {};

    switch (event) {
      case 'SOLICITUD_INGRESO':
        message = `${data.studentName} quiere unirse al grupo '${data.groupName}'`;
        userId = data.ownerId;
        type = 'JOIN_REQUEST';
        metadata = {
          groupId: data.groupId,
          groupName: data.groupName,
          requestId: data.requestId,
          studentId: data.studentId,
          studentName: data.studentName,
          actionType: 'JOIN_REQUEST'
        };
        break;
      case 'MIEMBRO_ACEPTADO':
        message = `¡Tu solicitud para unirte al grupo '${data.groupName}' ha sido aceptada!`;
        userId = data.userId;
        type = 'REQUEST_ACCEPTED';
        metadata = { groupId: data.groupId, groupName: data.groupName };
        break;
      case 'MIEMBRO_RECHAZADO':
        message = `Tu solicitud para unirte al grupo '${data.groupName}' ha sido rechazada`;
        userId = data.userId;
        type = 'REQUEST_REJECTED';
        metadata = { groupId: data.groupId, groupName: data.groupName, requesterName: data.ownerName };
        break;
      case 'TRANSFERENCIA_ADMIN_SOLICITADA':
        message = `${data.fromName} quiere transferirte la administración del grupo '${data.groupName}'`;
        userId = data.toId;
        type = 'OWNERSHIP_TRANSFER_REQUESTED';
        metadata = {
          groupId: data.groupId,
          groupName: data.groupName,
          requestId: data.id,
          fromName: data.fromName,
          actionType: 'OWNERSHIP_TRANSFER'
        };
        break;
      case 'TRANSFERENCIA_ADMIN_ACEPTADA':
        message = `¡Transferencia completada! Ya no eres el administrador de ${data.groupName}`;
        userId = data.fromId;
        type = 'OWNERSHIP_TRANSFERRED';
        metadata = { groupId: data.groupId, groupName: data.groupName };
        break;
    }

    if (userId) {
      // Clean duplicate notifications for group requests if they exist
      if (type === 'JOIN_REQUEST') {
        await prisma.notification.deleteMany({
          where: {
            userId,
            type,
            metadata: {
              path: ['requestId'],
              equals: data.requestId
            }
          }
        }).catch(() => {});
      }

      const notif = await prisma.notification.create({
        data: {
          userId,
          type,
          message,
          metadata
        }
      });
      // Store in data so WebSocketNotificationObserver can read it
      data.notif = { ...notif, ...metadata };
    }
  }
}
