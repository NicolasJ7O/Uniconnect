import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../errors/app-error.js';
import { emitToUser } from '../../lib/socket.js';
import type { CreateStudyGroupInput, UpdateStudyGroupInput, AddMembersInput, CreateResourceInput } from './study-group.schemas.js';
import { studyGroupSubject, grupoEstudioSubject } from './observers/index.js';

export async function getStudyGroupById(groupId: string, userPayload?: any) {
    const group = await prisma.studyGroup.findUnique({
        where: { id: groupId },
        include: {
            owner: { select: { id: true, name: true, email: true } },
            members: { select: { id: true, name: true, email: true, career: true, currentSemester: true } }
        }
    });

    if (!group) throw new AppError(404, 'Grupo no encontrado');

    return group;
}

export async function createStudyGroup(ownerId: string, data: CreateStudyGroupInput, payload?: any) {
    let dbOwnerId = ownerId;
    if (payload && payload.email) {
        const existing = await prisma.user.findUnique({
            where: { email: payload.email },
            select: { id: true }
        });
        if (existing) {
            dbOwnerId = existing.id;
        } else {
            // Create the user if they don't exist (e.g. first time logging in via Auth0)
            const newUser = await prisma.user.create({
                data: {
                    id: ownerId.startsWith('auth0|') ? undefined : ownerId, // Let cuid() handle it if it's an Auth0 sub
                    email: payload.email,
                    name: payload.name || payload.nickname || null,
                }
            });
            dbOwnerId = newUser.id;
        }
    }

    if (data.subjectId) {
        const groupCount = await prisma.studyGroup.count({
            where: { subjectId: data.subjectId }
        });
        if (groupCount >= 3) {
            throw new AppError(400, 'Ya existen 3 grupos registrados para esta asignatura. No se pueden crear más.');
        }
    }

    const group = await prisma.studyGroup.create({
        data: {
            ...data,
            ownerId: dbOwnerId,
            members: {
                connect: { id: dbOwnerId }, // The owner is automatically a member
            },
        },
        include: {
            owner: { select: { id: true, name: true, email: true } },
            members: { select: { id: true, name: true, email: true, career: true, currentSemester: true } },
        }
    });

    studyGroupSubject.notify('GROUP_CREATED', {
        ownerId: dbOwnerId,
        groupId: group.id,
        groupName: group.name
    });

    return group;
}

export async function getStudentStudyGroups(studentId: string, payload?: any) {
    let dbStudentId = studentId;
    if (payload && payload.email) {
        const existing = await prisma.user.findUnique({
            where: { email: payload.email },
            select: { id: true }
        });
        if (existing) {
            dbStudentId = existing.id;
        } else {
            // Create user if missing
            const newUser = await prisma.user.create({
                data: {
                    id: studentId.startsWith('auth0|') ? undefined : studentId,
                    email: payload.email,
                    name: payload.name || payload.nickname || null,
                }
            });
            dbStudentId = newUser.id;
        }
    }

    return prisma.studyGroup.findMany({
        where: {
            members: {
                some: { id: dbStudentId }
            }
        },
        include: {
            owner: { select: { id: true, name: true, email: true } },
            members: { select: { id: true, name: true, email: true, career: true, currentSemester: true } },
        },
        orderBy: { createdAt: 'desc' }
    });
}

export async function getDiscoverableStudyGroups(studentId: string, payload?: any) {
    let dbStudentId = studentId;

    if (payload && payload.email) {
        const student = await prisma.user.findUnique({
            where: { email: payload.email },
            select: { id: true },
        });
        if (student) {
            dbStudentId = student.id;
        }
    }

    // Get the current student's subjects
    const student = await prisma.user.findUnique({
        where: { id: dbStudentId },
        include: { subjects: true }
    });

    if (!student || student.subjects.length === 0) {
        return []; // Return empty if student has no subjects assigned
    }

    const subjectIds = student.subjects.map(s => s.id);

    // Filter groups where the owner has at least one common subject with the student
    return prisma.studyGroup.findMany({
        where: {
            owner: {
                subjects: {
                    some: {
                        id: { in: subjectIds }
                    }
                }
            },
            members: {
                none: {
                    id: dbStudentId
                }
            }
        },
        include: {
            owner: { select: { id: true, name: true, career: true } },
            _count: { select: { members: true } }
        }
    });
}

export async function updateStudyGroup(ownerId: string, groupId: string, data: UpdateStudyGroupInput, payload?: any) {
    let dbOwnerId = ownerId;
    if (payload && payload.email) {
        const existing = await prisma.user.findUnique({
            where: { email: payload.email },
            select: { id: true }
        });
        if (existing) dbOwnerId = existing.id;
    }

    const group = await prisma.studyGroup.findUnique({ where: { id: groupId } });

    if (!group) throw new AppError(404, 'Study group not found');
    if (group.ownerId !== dbOwnerId) throw new AppError(403, 'Only the owner can edit this group');

    return prisma.studyGroup.update({
        where: { id: groupId },
        data,
        include: {
            owner: { select: { id: true, name: true, email: true } },
            members: { select: { id: true, name: true, email: true, career: true, currentSemester: true } },
        }
    });
}

export async function deleteStudyGroup(groupId: string, ownerId: string, payload?: any) {
    let dbOwnerId = ownerId;
    if (payload && payload.email) {
        const existing = await prisma.user.findUnique({
            where: { email: payload.email },
            select: { id: true }
        });
        if (existing) dbOwnerId = existing.id;
    }

    const group = await prisma.studyGroup.findUnique({ where: { id: groupId } });

    if (!group) throw new AppError(404, 'Study group not found');
    if (group.ownerId !== dbOwnerId) throw new AppError(403, 'Only the owner can delete this group');

    return prisma.studyGroup.delete({
        where: { id: groupId }
    });
}

export async function addMembersToGroup(groupId: string, ownerId: string, data: AddMembersInput, payload?: any) {
    let dbOwnerId = ownerId;
    if (payload && payload.email) {
        const existing = await prisma.user.findUnique({
            where: { email: payload.email },
            select: { id: true }
        });
        if (existing) dbOwnerId = existing.id;
    }

    const group = await prisma.studyGroup.findUnique({
        where: { id: groupId },
        include: { owner: true }
    });

    if (!group) throw new AppError(404, 'Study group not found');
    if (group.ownerId !== dbOwnerId) throw new AppError(403, 'Only the owner can add members');

    // Filter/Validate: only students from the same career as the owner can be added
    const studentsToAdd = await prisma.user.findMany({
        where: {
            id: { in: data.memberIds }
        },
        select: { id: true, name: true, career: true }
    });

    for (const student of studentsToAdd) {
        if (student.career !== group.owner.career) {
            throw new AppError(400, `El estudiante ${student.name || student.id} no pertenece a la carrera ${group.owner.career}`);
        }
    }

    return prisma.studyGroup.update({
        where: { id: groupId },
        data: {
            members: {
                connect: data.memberIds.map(id => ({ id }))
            }
        },
        include: {
            owner: { select: { id: true, name: true, email: true } },
            members: { select: { id: true, name: true, email: true, career: true, currentSemester: true } },
        }
    });
}

export async function removeMemberFromGroup(ownerId: string, groupId: string, memberIdToRemove: string, payload?: any, newOwnerId?: string) {
    let dbOwnerId = ownerId;
    if (payload && payload.email) {
        const existing = await prisma.user.findUnique({
            where: { email: payload.email },
            select: { id: true }
        });
        if (existing) dbOwnerId = existing.id;
    }

    const group = await prisma.studyGroup.findUnique({
        where: { id: groupId },
        include: { members: { orderBy: { createdAt: 'asc' } } }
    });

    if (!group) throw new AppError(404, 'Study group not found');

    // Check if the person making the request is valid
    // A member can remove themselves, or the owner can remove any member
    if (dbOwnerId !== memberIdToRemove && group.ownerId !== dbOwnerId) {
        throw new AppError(403, 'Solo el administrador puede eliminar a otros miembros');
    }

    // Attempting to remove self or owner leaving
    if (memberIdToRemove === group.ownerId) {
        const otherMembers = group.members.filter(m => m.id !== group.ownerId);

        if (otherMembers.length > 0) {
            // Requirement: if admin leaves, they MUST choose a new admin
            if (!newOwnerId) {
                throw new AppError(400, 'Como eres el administrador, debes elegir un nuevo administrador antes de salir del grupo');
            }

            // Verify newOwnerId is a member of the group
            const isMember = otherMembers.some(m => m.id === newOwnerId);
            if (!isMember) {
                throw new AppError(400, 'El nuevo administrador debe ser un miembro del grupo');
            }

            return prisma.studyGroup.update({
                where: { id: groupId },
                data: {
                    ownerId: newOwnerId,
                    members: {
                        disconnect: { id: memberIdToRemove }
                    }
                },
                include: {
                    owner: { select: { id: true, name: true, email: true } },
                    members: { select: { id: true, name: true, email: true } }
                }
            });
        } else {
            // Delete group if no members left
            await prisma.studyGroup.delete({ where: { id: groupId } });
            return { deleted: true };
        }
    }

    return prisma.studyGroup.update({
        where: { id: groupId },
        data: {
            members: {
                disconnect: { id: memberIdToRemove }
            }
        },
        include: {
            owner: { select: { id: true, name: true, email: true } },
            members: { select: { id: true, name: true, email: true } }
        }
    });
}

export async function addStudyGroupResource(groupId: string, uploaderId: string, data: CreateResourceInput, payload?: any) {
    let dbUploaderId = uploaderId;
    if (payload && payload.email) {
        const existing = await prisma.user.findUnique({ where: { email: payload.email }, select: { id: true } });
        if (existing) dbUploaderId = existing.id;
    }

    const group = await prisma.studyGroup.findFirst({
        where: { id: groupId, members: { some: { id: dbUploaderId } } }
    });

    if (!group) throw new AppError(403, 'Debes ser miembro del grupo para añadir recursos');

    const resource = await prisma.studyGroupResource.create({
        data: {
            groupId,
            uploaderId: dbUploaderId,
            title: data.title,
            type: data.type,
            url: data.url || ''
        }
    });

    studyGroupSubject.notify('RESOURCE_ADDED', {
        groupId,
        uploaderId: dbUploaderId,
        title: data.title
    });

    return resource;
}

export async function deleteStudyGroupResource(groupId: string, resourceId: string, userId: string, payload?: any) {
    let dbUserId = userId;
    if (payload && payload.email) {
        const existing = await prisma.user.findUnique({ where: { email: payload.email }, select: { id: true } });
        if (existing) dbUserId = existing.id;
    }

    const group = await prisma.studyGroup.findUnique({ where: { id: groupId } });
    if (!group) throw new AppError(404, 'Grupo de estudio no encontrado');

    const resource = await prisma.studyGroupResource.findUnique({ where: { id: resourceId } });
    if (!resource) throw new AppError(404, 'Recurso no encontrado');

    if (group.ownerId !== dbUserId && resource.uploaderId !== dbUserId) {
        throw new AppError(403, 'Solo el autor o el administrador pueden eliminar este recurso');
    }

    return prisma.studyGroupResource.delete({ where: { id: resourceId } });
}

export async function getStudyGroupResources(groupId: string, userId: string, payload?: any) {
    let dbUserId = userId;
    if (payload && payload.email) {
        const existing = await prisma.user.findUnique({ where: { email: payload.email }, select: { id: true } });
        if (existing) dbUserId = existing.id;
    }

    const group = await prisma.studyGroup.findFirst({
        where: { id: groupId, members: { some: { id: dbUserId } } }
    });

    if (!group) throw new AppError(403, 'Debes ser miembro del grupo para ver los recursos');

    return prisma.studyGroupResource.findMany({
        where: { groupId },
        orderBy: { createdAt: 'desc' }
    });
}

// ============== NEW: STUDY GROUP REQUESTS ==============

export async function requestToJoinGroup(studentId: string, groupId: string, payload?: any) {
    let dbStudentId = studentId;
    if (payload && payload.email) {
        const existing = await prisma.user.findUnique({ where: { email: payload.email }, select: { id: true } });
        if (existing) dbStudentId = existing.id;
    }

    // Check if the group exists
    const group = await prisma.studyGroup.findUnique({
        where: { id: groupId },
        include: { members: true }
    });

    if (!group) {
        throw new AppError(404, 'Grupo de estudio no encontrado');
    }

    // Check if already a member
    if (group.members.some(member => member.id === dbStudentId)) {
        throw new AppError(400, 'Ya eres miembro de este grupo');
    }

    // Check if a request already exists
    const existingRequest = await prisma.studyGroupRequest.findUnique({
        where: {
            groupId_userId: {
                groupId: groupId,
                userId: dbStudentId
            }
        }
    });

    if (existingRequest) {
        if (existingRequest.status === 'PENDING') {
            throw new AppError(400, 'Ya has enviado una solicitud a este grupo');
        }
        // If it was rejected, allow resending it by updating to PENDING
    }

    // Create or update the request (upsert with status PENDING)
    const request = await prisma.studyGroupRequest.upsert({
        where: {
            groupId_userId: {
                groupId: groupId,
                userId: dbStudentId
            }
        },
        update: { status: 'PENDING' },
        create: {
            groupId: groupId,
            userId: dbStudentId,
            status: 'PENDING'
        }
    });

    const student = await prisma.user.findUnique({ where: { id: dbStudentId }, select: { name: true } });

    studyGroupSubject.notify('JOIN_REQUESTED', {
        ownerId: group.ownerId,
        groupId: group.id,
        groupName: group.name,
        studentId: dbStudentId,
        studentName: student?.name || 'Un estudiante',
        requestId: request.id
    });

    grupoEstudioSubject.notify('SOLICITUD_INGRESO', {
        ownerId: group.ownerId,
        groupId: group.id,
        groupName: group.name,
        studentId: dbStudentId,
        studentName: student?.name || 'Un estudiante',
        requestId: request.id
    });

    return request;
}

export async function getGroupRequests(ownerId: string, groupId: string, payload?: any) {
    let dbOwnerId = ownerId;
    if (payload && payload.email) {
        const existing = await prisma.user.findUnique({ where: { email: payload.email }, select: { id: true } });
        if (existing) dbOwnerId = existing.id;
    }

    const group = await prisma.studyGroup.findUnique({
        where: { id: groupId }
    });

    if (!group) throw new AppError(404, 'Grupo de estudio no encontrado');
    if (group.ownerId !== dbOwnerId) throw new AppError(403, 'No tienes permiso para ver solicitudes de este grupo');

    return prisma.studyGroupRequest.findMany({
        where: { groupId: groupId, status: 'PENDING' },
        include: {
            user: { select: { id: true, name: true, email: true, career: true, currentSemester: true } }
        }
    });
}

export async function respondToGroupRequest(ownerId: string, groupId: string, requestId: string, status: 'ACCEPTED' | 'REJECTED', payload?: any) {
    let dbOwnerId = ownerId;
    if (payload && payload.email) {
        const existing = await prisma.user.findUnique({ where: { email: payload.email }, select: { id: true } });
        if (existing) dbOwnerId = existing.id;
    }

    const group = await prisma.studyGroup.findUnique({
        where: { id: groupId },
        include: { owner: { select: { id: true, name: true } } }
    });

    if (!group) throw new AppError(404, 'Grupo de estudio no encontrado');
    if (group.ownerId !== dbOwnerId) throw new AppError(403, 'No tienes permiso para responder a esta solicitud');

    const request = await prisma.studyGroupRequest.findUnique({
        where: { id: requestId }
    });

    if (!request || request.groupId !== groupId) throw new AppError(404, 'Solicitud no encontrada');

    // Update Request status
    const updatedRequest = await prisma.studyGroupRequest.update({
        where: { id: requestId },
        data: { status }
    });

    if (status === 'ACCEPTED') {
        // Add user to the group members
        await prisma.studyGroup.update({
            where: { id: groupId },
            data: {
                members: {
                    connect: { id: request.userId }
                }
            }
        });

        studyGroupSubject.notify('JOIN_REQUEST_ACCEPTED', {
            userId: request.userId,
            groupId: group.id,
            groupName: group.name
        });

        grupoEstudioSubject.notify('MIEMBRO_ACEPTADO', {
            userId: request.userId,
            groupId: group.id,
            groupName: group.name
        });
    } else if (status === 'REJECTED') {
        studyGroupSubject.notify('JOIN_REQUEST_REJECTED', {
            userId: request.userId,
            groupId: group.id,
            groupName: group.name,
            ownerName: group.owner.name
        });

        grupoEstudioSubject.notify('MIEMBRO_RECHAZADO', {
            userId: request.userId,
            groupId: group.id,
            groupName: group.name,
            ownerName: group.owner.name
        });
    }

    return updatedRequest;
}


export async function transferGroupOwnership(requesterId: string, groupId: string, newOwnerId: string, payload?: any) {
    let dbRequesterId = requesterId;
    if (payload && payload.email) {
        const existing = await prisma.user.findUnique({ where: { email: payload.email }, select: { id: true } });
        if (existing) dbRequesterId = existing.id;
    }

    const group = await prisma.studyGroup.findUnique({
        where: { id: groupId },
        include: { members: { select: { id: true } } }
    });

    if (!group) throw new AppError(404, 'Grupo de estudio no encontrado');
    if (group.ownerId !== dbRequesterId) throw new AppError(403, 'Solo el administrador puede transferir la administración');

    const isMember = group.members.some(m => m.id === newOwnerId);
    if (!isMember) throw new AppError(400, 'El nuevo administrador debe ser miembro del grupo');
    if (newOwnerId === dbRequesterId) throw new AppError(400, 'No puedes transferirte la administración a ti mismo');

    return prisma.studyGroup.update({
        where: { id: groupId },
        data: { ownerId: newOwnerId },
        include: {
            owner: { select: { id: true, name: true, email: true } },
            members: { select: { id: true, name: true, email: true, career: true, currentSemester: true } },
        }
    });
}

export async function leaveStudyGroup(userId: string, groupId: string, payload?: any) {
    let dbUserId = userId;
    if (payload && payload.email) {
        const existing = await prisma.user.findUnique({ where: { email: payload.email }, select: { id: true } });
        if (existing) dbUserId = existing.id;
    }

    const group = await prisma.studyGroup.findUnique({
        where: { id: groupId },
        include: { members: { select: { id: true } } }
    });

    if (!group) throw new AppError(404, 'Grupo de estudio no encontrado');

    const isMember = group.members.some(m => m.id === dbUserId);
    if (!isMember) throw new AppError(400, 'No eres miembro de este grupo');

    if (group.ownerId === dbUserId) {
        throw new AppError(400, 'Debes transferir la administración antes de abandonar el grupo');
    }

    const remainingCount = group.members.length - 1;
    if (remainingCount === 0) {
        await prisma.studyGroup.delete({ where: { id: groupId } });
        return { deleted: true };
    }

    await prisma.studyGroup.update({
        where: { id: groupId },
        data: { members: { disconnect: { id: dbUserId } } }
    });

    return { left: true };
}

// ============== NEW: OWNERSHIP TRANSFER FLOW ==============

export async function createOwnershipTransferRequest(ownerId: string, groupId: string, newOwnerId: string, payload?: any) {
    let dbOwnerId = ownerId;
    if (payload && payload.email) {
        const existing = await prisma.user.findUnique({ where: { email: payload.email }, select: { id: true } });
        if (existing) dbOwnerId = existing.id;
    }

    const group = await prisma.studyGroup.findUnique({
        where: { id: groupId },
        include: { owner: true }
    });

    if (!group) throw new AppError(404, 'Grupo de estudio no encontrado');
    if (group.ownerId !== dbOwnerId) throw new AppError(403, 'Solo el administrador puede transferir la administración');

    const isMember = await prisma.user.findFirst({
        where: { id: newOwnerId, memberOfGroups: { some: { id: groupId } } }
    });
    if (!isMember) throw new AppError(400, 'El nuevo administrador debe ser miembro del grupo');

    // Create or Update request
    const request = await (prisma as any).ownershipTransferRequest.upsert({
        where: {
            groupId_toId: {
                groupId,
                toId: newOwnerId
            }
        },
        update: { status: 'PENDING', fromId: dbOwnerId },
        create: {
            groupId,
            fromId: dbOwnerId,
            toId: newOwnerId,
            status: 'PENDING'
        }
    });

    // Notify the candidate
    studyGroupSubject.notify('OWNERSHIP_TRANSFER_REQUESTED', {
        toId: newOwnerId,
        id: request.id,
        groupId: group.id,
        groupName: group.name,
        fromName: group.owner.name || group.owner.email
    });

    grupoEstudioSubject.notify('TRANSFERENCIA_ADMIN_SOLICITADA', {
        toId: newOwnerId,
        id: request.id,
        groupId: group.id,
        groupName: group.name,
        fromName: group.owner.name || group.owner.email
    });

    return request;
}

export async function getPendingOwnershipTransfers(userId: string, payload?: any) {
    let dbUserId = userId;
    if (payload && payload.email) {
        const existing = await prisma.user.findUnique({ where: { email: payload.email }, select: { id: true } });
        if (existing) dbUserId = existing.id;
    }

    return (prisma as any).ownershipTransferRequest.findMany({
        where: { toId: dbUserId, status: 'PENDING' },
        include: {
            group: { select: { id: true, name: true } },
            from: { select: { id: true, name: true } }
        }
    });
}

export async function respondToOwnershipTransferRequest(userId: string, groupId: string, requestId: string, accept: boolean, payload?: any) {
    let dbUserId = userId;
    if (payload && payload.email) {
        const existing = await prisma.user.findUnique({ where: { email: payload.email }, select: { id: true } });
        if (existing) dbUserId = existing.id;
    }

    const request = await (prisma as any).ownershipTransferRequest.findUnique({
        where: { id: requestId },
        include: { group: true }
    });

    if (!request || request.groupId !== groupId || request.toId !== dbUserId) {
        throw new AppError(404, 'Solicitud no encontrada');
    }

    if (!accept) {
        await (prisma as any).ownershipTransferRequest.update({
            where: { id: requestId },
            data: { status: 'REJECTED' }
        });

        // Notify the owner that it was rejected
        emitToUser(request.fromId, 'ownership-transfer-rejected', {
            groupId: request.groupId,
            message: 'El miembro ha rechazado la invitación de administración'
        });

        return { status: 'REJECTED' };
    }

    // ACCEPTED logic:
    // 1. Update group owner
    // 2. Remove old owner from group (as per requirements)
    // 3. Update request status
    // 4. Notify old owner to let them leave

    await prisma.$transaction([
        prisma.studyGroup.update({
            where: { id: request.groupId },
            data: { 
                ownerId: dbUserId,
                members: { disconnect: { id: request.fromId } }
            }
        }),
        (prisma as any).ownershipTransferRequest.update({
            where: { id: requestId },
            data: { status: 'ACCEPTED' }
        })
    ]);

    // Notify via observer
    studyGroupSubject.notify('OWNERSHIP_TRANSFERRED', {
        fromId: request.fromId,
        groupId: request.groupId,
        groupName: request.group.name
    });

    grupoEstudioSubject.notify('TRANSFERENCIA_ADMIN_ACEPTADA', {
        fromId: request.fromId,
        groupId: request.groupId,
        groupName: request.group.name
    });

    return { status: 'ACCEPTED' };
}
