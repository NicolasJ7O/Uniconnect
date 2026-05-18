import { prisma } from '../../../lib/prisma.js';
import { emitToUser } from '../../../lib/socket.js';
import { Observer, StudyGroupEvent } from './study-group.subject.js';

export class NotificationObserver implements Observer {
  async update(event: StudyGroupEvent, data: any): Promise<void> {
    switch (event) {
      case 'JOIN_REQUESTED':
        await this.handleJoinRequested(data);
        break;
      case 'JOIN_REQUEST_ACCEPTED':
        await this.handleJoinRequestAccepted(data);
        break;
      case 'JOIN_REQUEST_REJECTED':
        await this.handleJoinRequestRejected(data);
        break;
      case 'OWNERSHIP_TRANSFERRED':
        await this.handleOwnershipTransferred(data);
        break;
      case 'OWNERSHIP_TRANSFER_REQUESTED':
        await this.handleOwnershipTransferRequested(data);
        break;
      case 'GROUP_CREATED':
        await this.handleGroupCreated(data);
        break;
      case 'RESOURCE_ADDED':
        await this.handleResourceAdded(data);
        break;
    }
  }

  private async handleGroupCreated(data: any) {
    const { ownerId, groupName } = data;
    console.log(`[Notification] Group created: ${groupName} by ${ownerId}`);
  }

  private async handleResourceAdded(data: any) {
    const { groupId, uploaderId, title } = data;
    console.log(`[Notification] New resource '${title}' added to group ${groupId} by ${uploaderId}`);
  }

  private async handleJoinRequested(data: any) {
    const { ownerId, groupId, groupName, studentId, studentName, requestId } = data;
    const message = `${studentName} quiere unirse al grupo '${groupName}'`;
    const metadata = { 
      groupId, 
      groupName, 
      requestId, 
      studentId, 
      studentName,
      actionType: 'JOIN_REQUEST'
    };

    const notif = await prisma.notification.create({
      data: {
        userId: ownerId,
        type: 'JOIN_REQUEST',
        message,
        metadata
      }
    });

    emitToUser(ownerId, 'new-notification', { ...notif, ...metadata });
  }

  private async handleJoinRequestAccepted(data: any) {
    const { userId, groupId, groupName } = data;
    const message = `¡Tu solicitud para unirte al grupo '${groupName}' ha sido aceptada!`;
    const metadata = { groupId, groupName };
    
    const notif = await prisma.notification.create({
      data: {
        userId,
        type: 'REQUEST_ACCEPTED',
        message,
        metadata
      }
    });

    emitToUser(userId, 'study-group-request-accepted', { ...metadata, groupId, groupName });
    emitToUser(userId, 'new-notification', { ...notif, ...metadata });
  }

  private async handleJoinRequestRejected(data: any) {
    const { userId, groupId, groupName, ownerName } = data;
    const message = `Tu solicitud para unirte al grupo '${groupName}' ha sido rechazada`;
    const metadata = { groupId, groupName, requesterName: ownerName };

    const notif = await prisma.notification.create({
      data: {
        userId,
        type: 'REQUEST_REJECTED',
        message,
        metadata
      }
    });

    emitToUser(userId, 'study-group-request-rejected', metadata);
    emitToUser(userId, 'new-notification', { ...notif, ...metadata });
  }

  private async handleOwnershipTransferRequested(data: any) {
    const { toId, id, groupId, groupName, fromName } = data;
    const message = `${fromName} quiere transferirte la administración del grupo '${groupName}'`;
    const metadata = { 
      groupId, 
      groupName, 
      requestId: id,
      fromName,
      actionType: 'OWNERSHIP_TRANSFER'
    };

    const notif = await prisma.notification.create({
      data: {
        userId: toId,
        type: 'OWNERSHIP_TRANSFER_REQUESTED',
        message,
        metadata
      }
    });

    emitToUser(toId, 'ownership-transfer-requested', { id, groupId, groupName, fromName });
    emitToUser(toId, 'new-notification', { ...notif, ...metadata });
  }

  private async handleOwnershipTransferred(data: any) {
    const { fromId, groupId, groupName } = data;
    const message = `¡Transferencia completada! Ya no eres el administrador de ${groupName}`;
    const metadata = { groupId, groupName };

    const notif = await prisma.notification.create({
      data: {
        userId: fromId,
        type: 'OWNERSHIP_TRANSFERRED',
        message,
        metadata
      }
    });

    emitToUser(fromId, 'ownership-transfer-accepted', metadata);
    emitToUser(fromId, 'new-notification', { ...notif, ...metadata });
  }
}
