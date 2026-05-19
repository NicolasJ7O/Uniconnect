import React, { useCallback, useState, useEffect } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, Modal, FlatList, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { useNotifications } from '@/context/NotificationContext';
import { notificationApi, Notification } from '@/lib/notification-api';
import { respondToGroupRequest, respondToOwnershipTransfer } from '@/lib/study-group-api';

export default function NotificationModal() {
  const { unreadCount, decrementUnreadCount, refreshUnreadCount, isModalVisible, setModalVisible } = useNotifications();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [resolvedMap, setResolvedMap] = useState<Record<string, string>>({});

  const fetchNotifications = useCallback(async () => {
    setIsLoadingNotifications(true);
    try {
      const notifs = await notificationApi.getNotifications();
      setNotifications(notifs);
      refreshUnreadCount();
    } catch (e) {
      console.error('Error fetching notifications', e);
    } finally {
      setIsLoadingNotifications(false);
    }
  }, [refreshUnreadCount]);

  useEffect(() => {
    fetchNotifications();
  }, [unreadCount, fetchNotifications]);

  useEffect(() => {
    if (isModalVisible) {
      fetchNotifications();
    }
  }, [isModalVisible, fetchNotifications]);

  const handleMarkAsRead = async (id: string, isRead: boolean) => {
    if (isRead) return;
    
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    decrementUnreadCount();
    
    try {
      await notificationApi.markAsRead(id);
    } catch (e) {
      console.error('Error marking as read', e);
      await refreshUnreadCount();
    }
  };

  const handleMarkAllAsRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    try {
      await notificationApi.markAllAsRead();
      refreshUnreadCount();
    } catch (e) {
      console.error('Error marking all as read', e);
      await refreshUnreadCount();
    }
  };

  const handleDeleteNotification = async (id: string, isRead: boolean) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    if (!isRead) {
      decrementUnreadCount();
    }
    
    try {
      await notificationApi.deleteNotification(id);
    } catch (e) {
      console.error('Error deleting notification', e);
      fetchNotifications();
      refreshUnreadCount();
    }
  };

  const handleNotificationPress = async (item: Notification) => {
    await handleMarkAsRead(item.id, item.isRead);
    setModalVisible(false);

    if (item.metadata) {
      const meta = item.metadata as any;
      if (meta.groupId) {
        // @ts-ignore
        router.push({ pathname: '/study-group-chat', params: { id: meta.groupId, title: meta.groupName }});
        return;
      } else if (meta.senderId) {
        // @ts-ignore
        router.push({ pathname: '/private-chat', params: { id: meta.senderId, name: meta.senderName }});
        return;
      }
    }
    
    if (item.type.includes('GROUP') || item.type.includes('REQUEST') || item.type.includes('OWNERSHIP') || item.type.includes('RESOURCE')) {
      router.push('/study-groups');
    }
  };

  const handleJoinRequestAction = async (item: Notification, accept: boolean) => {
    const meta = item.metadata as any;
    if (!meta?.groupId || !meta?.requestId) return;
    
    setProcessingId(item.id);
    try {
      await respondToGroupRequest(meta.groupId, meta.requestId, accept ? 'ACCEPTED' : 'REJECTED');
      const resultMsg = accept
        ? `✓ Solicitud de ${meta.studentName || 'estudiante'} aceptada`
        : `✕ Solicitud de ${meta.studentName || 'estudiante'} rechazada`;
      setResolvedMap(prev => ({ ...prev, [item.id]: resultMsg }));
      setNotifications(prev => prev.map(n => n.id === item.id ? { ...n, isRead: true } : n));
      if (!item.isRead) decrementUnreadCount();
      await notificationApi.markAsRead(item.id);
    } catch (e) {
      console.error('Error responding to join request', e);
    } finally {
      setProcessingId(null);
    }
  };

  const handleOwnershipTransferAction = async (item: Notification, accept: boolean) => {
    const meta = item.metadata as any;
    if (!meta?.groupId || !meta?.requestId) return;
    
    setProcessingId(item.id);
    try {
      await respondToOwnershipTransfer(meta.groupId, meta.requestId, accept);
      const resultMsg = accept
        ? `✓ Transferencia de "${meta.groupName}" aceptada`
        : `✕ Transferencia de "${meta.groupName}" rechazada`;
      setResolvedMap(prev => ({ ...prev, [item.id]: resultMsg }));
      setNotifications(prev => prev.map(n => n.id === item.id ? { ...n, isRead: true } : n));
      if (!item.isRead) decrementUnreadCount();
      await notificationApi.markAsRead(item.id);
    } catch (e) {
      console.error('Error responding to ownership transfer', e);
    } finally {
      setProcessingId(null);
    }
  };

  const renderActionButtons = (item: Notification) => {
    const meta = item.metadata as any;
    const isProcessing = processingId === item.id;
    const resolvedMsg = resolvedMap[item.id];

    // If already acted upon, show result badge instead of buttons
    if (resolvedMsg) {
      const isAccepted = resolvedMsg.startsWith('✓');
      return (
        <View style={[styles.resolvedBadge, isAccepted ? styles.resolvedAccepted : styles.resolvedRejected]}>
          <Text style={styles.resolvedText}>{resolvedMsg}</Text>
        </View>
      );
    }

    if (item.type === 'JOIN_REQUEST' && meta?.actionType === 'JOIN_REQUEST') {
      return (
        <View style={styles.actionRow}>
          <Pressable
            style={[styles.actionBtn, styles.acceptBtn, isProcessing && { opacity: 0.5 }]}
            onPress={() => handleJoinRequestAction(item, true)}
            disabled={isProcessing}
          >
            <Text style={styles.actionBtnText}>{isProcessing ? '...' : '✓ Aceptar'}</Text>
          </Pressable>
          <Pressable
            style={[styles.actionBtn, styles.rejectBtn, isProcessing && { opacity: 0.5 }]}
            onPress={() => handleJoinRequestAction(item, false)}
            disabled={isProcessing}
          >
            <Text style={styles.actionBtnText}>{isProcessing ? '...' : '✕ Rechazar'}</Text>
          </Pressable>
        </View>
      );
    }

    if (item.type === 'OWNERSHIP_TRANSFER_REQUESTED' && meta?.actionType === 'OWNERSHIP_TRANSFER') {
      return (
        <View style={styles.actionRow}>
          <Pressable
            style={[styles.actionBtn, styles.acceptBtn, isProcessing && { opacity: 0.5 }]}
            onPress={() => handleOwnershipTransferAction(item, true)}
            disabled={isProcessing}
          >
            <Text style={styles.actionBtnText}>{isProcessing ? '...' : '✓ Aceptar'}</Text>
          </Pressable>
          <Pressable
            style={[styles.actionBtn, styles.rejectBtn, isProcessing && { opacity: 0.5 }]}
            onPress={() => handleOwnershipTransferAction(item, false)}
            disabled={isProcessing}
          >
            <Text style={styles.actionBtnText}>{isProcessing ? '...' : '✕ Rechazar'}</Text>
          </Pressable>
        </View>
      );
    }

    return null;
  };

  const renderNotification = ({ item }: { item: Notification }) => (
    <View style={[styles.notificationItem, !item.isRead && styles.notificationItemUnread]}>
      {/* Priority Badge (Decorator Pattern) */}
      {(item as any).nivel && (
        <View style={[
          styles.priorityBadge, 
          (item as any).nivel === 'critica' ? styles.priorityCritica : 
          (item as any).nivel === 'urgente' ? styles.priorityUrgente : 
          styles.priorityNormal
        ]}>
          <Text style={[
            styles.priorityText,
            (item as any).nivel === 'critica' ? styles.priorityTextCritica : 
            (item as any).nivel === 'urgente' ? styles.priorityTextUrgente : 
            styles.priorityTextNormal
          ]}>
            {(item as any).nivel.toUpperCase()}
          </Text>
        </View>
      )}

      <TouchableOpacity 
        style={styles.notificationContent}
        onPress={() => handleNotificationPress(item)}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={[styles.notificationText, !item.isRead && styles.notificationTextUnread]}>
            {item.message}
          </Text>
          {!item.isRead && <View style={styles.unreadDot} />}
        </View>
        <Text style={styles.notificationDate}>
          {new Date(item.createdAt).toLocaleDateString()} {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </TouchableOpacity>
      
      {renderActionButtons(item)}

      {/* Inline Action CTA (Decorator Pattern) */}
      {(item as any).accion && !resolvedMap[item.id] && (
        <Pressable
          style={styles.ctaButton}
          onPress={() => {
            handleMarkAsRead(item.id, item.isRead);
            setModalVisible(false);
            router.push((item as any).accion.endpoint);
          }}
        >
          <Text style={styles.ctaButtonLabel}>👉 {(item as any).accion.label}</Text>
        </Pressable>
      )}
      
      <TouchableOpacity onPress={() => handleDeleteNotification(item.id, item.isRead)} style={styles.deleteButton}>
        <Text style={styles.deleteButtonText}>✕</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <Modal
      visible={isModalVisible}
      animationType="slide"
      onRequestClose={() => setModalVisible(false)}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Notificaciones</Text>
          <View style={styles.modalActions}>
            {unreadCount > 0 && (
              <Pressable onPress={handleMarkAllAsRead} style={styles.markAllButton}>
                <Text style={styles.markAllText}>Marcar todo como leído</Text>
              </Pressable>
            )}
            <Pressable onPress={() => setModalVisible(false)} style={styles.closeModalButton}>
              <Text style={styles.closeModalText}>Cerrar</Text>
            </Pressable>
          </View>
        </View>
        
        {isLoadingNotifications ? (
          <ActivityIndicator style={{ marginTop: 40 }} />
        ) : notifications.length > 0 ? (
          <FlatList
            data={notifications}
            keyExtractor={item => item.id}
            renderItem={renderNotification}
            contentContainerStyle={styles.notificationsList}
          />
        ) : (
          <View style={styles.emptyNotifications}>
            <Text style={styles.emptyNotificationsText}>No tienes notificaciones aún.</Text>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  modalActions: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 8,
  },
  markAllButton: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  markAllText: {
    color: '#0f172a',
    fontSize: 12,
    fontWeight: '600',
  },
  closeModalButton: {
    backgroundColor: '#e2e8f0',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  closeModalText: {
    color: '#0f172a',
    fontWeight: 'bold',
  },
  notificationsList: {
    padding: 16,
  },
  notificationItem: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  notificationItemUnread: {
    backgroundColor: '#f0f9ff',
    borderColor: '#bae6fd',
  },
  notificationContent: {
    marginBottom: 4,
  },
  notificationText: {
    fontSize: 15,
    color: '#334155',
    flexShrink: 1,
    flex: 1,
  },
  notificationTextUnread: {
    color: '#0f172a',
    fontWeight: '600',
  },
  notificationDate: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#3b82f6',
    marginLeft: 8,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    marginBottom: 4,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  acceptBtn: {
    backgroundColor: '#10b981',
  },
  rejectBtn: {
    backgroundColor: '#ef4444',
  },
  actionBtnText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 13,
  },
  deleteButton: {
    alignSelf: 'flex-end',
    padding: 6,
    marginTop: 4,
    backgroundColor: '#fee2e2',
    borderRadius: 8,
  },
  deleteButtonText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: 'bold',
  },
  resolvedBadge: {
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  resolvedAccepted: {
    backgroundColor: '#dcfce7',
  },
  resolvedRejected: {
    backgroundColor: '#fee2e2',
  },
  resolvedText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1e293b',
  },
  emptyNotifications: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyNotificationsText: {
    fontSize: 16,
    color: '#64748b',
  },
  priorityBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 6,
  },
  priorityNormal: {
    backgroundColor: '#f1f5f9',
  },
  priorityUrgente: {
    backgroundColor: '#ffedd5',
  },
  priorityCritica: {
    backgroundColor: '#fee2e2',
  },
  priorityText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  priorityTextNormal: {
    color: '#64748b',
  },
  priorityTextUrgente: {
    color: '#ea580c',
  },
  priorityTextCritica: {
    color: '#dc2626',
  },
  ctaButton: {
    marginTop: 8,
    backgroundColor: '#f0fdfa',
    borderWidth: 1,
    borderColor: '#ccfbf1',
    borderRadius: 8,
    paddingVertical: 6,
    alignItems: 'center',
  },
  ctaButtonLabel: {
    fontSize: 12,
    color: '#0d9488',
    fontWeight: 'bold',
  },
});
