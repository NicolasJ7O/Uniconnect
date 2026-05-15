import { Server } from 'socket.io';
import type { Server as HttpServer } from 'http';

let io: Server;
const userSocketMap = new Map<string, string>(); // socket.id -> userId
const activeUsers = new Set<string>(); // userIds that are online

export function initSocket(server: HttpServer) {
    io = new Server(server, {
        cors: {
            origin: '*', // Adjust for production
            methods: ['GET', 'POST'],
        },
    });

    io.on('connection', (socket) => {
        console.log('Client connected:', socket.id);

        socket.on('join-user', (userId: string) => {
            socket.join(`user-${userId}`);
            userSocketMap.set(socket.id, userId);
            activeUsers.add(userId);
            io.emit('user-status-changed', { userId, status: 'online' });
            console.log(`User ${userId} joined their room`);
        });

        socket.on('check-status', (userId: string) => {
            socket.emit('user-status-changed', { 
                userId, 
                status: activeUsers.has(userId) ? 'online' : 'offline' 
            });
        });

        socket.on('join-group', (groupId: string) => {
            socket.join(`group-${groupId}`);
            console.log(`User ${socket.id} joined group ${groupId}`);
        });

        socket.on('leave-group', (groupId: string) => {
            socket.leave(`group-${groupId}`);
            console.log(`User ${socket.id} left group ${groupId}`);
        });

        socket.on('disconnect', () => {
            const userId = userSocketMap.get(socket.id);
            if (userId) {
                userSocketMap.delete(socket.id);
                // Check if user has other tabs open
                let hasOtherSockets = false;
                for (const uid of userSocketMap.values()) {
                    if (uid === userId) {
                        hasOtherSockets = true;
                        break;
                    }
                }
                if (!hasOtherSockets) {
                    activeUsers.delete(userId);
                    io.emit('user-status-changed', { userId, status: 'offline' });
                }
            }
            console.log('Client disconnected:', socket.id);
        });
    });

    return io;
}

export function getIO() {
    if (!io) {
        throw new Error('Socket.io not initialized');
    }
    return io;
}

export function emitToUser(userId: string, event: string, data: any) {
    if (io) {
        io.to(`user-${userId}`).emit(event, data);
    }
}
