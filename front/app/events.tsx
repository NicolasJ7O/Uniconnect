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
  Image,
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
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [searchText, setSearchText] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [availabilityFilter, setAvailabilityFilter] = useState<'all' | 'available' | 'full'>('all');
  const [page, setPage] = useState(1);
  const [totalResults, setTotalResults] = useState(0);
  const [hasMore, setHasMore] = useState(false);
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
  const [isPrivateEvent, setIsPrivateEvent] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [selectedEventForInvite, setSelectedEventForInvite] = useState<null | UniversityEvent>(null);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrImage, setQrImage] = useState<string | null>(null);

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

    const handleAttendanceUpdated = (data: { eventId: string; attendanceCount: number; isAttending: boolean; attendees: any[] }) => {
      setEvents(prev => prev.map(event =>
        event.id === data.eventId
          ? { ...event, attendanceCount: data.attendanceCount, isAttending: data.isAttending, attendees: data.attendees }
          : event
      ));
    };

    socket.on('new-event', handleNewEvent);
    socket.on('delete-event', handleDeleteEvent);
    socket.on('attendance-updated', handleAttendanceUpdated);

    return () => {
      socket.off('new-event', handleNewEvent);
      socket.off('delete-event', handleDeleteEvent);
      socket.off('attendance-updated', handleAttendanceUpdated);
    };
  }, [socket]);

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const [eventsResponse, subsData, profileData] = await Promise.all([
        eventApi.getEvents({
          categories: selectedCategories.length ? selectedCategories : undefined,
          search: searchText.trim() || undefined,
          fromDate: fromDate || undefined,
          toDate: toDate || undefined,
          availability: availabilityFilter === 'all' ? undefined : availabilityFilter,
          limit: 10,
          offset: (page - 1) * 10,
        }),
        eventApi.getMySubscriptions(),
        getStudentProfile().catch(() => null),
      ]);
      setEvents(eventsResponse.items);
      setTotalResults(eventsResponse.total);
      setHasMore(eventsResponse.hasMore);
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
  }, [availabilityFilter, fromDate, page, searchText, selectedCategories, showToast, toDate]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      void loadData(true);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchText]);

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    void loadData(true);
  }, [loadData]);

  const toggleCategory = (cat: string) => {
    setSelectedCategories(prev => {
      if (cat === 'TODOS') return [];
      if (prev.includes(cat)) return prev.filter(item => item !== cat);
      return [...prev, cat];
    });
    setPage(1);
  };

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
        isPrivate: isPrivateEvent,
      });
      showToast('¡Evento publicado con éxito!', 'success');
      setIsModalOpen(false);
      // Reset form
      setTitle('');
      setDescription('');
      setCategory('ACADEMICO');
      setEventDate('');
      setLocation('');
      setIsPrivateEvent(false);
      // Reload events list
      void loadData(true);
    } catch (e) {
      console.error('Error creating event', e);
      showToast('Error al publicar el evento', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleAttendance = async (event: UniversityEvent) => {
    try {
      const result = event.isAttending
        ? await eventApi.cancelAttendance(event.id)
        : await eventApi.toggleAttendance(event.id);

      setEvents(prev => prev.map(item => {
        if (item.id !== event.id) return item;

        const nextAttendees = result.attending
          ? item.attendees.some((attendee) => attendee.id === currentUserId)
            ? item.attendees
            : [...item.attendees, { id: currentUserId ?? 'me', name: 'Tú', email: '' }]
          : item.attendees.filter((attendee) => attendee.id !== currentUserId);

        return {
          ...item,
          attendanceCount: result.attendanceCount,
          isAttending: result.attending,
          attendees: nextAttendees,
        };
      }));

      showToast(result.attending ? '¡Asistencia registrada!' : 'Asistencia cancelada', 'success');
    } catch (e) {
      console.error('Error toggling attendance', e);
      showToast('No se pudo actualizar tu asistencia', 'error');
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
            const isSelected = cat === 'TODOS' ? selectedCategories.length === 0 : selectedCategories.includes(cat);
            const isSubscribed = cat !== 'TODOS' && subscriptions.includes(cat);
            return (
              <View key={cat} style={styles.chipWrapper}>
                <Pressable
                  style={[
                    styles.categoryChip,
                    isSelected && { backgroundColor: getCategoryColor(cat), borderColor: getCategoryColor(cat) },
                  ]}
                  onPress={() => toggleCategory(cat)}
                >
                  <Text numberOfLines={1} style={[styles.categoryChipText, isSelected && styles.categoryChipTextActive]}>
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

      <View style={styles.filterPanel}>
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por título o descripción"
          value={searchText}
          onChangeText={setSearchText}
        />
        <View style={styles.filterRow}>
          <TextInput
            style={[styles.dateInput, { flex: 1, marginRight: 8 }]}
            placeholder="Desde (YYYY-MM-DD)"
            value={fromDate}
            onChangeText={setFromDate}
          />
          <TextInput
            style={[styles.dateInput, { flex: 1 }]}
            placeholder="Hasta (YYYY-MM-DD)"
            value={toDate}
            onChangeText={setToDate}
          />
        </View>
        <View style={styles.filterRow}>
          {(['all', 'available', 'full'] as const).map(option => (
            <Pressable
              key={option}
              style={[styles.availabilityChip, availabilityFilter === option && styles.availabilityChipActive]}
              onPress={() => { setAvailabilityFilter(option); setPage(1); }}
            >
              <Text style={[styles.availabilityChipText, availabilityFilter === option && styles.availabilityChipTextActive]}>
                {option === 'all' ? 'Todos' : option === 'available' ? 'Disponibles' : 'Cupo agotado'}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Events List */}
      <ScrollView
        style={styles.eventsScroll}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.listHeader}>
          <Text style={styles.eventsCountText}>
            {totalResults} {totalResults === 1 ? 'evento disponible' : 'eventos disponibles'}
          </Text>
          <Pressable style={styles.createBtn} onPress={() => setIsModalOpen(true)}>
            <Text style={styles.createBtnText}>+ Crear Evento</Text>
          </Pressable>
        </View>

        {events.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No hay eventos en esta categoría.</Text>
            <Text style={styles.emptySubtitle}>¡Sé el primero en publicar uno!</Text>
          </View>
        ) : (
          events.map(item => {
            const isOrganizer = currentUserId === item.organizerId;
            return (
              <View key={item.id} style={styles.eventCard}>
                <View style={styles.cardHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View
                      style={[styles.categoryBadge, { backgroundColor: getCategoryColor(item.category) }]}
                    >
                      <Text style={styles.categoryBadgeText}>{item.category}</Text>
                    </View>
                    {item.isFull && (
                      <View style={styles.fullBadge}>
                        <Text style={styles.fullBadgeText}>Cupo agotado</Text>
                      </View>
                    )}
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
                  {item.ogImage && (
                    <View style={styles.ogImageWrap}>
                      {Platform.OS === 'web' ? (
                        // web can use img for data URLs
                        <img src={item.ogImage} alt="og" style={{ width: '100%', maxHeight: 200, objectFit: 'cover', borderRadius: 8 }} />
                      ) : (
                        // native Image
                        <Image source={{ uri: item.ogImage }} style={styles.ogImage} />
                      )}
                    </View>
                  )}
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

                <View style={styles.eventMetaRow}>
                  <Text style={styles.metaLabel}>👥 Asistentes:</Text>
                  <Text style={styles.metaValue}>{item.attendanceCount || 0} confirmados</Text>
                </View>

                {item.attendees.length > 0 && (
                  <View style={styles.attendeesContainer}>
                    <Text style={styles.attendeesText}>
                      {item.attendees.map((attendee) => attendee.name || attendee.email || 'Estudiante').join(', ')}
                    </Text>
                  </View>
                )}

                <Pressable
                  style={[styles.attendanceButton, (item.isFull && !item.isAttending) && styles.attendanceButtonDisabled, item.isAttending && styles.attendanceButtonActive]}
                  onPress={() => handleToggleAttendance(item)}
                  disabled={item.isFull && !item.isAttending}
                >
                  <Text style={[styles.attendanceButtonText, item.isAttending && styles.attendanceButtonTextActive]}>
                    {item.isFull && !item.isAttending ? 'Cupo agotado' : item.isAttending ? 'Cancelar asistencia' : 'Voy a asistir'}
                  </Text>
                </Pressable>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                  {isOrganizer && (
                    <Pressable
                      style={[styles.smallBtn, { backgroundColor: '#06b6d4' }]}
                      onPress={() => { setSelectedEventForInvite(item); setInviteModalOpen(true); }}
                    >
                      <Text style={styles.smallBtnText}>Invitar</Text>
                    </Pressable>
                  )}
                  {item.isAttending && (
                    <Pressable
                      style={[styles.smallBtn, { backgroundColor: '#0ea5a3' }]}
                      onPress={async () => {
                        try {
                          const res = await eventApi.generateQr(item.id);
                          setQrImage(res.qrPng);
                          setQrModalOpen(true);
                        } catch (e) {
                          console.error('Error generating QR', e);
                          showToast('No se pudo generar el QR', 'error');
                        }
                      }}
                    >
                      <Text style={styles.smallBtnText}>Generar QR</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            );
          })
        )}
        {hasMore && (
          <View style={styles.paginationRow}>
            <Pressable
              style={[styles.paginationBtn, page === 1 && styles.paginationBtnDisabled]}
              onPress={() => setPage(prev => Math.max(1, prev - 1))}
              disabled={page === 1}
            >
              <Text style={styles.paginationBtnText}>Anterior</Text>
            </Pressable>
            <Text style={styles.paginationInfo}>Página {page}</Text>
            <Pressable
              style={[styles.paginationBtn, !hasMore && styles.paginationBtnDisabled]}
              onPress={() => setPage(prev => prev + 1)}
              disabled={!hasMore}
            >
              <Text style={styles.paginationBtnText}>Siguiente</Text>
            </Pressable>
          </View>
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

              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
                <Text style={{ flex: 1, fontWeight: '700', color: '#334155' }}>Evento privado</Text>
                <Pressable
                  onPress={() => setIsPrivateEvent((v) => !v)}
                  style={{ width: 52, height: 32, borderRadius: 20, backgroundColor: isPrivateEvent ? '#0a7ea4' : '#e2e8f0', justifyContent: 'center', padding: 4 }}
                >
                  <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: '#fff', marginLeft: isPrivateEvent ? 24 : 4 }} />
                </Pressable>
              </View>

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

      {/* Invite Modal */}
      <Modal visible={inviteModalOpen} animationType="slide" transparent onRequestClose={() => setInviteModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Invitar a evento</Text>
            <Text style={{ marginTop: 6 }}>{selectedEventForInvite?.title}</Text>
            <TextInput
              style={[styles.input, { marginTop: 12 }]}
              placeholder="Correo del invitado"
              value={inviteEmail}
              onChangeText={setInviteEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <View style={styles.modalActions}>
              <Pressable style={[styles.btn, styles.cancelBtn]} onPress={() => setInviteModalOpen(false)}>
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </Pressable>
              <Pressable
                style={[styles.btn, styles.submitBtn]}
                onPress={async () => {
                  if (!selectedEventForInvite) return;
                  try {
                    await eventApi.createInvitation(selectedEventForInvite.id, inviteEmail.trim());
                    showToast('Invitación enviada', 'success');
                    setInviteModalOpen(false);
                    setInviteEmail('');
                  } catch (e) {
                    console.error('Error sending invitation', e);
                    showToast('No se pudo enviar la invitación', 'error');
                  }
                }}
              >
                <Text style={styles.submitBtnText}>Enviar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* QR Modal */}
      <Modal visible={qrModalOpen} animationType="slide" transparent onRequestClose={() => setQrModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Pase QR</Text>
            {qrImage ? (
              <ScrollView contentContainerStyle={{ alignItems: 'center' }}>
                <View style={{ marginTop: 12 }}>
                  <Text style={{ marginBottom: 8, color: '#374151' }}>Muestra este QR en la entrada</Text>
                  <View style={{ backgroundColor: '#fff', padding: 8, borderRadius: 12 }}>
                    <img src={qrImage} alt="QR" style={{ width: 280, height: 280 }} />
                  </View>
                </View>
              </ScrollView>
            ) : (
              <Text>Cargando...</Text>
            )}
            <View style={[styles.modalActions, { marginTop: 12 }]}> 
              <Pressable style={[styles.btn, styles.cancelBtn]} onPress={() => setQrModalOpen(false)}>
                <Text style={styles.cancelBtnText}>Cerrar</Text>
              </Pressable>
            </View>
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chipWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  categoryChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    minWidth: 44,
    maxWidth: 160,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
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
    marginLeft: 6,
    width: 28,
    height: 28,
    borderRadius: 14,
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

  ogImageWrap: {
    marginTop: 8,
    marginBottom: 12,
    width: '100%',
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#f8fafc',
  },
  ogImage: {
    width: '100%',
    height: 180,
    resizeMode: 'cover',
    borderRadius: 8,
  },
  filterPanel: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 12,
    marginHorizontal: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0f172a',
    backgroundColor: '#f8fafc',
    marginBottom: 8,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  dateInput: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: '#0f172a',
    backgroundColor: '#f8fafc',
  },
  availabilityChip: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 999,
    paddingVertical: 8,
    alignItems: 'center',
    marginRight: 6,
    backgroundColor: '#f8fafc',
  },
  availabilityChipActive: {
    backgroundColor: '#003e70',
    borderColor: '#003e70',
  },
  availabilityChipText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
  },
  availabilityChipTextActive: {
    color: '#ffffff',
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
  paginationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  paginationBtn: {
    backgroundColor: '#003e70',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  paginationBtnDisabled: {
    backgroundColor: '#cbd5e1',
  },
  paginationBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  paginationInfo: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
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
    overflow: 'hidden',
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
  fullBadge: {
    backgroundColor: '#fee2e2',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  fullBadgeText: {
    color: '#b91c1c',
    fontSize: 11,
    fontWeight: '700',
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
  attendeesContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  attendeesText: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 18,
  },
  attendanceButton: {
    marginTop: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#0284c7',
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#eff6ff',
  },
  attendanceButtonDisabled: {
    backgroundColor: '#e2e8f0',
    borderColor: '#cbd5e1',
  },
  attendanceButtonActive: {
    backgroundColor: '#fee2e2',
    borderColor: '#ef4444',
  },
  attendanceButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0284c7',
  },
  attendanceButtonTextActive: {
    color: '#dc2626',
  },
  smallBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
  },
  smallBtnText: {
    color: '#fff',
    fontWeight: '700',
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
