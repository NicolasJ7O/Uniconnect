import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../errors/app-error.js';
import type { UpdateProfileInput } from './student.schemas.js';
import {
  type IPerfil,
  PerfilBase,
  PerfilConEstadisticas,
  PerfilConInsignias,
} from './decorators/profile.decorator.js';

export async function getStudentProfile(userId: string, payload?: any) {
    let user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            id: true,
            email: true,
            name: true,
            avatarUrl: true,
            career: true,
            currentSemester: true,
            subjects: {
                select: {
                    id: true,
                    name: true,
                    code: true,
                    credits: true,
                },
            },
        },
    });

    // Auto-register user from Auth0 if it doesn't exist
    if (!user && payload && payload.email) {
        // First check if a user with this email already exists but with a different ID
        user = await prisma.user.findUnique({
            where: { email: payload.email },
            select: {
                id: true,
                email: true,
                name: true,
                avatarUrl: true,
                career: true,
                currentSemester: true,
                subjects: {
                    select: {
                        id: true,
                        name: true,
                        code: true,
                        credits: true,
                    },
                },
            },
        });

        if (!user) {
            user = await prisma.user.create({
                data: {
                    id: userId,
                    email: payload.email,
                    name: payload.name || payload.nickname || 'New User',
                    avatarUrl: payload.picture || null,
                },
                select: {
                    id: true,
                    email: true,
                    name: true,
                    avatarUrl: true,
                    career: true,
                    currentSemester: true,
                    subjects: {
                        select: {
                            id: true,
                            name: true,
                            code: true,
                            credits: true,
                        },
                    },
                },
            }) as any; // Cast correctly based on Prisma results
        }
    }

    if (!user) {
        throw new AppError(404, 'User not found');
    }

    return user;
}

export async function updateStudentProfile(userId: string, data: UpdateProfileInput, payload?: any) {
    // Resolve DB internal User ID in case of Auth0 mismatch
    let dbUserId = userId;
    if (payload && payload.email) {
        const existing = await prisma.user.findUnique({
            where: { email: payload.email },
            select: { id: true }
        });
        if (existing) {
            dbUserId = existing.id;
        }
    }

    const { career, currentSemester, subjects } = data;

    // Process subjects: create them if they do not exist, and link them to the user.
    // Unlink subjects not in the provided list.

    if (subjects !== undefined) {
        // 1. Unlink all current subjects first
        await prisma.user.update({
            where: { id: dbUserId },
            data: {
                subjects: {
                    set: [], // Clear relations
                },
            },
        });

        // 2. Setup the new ones, using connectOrCreate to not duplicate
        const subjectConnections = subjects.map((subjectName) => ({
            where: { name: subjectName },
            create: { name: subjectName },
        }));

        const user = await prisma.user.update({
            where: { id: dbUserId },
            data: {
                career: career !== undefined ? career : undefined,
                currentSemester: currentSemester !== undefined ? currentSemester : undefined,
                subjects: {
                    connectOrCreate: subjectConnections,
                },
            },
            select: {
                id: true,
                email: true,
                name: true,
                career: true,
                currentSemester: true,
                subjects: true,
            },
        });

        return user;
    } else {
        // Only update primitive fields
        const user = await prisma.user.update({
            where: { id: dbUserId },
            data: {
                career: career !== undefined ? career : undefined,
                currentSemester: currentSemester !== undefined ? currentSemester : undefined,
            },
            select: {
                id: true,
                email: true,
                name: true,
                career: true,
                currentSemester: true,
                subjects: true,
            },
        });

        return user;
    }
}

export async function getAllSubjects() {
    return prisma.subject.findMany({
        orderBy: { name: 'asc' },
    });
}

export async function searchStudentsByName(query: string, searcherId: string, payload?: any) {
    if (!query || query.trim().length === 0) {
        return [];
    }

    // Resolve DB internal User ID in case of Auth0 mismatch
    let dbSearcherId = searcherId;
    if (payload && payload.email) {
        const existing = await prisma.user.findUnique({
            where: { email: payload.email },
            select: { id: true }
        });
        if (existing) {
            dbSearcherId = existing.id;
        }
    }

    // Get the searcher's career to filter by it
    const searcher = await prisma.user.findUnique({
        where: { id: dbSearcherId },
        select: { career: true }
    });

    if (!searcher || !searcher.career) {
        // If the searcher has no career, they shouldn't be searching or get no results
        return [];
    }

    return prisma.user.findMany({
        where: {
            AND: [
                {
                    name: {
                        contains: query,
                        mode: 'insensitive'
                    }
                },
                {
                    career: searcher.career
                },
                {
                    id: { not: dbSearcherId } // Exclude current user
                }
            ]
        },
        select: {
            id: true,
            name: true,
            email: true,
            career: true,
            currentSemester: true,
            avatarUrl: true
        },
        take: 10
    });
}

export async function getStudentProfileById(targetUserId: string, vistaCompleta: boolean) {
    const user = await prisma.user.findUnique({
        where: { id: targetUserId },
        select: {
            id: true,
            email: true,
            name: true,
            avatarUrl: true,
            career: true,
            currentSemester: true,
            subjects: {
                select: {
                    id: true,
                    name: true,
                    code: true,
                    credits: true,
                },
            },
        },
    });

    if (!user) {
        throw new AppError(404, 'Usuario no encontrado');
    }

    // Perfil Base
    let perfil: IPerfil = new PerfilBase(
        user.id,
        user.name || 'Estudiante',
        user.email,
        user.avatarUrl,
        user.career,
        user.currentSemester,
        user.subjects
    );

    if (vistaCompleta) {
        // Fetch stats from DB
        const [gruposCreados, gruposParticipa, mensajesEnviados] = await Promise.all([
            prisma.studyGroup.count({
                where: { ownerId: targetUserId },
            }),
            prisma.studyGroup.count({
                where: {
                    members: {
                        some: { id: targetUserId },
                    },
                },
            }),
            prisma.message.count({
                where: { senderId: targetUserId },
            }),
        ]);

        // Compose with statistics
        perfil = new PerfilConEstadisticas(perfil, {
            gruposCreados,
            gruposParticipa,
            mensajesEnviados,
        });

        // Determine milestones for insignias
        const insignias: string[] = [];
        if (gruposCreados >= 1) {
            insignias.push("Fundador");
        }
        if (gruposParticipa >= 3) {
            insignias.push("Colaborador Estrella");
        }
        if (mensajesEnviados >= 10) {
            insignias.push("Gran Comunicador");
        }
        if (user.subjects && user.subjects.length >= 1) {
            insignias.push("Estudiante Activo");
        }

        // Compose with insignias
        perfil = new PerfilConInsignias(perfil, insignias);
    }

    return perfil.toJSON();
}
