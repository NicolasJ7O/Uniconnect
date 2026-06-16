import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { router } from 'expo-router';
import { authConfig } from '@/constants/AuthConfig';
import { loadSession } from '@/lib/session';
import { useToast } from '@/components/Toast';
import { getPendingOwnershipTransfers, respondToOwnershipTransfer } from '@/lib/study-group-api';
import { Alert } from 'react-native';
import { notificationApi } from '@/lib/notification-api';
import { eventApi } from '@/lib/event-api';

interface NotificationContextType {
    pendingTransfers: any[];
    refreshTransfers: () => Promise<void>;
    socket: Socket | null;
    unreadCount: number;
    refreshUnreadCount: () => Promise<void>;
    decrementUnreadCount: () => void;
    isModalVisible: boolean;
    setModalVisible: (visible: boolean) => void;
    reconnectSocket: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [pendingTransfers, setPendingTransfers] = useState<any[]>([]);
    const [unreadCount, setUnreadCount] = useState<number>(0);
    const [isModalVisible, setModalVisible] = useState(false);
    const { showToast } = useToast();

    const [sessionKey, setSessionKey] = useState(Date.now());

    const reconnectSocket = useCallback(() => {
        setSessionKey(Date.now());
    }, []);

    const refreshTransfers = useCallback(async () => {
        try {
            const transfers = await getPendingOwnershipTransfers();
            setPendingTransfers(transfers);
        } catch (error) {
            console.error('Error refreshing transfers', error);
        }
    }, []);

    const refreshUnreadCount = useCallback(async () => {
        try {
            const notifs = await notificationApi.getNotifications();
            const unread = notifs.filter(n => !n.isRead).length;
            setUnreadCount(unread);
        } catch (error) {
            console.error('Error refreshing unread count', error);
        }
    }, []);

    const decrementUnreadCount = useCallback(() => {
        setUnreadCount(prev => Math.max(0, prev - 1));
    }, []);

    const handleResponse = useCallback(async (groupId: string, requestId: string, accept: boolean) => {
        try {
            await respondToOwnershipTransfer(groupId, requestId, accept);
            showToast(accept ? 'Ahora eres el administrador' : 'Invitación rechazada', 'success');
            const transfers = await getPendingOwnershipTransfers();
            setPendingTransfers(transfers);
            refreshUnreadCount();
        } catch (error) {
            console.error('Error responding to transfer', error);
        }
    }, [showToast, refreshUnreadCount]);

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
                console.log('Socket connected with ID:', newSocket?.id, 'for user:', session.user.id);
                newSocket?.emit('join-user', session.user.id);
                refreshUnreadCount();
                refreshTransfers();
            });

            newSocket.on('study-group-request-rejected', (data) => {
                refreshUnreadCount();
                showToast(
                    `Tu solicitud para el grupo "${data.groupName}" fue rechazada`,
                    'error',
                    () => {
                        router.push({ pathname: '/study-groups' });
                    }
                );
            });

            newSocket.on('study-group-request-accepted', (data) => {
                refreshUnreadCount();
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
                refreshUnreadCount();
                showToast(`Nueva invitación de administración de "${data.groupName}"`, 'info');
                refreshTransfers();
            });

            newSocket.on('ownership-transfer-accepted', (data) => {
                refreshUnreadCount();
                showToast(`¡Transferencia completada! Ya no eres el administrador de ${data.groupName}`, 'success');
            });

            newSocket.on('ownership-transfer-rejected', (data) => {
                refreshUnreadCount();
                showToast(data.message, 'error');
            });

            // Super-admin moderation escalation alert
            newSocket.on('super-admin-alert', (data) => {
                refreshUnreadCount();
                showToast(
                    `⚠️ Alerta de moderación: "${data.userName}" tiene ${data.blockCount} bloqueos por spam`,
                    'error'
                );
            });

            newSocket.on('new-notification', (data) => {
                console.log('Got new-notification event in context:', data);
                refreshUnreadCount();
                refreshTransfers();
                
                // If this is an event invitation, show an accept/reject prompt
                if (data && data.type === 'EVENT_INVITATION') {
                    showToast(data.message, 'info');
                    Alert.alert('Invitación', data.message || 'Te han invitado a un evento', [
                        {
                            text: 'Rechazar',
                            style: 'destructive',
                            onPress: async () => {
                                try {
                                    const token = data.token || data.invitationToken;
                                    if (!token) throw new Error('Token no disponible');
                                    await eventApi.rejectInvitation(token);
                                    showToast('Invitación rechazada', 'success');
                                    refreshUnreadCount();
                                } catch (err) {
                                    console.error('Error rejecting invitation', err);
                                    showToast('No se pudo rechazar la invitación', 'error');
                                }
                            }
                        },
                        {
                            text: 'Aceptar',
                            onPress: async () => {
                                try {
                                    const token = data.token || data.invitationToken;
                                    if (!token) throw new Error('Token no disponible');
                                    await eventApi.acceptInvitation(token);
                                    showToast('Invitación aceptada', 'success');
                                    refreshUnreadCount();
                                    router.push({ pathname: '/events' });
                                } catch (err) {
                                    console.error('Error accepting invitation', err);
                                    showToast('No se pudo aceptar la invitación', 'error');
                                }
                            }
                        }
                    ]);
                    return;
                }

                // When a new chat or system notification arrives, show a toast
                showToast(data.message, 'info', () => {
                    if (data.eventId) {
                        router.push({ pathname: '/events' });
                    } else if (data.groupId) {
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
            refreshUnreadCount();
        }

        init();

        return () => {
            if (newSocket) newSocket.close();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sessionKey, refreshTransfers, refreshUnreadCount, showToast, handleResponse]);

    return (
        <NotificationContext.Provider value={{ 
            pendingTransfers, refreshTransfers, socket, unreadCount, 
            refreshUnreadCount, decrementUnreadCount, isModalVisible, setModalVisible, reconnectSocket 
        }}>
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
