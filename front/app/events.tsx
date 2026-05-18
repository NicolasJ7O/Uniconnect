import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Modal,
  TextInput,
  RefreshControl,
  Platform,
} from 'react-native';
import { useToast } from '@/components/Toast';
import { eventApi, type UniversityEvent } from '@/lib/event-api';
import { getStudentProfile } from '@/lib/student-api';
import { useNotifications } from '@/context/NotificationContext';

const CATEGORIES = ['ACADEMICO', 'CULTURAL', 'DEPORTIVO', 'TECNOLOGIA', 'OTRO'] as const;
const ALL_CATEGORIES_FILTER = ['TODOS', ...CATEGORIES] as const;

export default function EventsScreen() {
  const [events, setEvents] = useState<UniversityEvent[]>([]);
  const [subscriptions, setSubscriptions] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('TODOS');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Creation modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<string>('ACADEMICO');
  const [eventDate, setEventDate] = useState('');
  const [location, setLocation] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { showToast } = useToast();
  const { socket } = useNotifications();

  // Socket listener for real-time creation and deletion of events
  useEffect(() => {
    if (!socket) return;

    const handleNewEvent = (newEvent: UniversityEvent) => {
      setEvents(prev => {
        if (prev.some(e => e.id === newEvent.id)) return prev;
        const updated = [...prev, newEvent];
        // Keep sorted by date
        return updated.sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime());
      });
    };

    const handleDeleteEvent = (data: { id: string }) => {
      setEvents(prev => prev.filter(e => e.id !== data.id));
    };

    socket.on('new-event', handleNewEvent);
    socket.on('delete-event', handleDeleteEvent);

    return () => {
      socket.off('new-event', handleNewEvent);
      socket.off('delete-event', handleDeleteEvent);
    };
  }, [socket]);

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const [eventsData, subsData, profileData] = await Promise.all([
        eventApi.getEvents(),
        eventApi.getMySubscriptions(),
        getStudentProfile().catch(() => null),
      ]);
      setEvents(eventsData);
      setSubscriptions(subsData);
      if (profileData) {
        setCurrentUserId(profileData.id);
      }
    } catch (e) {
      console.error('Error loading events data', e);
      showToast('Error al cargar la información de eventos', 'error');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [showToast]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    void loadData(true);
  }, [loadData]);

  const handleToggleSubscription = async (cat: string) => {
    const isSubscribed = subscriptions.includes(cat);
    try {
      if (isSubscribed) {
        await eventApi.unsubscribeFromCategory(cat);
        setSubscriptions(prev => prev.filter(s => s !== cat));
        showToast(`Te has desuscrito de ${cat}`, 'success');
      } else {
        await eventApi.subscribeToCategory(cat);
        setSubscriptions(prev => [...prev, cat]);
        showToast(`Te has suscrito a ${cat}! Recibirás notificaciones en tiempo real`, 'success');
      }
    } catch (e) {
      console.error('Error toggling subscription', e);
      showToast('Error al actualizar la suscripción', 'error');
    }
  };

  const handleCreateEvent = async () => {
    if (!title.trim() || !description.trim() || !eventDate.trim()) {
      showToast('Por favor completa los campos obligatorios (*)', 'error');
      return;
    }

    // Basic date parsing validation (expects YYYY-MM-DD or similar, format ISO string)
    let parsedDate: string;
    try {
      const d = new Date(eventDate);
      if (isNaN(d.getTime())) {
        throw new Error();
      }
      parsedDate = d.toISOString();
    } catch {
      showToast('Formato de fecha inválido. Usa AAAA-MM-DD o AAAA-MM-DD HH:MM', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      await eventApi.createEvent({
        title: title.trim(),
        description: description.trim(),
        category,
        eventDate: parsedDate,
        location: location.trim() || undefined,
      });
      showToast('¡Evento publicado con éxito!', 'success');
      setIsModalOpen(false);
      // Reset form
      setTitle('');
      setDescription('');
      setCategory('ACADEMICO');
      setEventDate('');
      setLocation('');
      // Reload events list
      void loadData(true);
    } catch (e) {
      console.error('Error creating event', e);
      showToast('Error al publicar el evento', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    try {
      await eventApi.deleteEvent(eventId);
      showToast('Evento eliminado con éxito', 'success');
      setEvents(prev => prev.filter(e => e.id !== eventId));
    } catch (e) {
      console.error('Error deleting event', e);
      showToast('No se pudo eliminar el evento', 'error');
    }
  };

  // Filter events reactively in the frontend
  const filteredEvents = events.filter(e => {
    if (selectedCategory === 'TODOS') return true;
    return e.category === selectedCategory;
  });

  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case 'ACADEMICO':
        return '#0284c7'; // Blue
      case 'CULTURAL':
        return '#8b5cf6'; // Violet
      case 'DEPORTIVO':
        return '#f97316'; // Orange
      case 'TECNOLOGIA':
        return '#14b8a6'; // Teal
      default:
        return '#64748b'; // Gray
    }
  };

  const formatEventDate = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString('es-ES', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#003e70" />
        <Text style={styles.loaderText}>Cargando eventos...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Category selector slider */}
      <View style={styles.categoriesContainer}>
        <Text style={styles.sectionTitle}>Categorías</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesScroll}
        >
          {ALL_CATEGORIES_FILTER.map(cat => {
            const isSelected = selectedCategory === cat;
            const isSubscribed = cat !== 'TODOS' && subscriptions.includes(cat);
            return (
              <View key={cat} style={styles.chipWrapper}>
                <Pressable
                  style={[
                    styles.categoryChip,
                    isSelected && { backgroundColor: getCategoryColor(cat), borderColor: getCategoryColor(cat) },
                  ]}
                  onPress={() => setSelectedCategory(cat)}
                >
                  <Text style={[styles.categoryChipText, isSelected && styles.categoryChipTextActive]}>
                    {cat}
                  </Text>
                </Pressable>
                {cat !== 'TODOS' && (
                  <Pressable
                    style={[
                      styles.subscribeBadge,
                      isSubscribed ? styles.subscribedBadge : styles.unsubscribedBadge,
                    ]}
                    onPress={() => handleToggleSubscription(cat)}
                  >
                    <Text style={styles.subscribeBadgeText}>
                      {isSubscribed ? '🔔' : '🔕'}
                    </Text>
                  </Pressable>
                )}
              </View>
            );
          })}
        </ScrollView>
      </View>

      {/* Events List */}
      <ScrollView
        style={styles.eventsScroll}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.listHeader}>
          <Text style={styles.eventsCountText}>
            {filteredEvents.length} {filteredEvents.length === 1 ? 'evento disponible' : 'eventos disponibles'}
          </Text>
          <Pressable style={styles.createBtn} onPress={() => setIsModalOpen(true)}>
            <Text style={styles.createBtnText}>+ Crear Evento</Text>
          </Pressable>
        </View>

        {filteredEvents.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No hay eventos en esta categoría.</Text>
            <Text style={styles.emptySubtitle}>¡Sé el primero en publicar uno!</Text>
          </View>
        ) : (
          filteredEvents.map(item => {
            const isOrganizer = currentUserId === item.organizerId;
            return (
              <View key={item.id} style={styles.eventCard}>
                <View style={styles.cardHeader}>
                  <View
                    style={[styles.categoryBadge, { backgroundColor: getCategoryColor(item.category) }]}
                  >
                    <Text style={styles.categoryBadgeText}>{item.category}</Text>
                  </View>
                  {isOrganizer && (
                    <Pressable
                      style={styles.deleteCardBtn}
                      onPress={() => handleDeleteEvent(item.id)}
                    >
                      <Text style={styles.deleteCardBtnText}>✕ Eliminar</Text>
                    </Pressable>
                  )}
                </View>

                <Text style={styles.eventTitle}>{item.title}</Text>
                <Text style={styles.eventDescription}>{item.description}</Text>

                <View style={styles.eventMetaRow}>
                  <Text style={styles.metaLabel}>📅 Fecha:</Text>
                  <Text style={styles.metaValue}>{formatEventDate(item.eventDate)}</Text>
                </View>

                {item.location && (
                  <View style={styles.eventMetaRow}>
                    <Text style={styles.metaLabel}>📍 Ubicación:</Text>
                    <Text style={styles.metaValue}>{item.location}</Text>
                  </View>
                )}

                <View style={styles.eventMetaRow}>
                  <Text style={styles.metaLabel}>👤 Organizado por:</Text>
                  <Text style={styles.metaValue}>{item.organizer?.name || 'Estudiante'}</Text>
                </View>
              </View>
            );
          })
        )}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Creation Modal */}
      <Modal
        visible={isModalOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Publicar Nuevo Evento</Text>

            <ScrollView style={styles.modalForm}>
              <Text style={styles.inputLabel}>Título del Evento *</Text>
              <TextInput
                style={styles.input}
                placeholder="Ej. Torneo de Ajedrez Universitario"
                value={title}
                onChangeText={setTitle}
              />

              <Text style={styles.inputLabel}>Categoría *</Text>
              <View style={styles.categoryGrid}>
                {CATEGORIES.map(cat => (
                  <Pressable
                    key={cat}
                    style={[
                      styles.categoryGridItem,
                      category === cat && {
                        backgroundColor: getCategoryColor(cat),
                        borderColor: getCategoryColor(cat),
                      },
                    ]}
                    onPress={() => setCategory(cat)}
                  >
                    <Text
                      style={[
                        styles.categoryGridItemText,
                        category === cat && styles.categoryGridItemTextActive,
                      ]}
                    >
                      {cat}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.inputLabel}>Descripción del Evento *</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Detalla de qué trata el evento, requisitos para asistir, etc."
                multiline
                numberOfLines={4}
                value={description}
                onChangeText={setDescription}
              />

              <Text style={styles.inputLabel}>Fecha y Hora * (AAAA-MM-DD HH:MM)</Text>
              <TextInput
                style={styles.input}
                placeholder="Ej: 2026-06-01 14:00"
                value={eventDate}
                onChangeText={setEventDate}
              />

              <Text style={styles.inputLabel}>Ubicación / Plataforma (Opcional)</Text>
              <TextInput
                style={styles.input}
                placeholder="Ej. Auditorio Central o Sala Zoom"
                value={location}
                onChangeText={setLocation}
              />

              <View style={styles.modalActions}>
                <Pressable
                  style={[styles.btn, styles.cancelBtn]}
                  onPress={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                >
                  <Text style={styles.cancelBtnText}>Cancelar</Text>
                </Pressable>
                <Pressable
                  style={[styles.btn, styles.submitBtn]}
                  onPress={handleCreateEvent}
                  disabled={isSubmitting}
                >
                  <Text style={styles.submitBtnText}>
                    {isSubmitting ? 'Publicando...' : 'Publicar'}
                  </Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  loaderText: {
    marginTop: 10,
    fontSize: 14,
    color: '#475569',
  },
  categoriesContainer: {
    backgroundColor: '#ffffff',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1e293b',
    marginLeft: 16,
    marginBottom: 8,
  },
  categoriesScroll: {
    paddingHorizontal: 12,
    gap: 12,
    flexDirection: 'row',
  },
  chipWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingLeft: 4,
    paddingRight: 6,
    height: 38,
  },
  categoryChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  categoryChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  categoryChipTextActive: {
    color: '#ffffff',
  },
  subscribeBadge: {
    marginLeft: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  subscribedBadge: {
    backgroundColor: '#dcfce7',
  },
  unsubscribedBadge: {
    backgroundColor: '#f1f5f9',
  },
  subscribeBadgeText: {
    fontSize: 11,
  },
  eventsScroll: {
    flex: 1,
    paddingHorizontal: 16,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 16,
  },
  eventsCountText: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
  },
  createBtn: {
    backgroundColor: '#0284c7',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  createBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#475569',
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 4,
    textAlign: 'center',
  },
  eventCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
      },
      android: {
        elevation: 2,
      },
      web: {
        boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
      },
    }),
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  categoryBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
  },
  deleteCardBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: '#fee2e2',
    borderRadius: 6,
  },
  deleteCardBtnText: {
    color: '#ef4444',
    fontSize: 11,
    fontWeight: '700',
  },
  eventTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 6,
  },
  eventDescription: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
    marginBottom: 12,
  },
  eventMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  metaLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
    width: 100,
  },
  metaValue: {
    fontSize: 13,
    color: '#1e293b',
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalForm: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0f172a',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginVertical: 4,
  },
  categoryGridItem: {
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  categoryGridItemText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  categoryGridItemTextActive: {
    color: '#ffffff',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
    marginBottom: 20,
  },
  btn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelBtn: {
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  cancelBtnText: {
    color: '#475569',
    fontSize: 14,
    fontWeight: '700',
  },
  submitBtn: {
    backgroundColor: '#0284c7',
  },
  submitBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
});
