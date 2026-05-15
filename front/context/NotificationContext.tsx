import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { router } from 'expo-router';
import { authConfig } from '@/constants/AuthConfig';
import { loadSession } from '@/lib/session';
import { useToast } from '@/components/Toast';
import { getPendingOwnershipTransfers, respondToOwnershipTransfer } from '@/lib/study-group-api';
import { Alert } from 'react-native';

interface NotificationContextType {
    pendingTransfers: any[];
    refreshTransfers: () => Promise<void>;
    socket: Socket | null;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [pendingTransfers, setPendingTransfers] = useState<any[]>([]);
    const { showToast } = useToast();

    const refreshTransfers = useCallback(async () => {
        try {
            const transfers = await getPendingOwnershipTransfers();
            setPendingTransfers(transfers);
        } catch (error) {
            console.error('Error refreshing transfers', error);
        }
    }, []);

    const handleResponse = useCallback(async (groupId: string, requestId: string, accept: boolean) => {
        try {
            await respondToOwnershipTransfer(groupId, requestId, accept);
            showToast(accept ? 'Ahora eres el administrador' : 'Invitación rechazada', 'success');
            const transfers = await getPendingOwnershipTransfers();
            setPendingTransfers(transfers);
        } catch (error) {
            console.error('Error responding to transfer', error);
        }
    }, [showToast]);

    useEffect(() => {
        let newSocket: Socket | null = null;

        async function init() {
            const session = await loadSession();
            if (!session) {
                if (socket) {
                    socket.disconnect();
                    setSocket(null);
                }
                return;
            }

            newSocket = io(authConfig.backendUrl, {
                transports: ['websocket'],
                reconnection: true,
            });

            newSocket.on('connect', () => {
                console.log('Socket connected for user:', session.user.id);
                newSocket?.emit('join-user', session.user.id);
            });

            newSocket.on('study-group-request-rejected', (data) => {
                showToast(
                    `Tu solicitud para el grupo "${data.groupName}" fue rechazada`,
                    'error',
                    () => {
                        router.push({ pathname: '/study-groups' });
                    }
                );
            });

            newSocket.on('study-group-request-accepted', (data) => {
                showToast(
                    `¡Te aceptaron en el grupo "${data.groupName}"!`,
                    'success',
                    () => {
                        // @ts-ignore
                        router.push({ pathname: '/study-group-chat', params: { id: data.groupId, title: data.groupName }});
                    }
                );
            });

            newSocket.on('ownership-transfer-requested', (data) => {
                showToast(`Nueva invitación de administración: ${data.groupName}`, 'info');
                refreshTransfers();
                
                Alert.alert(
                    'Nueva Invitación de Administración',
                    `${data.fromName} quiere entregarte la administración del grupo "${data.groupName}". ¿Aceptas?`,
                    [
                        { 
                            text: 'Rechazar', 
                            style: 'cancel',
                            onPress: () => handleResponse(data.groupId, data.id, false)
                        },
                        { 
                            text: 'Aceptar', 
                            onPress: () => handleResponse(data.groupId, data.id, true)
                        }
                    ]
                );
            });

            newSocket.on('ownership-transfer-accepted', (data) => {
                showToast(`¡Transferencia completada! Ya no eres el administrador de ${data.groupName}`, 'success');
            });

            newSocket.on('ownership-transfer-rejected', (data) => {
                showToast(data.message, 'error');
            });

            newSocket.on('new-notification', (data) => {
                // When a new chat or system notification arrives, show a toast
                showToast(data.message, 'info', () => {
                    if (data.groupId) {
                        // @ts-ignore
                        router.push({ pathname: '/study-group-chat', params: { id: data.groupId, title: data.groupName }});
                    } else if (data.senderId) {
                        // @ts-ignore
                        router.push({ pathname: '/private-chat', params: { id: data.senderId, name: data.senderName }});
                    }
                });
            });

            setSocket(newSocket);
            refreshTransfers();
        }

        init();

        return () => {
            if (newSocket) newSocket.close();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [refreshTransfers, showToast, handleResponse]);

    return (
        <NotificationContext.Provider value={{ pendingTransfers, refreshTransfers, socket }}>
            {children}
        </NotificationContext.Provider>
    );
};

export const useNotifications = () => {
    const context = useContext(NotificationContext);
    if (context === undefined) {
        throw new Error('useNotifications must be used within a NotificationProvider');
    }
    return context;
};
