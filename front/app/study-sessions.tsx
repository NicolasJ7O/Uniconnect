import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Stack, router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useToast } from '@/components/Toast';
import { useNotifications } from '@/context/NotificationContext';
import { loadSession, type SessionData } from '@/lib/session';
import { getStudentProfile, type StudentProfile } from '@/lib/student-api';
import {
  studySessionApi,
  type StudySession,
  type StudySessionSeries,
} from '@/lib/study-session-api';

const FREQUENCIES = ['DAILY', 'WEEKLY', 'MONTHLY', 'INTERVAL'] as const;
const WEEKDAY_OPTIONS = [
  { label: 'L', value: 1, short: 'Lun' },
  { label: 'M', value: 2, short: 'Mar' },
  { label: 'X', value: 3, short: 'Mié' },
  { label: 'J', value: 4, short: 'Jue' },
  { label: 'V', value: 5, short: 'Vie' },
  { label: 'S', value: 6, short: 'Sáb' },
  { label: 'D', value: 0, short: 'Dom' },
];
const REMINDER_PRESETS = [5, 15, 60] as const;

type FormState = {
  title: string;
  description: string;
  subjectId: string;
  startAt: string;
  durationMinutes: string;
  recurrenceEnabled: boolean;
  recurrenceFrequency: (typeof FREQUENCIES)[number];
  recurrenceInterval: string;
  recurrenceEndDate: string;
  recurrenceDaysOfWeek: number[];
  recurrenceDayOfMonth: string;
  reminders: number[];
  customReminder: string;
};

type EditorMode =
  | { kind: 'create' }
  | { kind: 'edit-session'; sessionId: string }
  | { kind: 'edit-series'; seriesId: string };

const emptyForm = (defaultSubjectId = ''): FormState => ({
  title: '',
  description: '',
  subjectId: defaultSubjectId,
  startAt: '',
  durationMinutes: '60',
  recurrenceEnabled: false,
  recurrenceFrequency: 'WEEKLY',
  recurrenceInterval: '1',
  recurrenceEndDate: '',
  recurrenceDaysOfWeek: [],
  recurrenceDayOfMonth: '',
  reminders: [15],
  customReminder: '',
});

function toInputDateTime(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

function toIsoFromInput(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

function formatDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString('es-CO', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
}

function recurrenceLabel(series: StudySessionSeries | null) {
  if (!series?.recurrenceConfig) {
    return 'Una sola sesión';
  }

  const { frequency, interval } = series.recurrenceConfig;
  const suffix = interval > 1 ? ` cada ${interval}` : '';
  switch (frequency) {
    case 'DAILY':
      return `Diaria${suffix}`.trim();
    case 'WEEKLY':
      return `Semanal${suffix}`.trim();
    case 'MONTHLY':
      return `Mensual${suffix}`.trim();
    default:
      return `Personalizada${suffix}`.trim();
  }
}

function reminderSummary(minutes: number[]) {
  if (minutes.length === 0) return 'Sin recordatorios';
  return minutes
    .slice()
    .sort((a, b) => a - b)
    .map((minute) => `${minute}m`)
    .join(' · ');
}

export default function StudySessionsScreen() {
  const { showToast } = useToast();
  const { socket } = useNotifications();

  const [session, setSession] = useState<SessionData | null>(null);
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<'upcoming' | 'history'>('upcoming');
  const [editorMode, setEditorMode] = useState<EditorMode>({ kind: 'create' });
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());

  const subjects = useMemo(() => profile?.subjects ?? [], [profile]);

  const loadData = useCallback(async (silent = false) => {
    if (!silent) {
      setIsLoading(true);
    }

    try {
      const currentSession = await loadSession();
      if (!currentSession) {
        router.replace('/signup');
        return;
      }

      setSession(currentSession);
      const [studentProfile, studySessions] = await Promise.all([
        getStudentProfile(),
        studySessionApi.getSessions(),
      ]);

      setProfile(studentProfile);
      setSessions(studySessions);

      if (studentProfile.subjects[0]?.id) {
        setForm((current) => (
          current.subjectId && studentProfile.subjects.some((subject) => subject.id === current.subjectId)
            ? current
            : { ...current, subjectId: studentProfile.subjects[0].id }
        ));
      }
    } catch (error) {
      console.error('Error loading study sessions', error);
      showToast('No se pudieron cargar las sesiones de estudio', 'error');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [showToast]);

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [loadData])
  );

  useEffect(() => {
    if (!socket) return;

    const handleStudySessionUpdate = () => {
      void loadData(true);
    };

    socket.on('study-session-updated', handleStudySessionUpdate);

    return () => {
      socket.off('study-session-updated', handleStudySessionUpdate);
    };
  }, [socket, loadData]);

  const filteredSessions = useMemo(() => {
    const now = Date.now();
    return sessions.filter((item) => {
      const isUpcoming = item.status === 'SCHEDULED' && new Date(item.startAt).getTime() >= now;
      return selectedFilter === 'upcoming' ? isUpcoming : !isUpcoming;
    });
  }, [sessions, selectedFilter]);

  const resetForm = useCallback((defaultSubjectId = subjects[0]?.id ?? '') => {
    setForm(emptyForm(defaultSubjectId));
    setEditorMode({ kind: 'create' });
  }, [subjects]);

  const openCreateModal = () => {
    resetForm(subjects[0]?.id ?? '');
    setIsModalVisible(true);
  };

  const openSessionEditor = (item: StudySession) => {
    setEditorMode({ kind: 'edit-session', sessionId: item.id });
    setForm({
      title: item.title,
      description: item.description ?? '',
      subjectId: item.subjectId,
      startAt: toInputDateTime(item.startAt),
      durationMinutes: String(item.durationMinutes),
      recurrenceEnabled: false,
      recurrenceFrequency: 'WEEKLY',
      recurrenceInterval: '1',
      recurrenceEndDate: '',
      recurrenceDaysOfWeek: [],
      recurrenceDayOfMonth: '',
      reminders: item.reminders.length > 0 ? item.reminders.map((reminder) => reminder.minutesBefore) : [15],
      customReminder: '',
    });
    setIsModalVisible(true);
  };

  const openSeriesEditor = (item: StudySession) => {
    if (!item.series) {
      return openSessionEditor(item);
    }

    setEditorMode({ kind: 'edit-series', seriesId: item.series.id });
    setForm({
      title: item.series.title,
      description: item.series.description ?? '',
      subjectId: item.series.subjectId,
      startAt: toInputDateTime(item.series.baseStartAt),
      durationMinutes: String(item.series.durationMinutes),
      recurrenceEnabled: true,
      recurrenceFrequency: item.series.recurrenceConfig.frequency,
      recurrenceInterval: String(item.series.recurrenceConfig.interval),
      recurrenceEndDate: toInputDateTime(item.series.recurrenceConfig.endDate),
      recurrenceDaysOfWeek: item.series.recurrenceConfig.daysOfWeek ?? [],
      recurrenceDayOfMonth: item.series.recurrenceConfig.dayOfMonth ? String(item.series.recurrenceConfig.dayOfMonth) : '',
      reminders: item.series.reminderMinutes?.length ? item.series.reminderMinutes : [15],
      customReminder: '',
    });
    setIsModalVisible(true);
  };

  const toggleWeekday = (weekday: number) => {
    setForm((current) => ({
      ...current,
      recurrenceDaysOfWeek: current.recurrenceDaysOfWeek.includes(weekday)
        ? current.recurrenceDaysOfWeek.filter((item) => item !== weekday)
        : [...current.recurrenceDaysOfWeek, weekday].sort((a, b) => a - b),
    }));
  };

  const toggleReminderPreset = (minute: number) => {
    setForm((current) => ({
      ...current,
      reminders: current.reminders.includes(minute)
        ? current.reminders.filter((item) => item !== minute)
        : [...current.reminders, minute],
    }));
  };

  const addCustomReminder = () => {
    const parsed = Number(form.customReminder);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      showToast('Ingresa un recordatorio valido en minutos', 'error');
      return;
    }

    setForm((current) => ({
      ...current,
      reminders: current.reminders.includes(parsed) ? current.reminders : [...current.reminders, parsed],
      customReminder: '',
    }));
  };

  const confirmAction = useCallback((message: string) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      return window.confirm(message);
    }

    return new Promise<boolean>((resolve) => {
      Alert.alert('Confirmar accion', message, [
        { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Confirmar', style: 'destructive', onPress: () => resolve(true) },
      ]);
    });
  }, []);

  const handleDeleteSession = async (item: StudySession) => {
    const accepted = await confirmAction('Esta accion cancelara solo esta ocurrencia.');
    if (!accepted) {
      return;
    }

    try {
      await studySessionApi.cancelSession(item.id);
      showToast('Ocurrencia cancelada', 'success');
      void loadData(true);
    } catch (error: any) {
      console.error('Error canceling session', error);
      showToast(error?.response?.data?.message || 'No se pudo cancelar la sesion', 'error');
    }
  };

  const handleDeleteSeries = async (item: StudySession) => {
    if (!item.seriesId) {
      return handleDeleteSession(item);
    }

    const accepted = await confirmAction('Esta accion cancelara toda la serie futura.');
    if (!accepted) {
      return;
    }

    try {
      await studySessionApi.cancelSeries(item.seriesId);
      showToast('Serie cancelada', 'success');
      void loadData(true);
    } catch (error: any) {
      console.error('Error canceling series', error);
      showToast(error?.response?.data?.message || 'No se pudo cancelar la serie', 'error');
    }
  };

  const handleSubmit = async () => {
    if (!form.title.trim() || !form.subjectId || !form.startAt.trim() || !form.durationMinutes.trim()) {
      showToast('Completa los campos obligatorios', 'error');
      return;
    }

    const startAt = toIsoFromInput(form.startAt);
    if (!startAt) {
      showToast('Fecha de inicio invalida', 'error');
      return;
    }

    const durationMinutes = Number(form.durationMinutes);
    if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
      showToast('La duracion debe ser un numero valido', 'error');
      return;
    }

    const reminders = form.reminders.length > 0 ? form.reminders : [15];
    const payloadBase = {
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      subjectId: form.subjectId,
      startAt,
      durationMinutes,
      reminders: reminders.map((minutesBefore) => ({ minutesBefore })),
    };

    const recurrence = form.recurrenceEnabled
      ? {
          frequency: form.recurrenceFrequency,
          interval: Number(form.recurrenceInterval) || 1,
          endDate: toIsoFromInput(form.recurrenceEndDate),
          daysOfWeek: form.recurrenceDaysOfWeek.length > 0 ? form.recurrenceDaysOfWeek : undefined,
          dayOfMonth: form.recurrenceDayOfMonth.trim() ? Number(form.recurrenceDayOfMonth) : undefined,
        }
      : undefined;

    if (form.recurrenceEnabled && !recurrence?.endDate) {
      showToast('Define la fecha final de la serie recurrente', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editorMode.kind === 'edit-series') {
        await studySessionApi.updateSeries(editorMode.seriesId, {
          ...payloadBase,
          recurrence,
          effectiveFrom: new Date().toISOString(),
        });
        showToast('Serie actualizada', 'success');
      } else if (editorMode.kind === 'edit-session') {
        await studySessionApi.updateSession(editorMode.sessionId, payloadBase);
        showToast('Sesion actualizada', 'success');
      } else {
        await studySessionApi.createSession({
          ...payloadBase,
          recurrence,
        });
        showToast('Sesion creada con exito', 'success');
      }

      setIsModalVisible(false);
      resetForm(form.subjectId);
      void loadData(true);
    } catch (error: any) {
      console.error('Error saving study session', error);
      showToast(error?.response?.data?.message || 'No se pudo guardar la sesion', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const upcomingCount = sessions.filter((item) => item.status === 'SCHEDULED' && new Date(item.startAt).getTime() >= Date.now()).length;
  const historyCount = sessions.length - upcomingCount;

  if (isLoading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#003e70" />
        <Text style={styles.loaderText}>Cargando sesiones de estudio...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Sesiones de Estudio' }} />

      <View style={styles.hero}>
        <Text style={styles.heroTitle}>Sesiones de estudio</Text>
        <Text style={styles.heroText}>
          Programa, sincroniza y recibe recordatorios antes de cada bloque.
        </Text>

        <View style={styles.heroStats}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{upcomingCount}</Text>
            <Text style={styles.statLabel}>Próximas</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{historyCount}</Text>
            <Text style={styles.statLabel}>Históricas</Text>
          </View>
        </View>
      </View>

      <View style={styles.filterRow}>
        <Pressable
          style={[styles.filterChip, selectedFilter === 'upcoming' && styles.filterChipActive]}
          onPress={() => setSelectedFilter('upcoming')}
        >
          <Text style={[styles.filterChipText, selectedFilter === 'upcoming' && styles.filterChipTextActive]}>
            Próximas
          </Text>
        </Pressable>
        <Pressable
          style={[styles.filterChip, selectedFilter === 'history' && styles.filterChipActive]}
          onPress={() => setSelectedFilter('history')}
        >
          <Text style={[styles.filterChipText, selectedFilter === 'history' && styles.filterChipTextActive]}>
            Historial
          </Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.list}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={() => {
            setIsRefreshing(true);
            void loadData(true);
          }} />
        }
      >
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            {selectedFilter === 'upcoming' ? 'Próximas sesiones' : 'Sesiones anteriores'}
          </Text>
          <Pressable style={styles.primaryButton} onPress={openCreateModal}>
            <Text style={styles.primaryButtonText}>+ Nueva sesión</Text>
          </Pressable>
        </View>

        {filteredSessions.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={44} color="#94a3b8" />
            <Text style={styles.emptyTitle}>Todavía no hay sesiones para mostrar</Text>
            <Text style={styles.emptySubtitle}>Crea una sesión individual o una serie recurrente.</Text>
          </View>
        ) : (
          filteredSessions.map((item) => {
            const isCreator = session?.user.id === item.creatorId;
            const isUpcoming = item.status === 'SCHEDULED' && new Date(item.startAt).getTime() >= Date.now();

            return (
              <View key={item.id} style={styles.card}>
                <View style={styles.cardTopRow}>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{recurrenceLabel(item.series)}</Text>
                  </View>
                  <Text style={styles.statusText}>
                    {item.status === 'SCHEDULED' ? 'Activa' : item.status === 'CANCELED' ? 'Cancelada' : 'Finalizada'}
                  </Text>
                </View>

                <Text style={styles.cardTitle}>{item.title}</Text>
                {!!item.description && <Text style={styles.cardText}>{item.description}</Text>}

                <View style={styles.metaRow}>
                  <Ionicons name="book-outline" size={16} color="#0a7ea4" />
                  <Text style={styles.metaText}>{item.subject.name}</Text>
                </View>
                <View style={styles.metaRow}>
                  <Ionicons name="time-outline" size={16} color="#0a7ea4" />
                  <Text style={styles.metaText}>{formatDateTime(item.startAt)} · {item.durationMinutes} min</Text>
                </View>
                <View style={styles.metaRow}>
                  <Ionicons name="notifications-outline" size={16} color="#0a7ea4" />
                  <Text style={styles.metaText}>{reminderSummary(item.reminders.map((reminder) => reminder.minutesBefore))}</Text>
                </View>

                <View style={styles.participantRow}>
                  <Text style={styles.participantLabel}>
                    Participantes: {item.participants.length}
                  </Text>
                  <Text style={styles.participantLabel}>
                    {item.series ? `Serie #${item.occurrenceIndex}` : 'Sesión única'}
                  </Text>
                </View>

                {isCreator && isUpcoming && (
                  <View style={styles.actionsRow}>
                    <Pressable
                      style={[styles.actionButton, styles.secondaryAction]}
                      onPress={() => (item.seriesId ? openSeriesEditor(item) : openSessionEditor(item))}
                    >
                      <Text style={styles.secondaryActionText}>
                        {item.seriesId ? 'Editar serie' : 'Editar'}
                      </Text>
                    </Pressable>
                    <Pressable
                      style={[styles.actionButton, styles.dangerAction]}
                      onPress={() => void handleDeleteSession(item)}
                    >
                      <Text style={styles.dangerActionText}>Cancelar ocurrencia</Text>
                    </Pressable>
                    {item.seriesId && (
                      <Pressable
                        style={[styles.actionButton, styles.dangerAction]}
                        onPress={() => void handleDeleteSeries(item)}
                      >
                        <Text style={styles.dangerActionText}>Cancelar serie</Text>
                      </Pressable>
                    )}
                  </View>
                )}
              </View>
            );
          })
        )}

        <View style={{ height: 24 }} />
      </ScrollView>

      <Modal
        visible={isModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setIsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {editorMode.kind === 'create' ? 'Nueva sesión' : editorMode.kind === 'edit-series' ? 'Editar serie' : 'Editar sesión'}
            </Text>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.label}>Título *</Text>
              <TextInput
                style={styles.input}
                value={form.title}
                onChangeText={(value) => setForm((current) => ({ ...current, title: value }))}
                placeholder="Ej. Álgebra lineal"
              />

              <Text style={styles.label}>Descripción</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={form.description}
                onChangeText={(value) => setForm((current) => ({ ...current, description: value }))}
                placeholder="Objetivos de estudio..."
                multiline
                numberOfLines={4}
              />

              <Text style={styles.label}>Asignatura *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.subjectRow}>
                {subjects.map((subject) => (
                  <Pressable
                    key={subject.id}
                    style={[styles.subjectChip, form.subjectId === subject.id && styles.subjectChipActive]}
                    onPress={() => setForm((current) => ({ ...current, subjectId: subject.id }))}
                  >
                    <Text style={[styles.subjectChipText, form.subjectId === subject.id && styles.subjectChipTextActive]}>
                      {subject.name}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>

              <Text style={styles.label}>Fecha y hora de inicio *</Text>
              <TextInput
                style={styles.input}
                value={form.startAt}
                onChangeText={(value) => setForm((current) => ({ ...current, startAt: value }))}
                placeholder="2026-06-15T14:00"
              />

              <Text style={styles.label}>Duración en minutos *</Text>
              <TextInput
                style={styles.input}
                value={form.durationMinutes}
                onChangeText={(value) => setForm((current) => ({ ...current, durationMinutes: value }))}
                keyboardType="numeric"
                placeholder="60"
              />

              <View style={styles.switchRow}>
                <Text style={styles.label}>Serie recurrente</Text>
                <Pressable
                  style={[styles.switchPill, form.recurrenceEnabled && styles.switchPillActive]}
                  onPress={() => setForm((current) => ({ ...current, recurrenceEnabled: !current.recurrenceEnabled }))}
                >
                  <Text style={[styles.switchPillText, form.recurrenceEnabled && styles.switchPillTextActive]}>
                    {form.recurrenceEnabled ? 'Activada' : 'Desactivada'}
                  </Text>
                </Pressable>
              </View>

              {form.recurrenceEnabled && (
                <>
                  <Text style={styles.label}>Frecuencia</Text>
                  <View style={styles.chipGrid}>
                    {FREQUENCIES.map((frequency) => (
                      <Pressable
                        key={frequency}
                        style={[styles.optionChip, form.recurrenceFrequency === frequency && styles.optionChipActive]}
                        onPress={() => setForm((current) => ({ ...current, recurrenceFrequency: frequency }))}
                      >
                        <Text style={[styles.optionChipText, form.recurrenceFrequency === frequency && styles.optionChipTextActive]}>
                          {frequency}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  <Text style={styles.label}>Intervalo</Text>
                  <TextInput
                    style={styles.input}
                    value={form.recurrenceInterval}
                    onChangeText={(value) => setForm((current) => ({ ...current, recurrenceInterval: value }))}
                    keyboardType="numeric"
                    placeholder="1"
                  />

                  <Text style={styles.label}>Fecha final de la serie *</Text>
                  <TextInput
                    style={styles.input}
                    value={form.recurrenceEndDate}
                    onChangeText={(value) => setForm((current) => ({ ...current, recurrenceEndDate: value }))}
                    placeholder="2026-08-15T23:59"
                  />

                  {form.recurrenceFrequency === 'WEEKLY' && (
                    <>
                      <Text style={styles.label}>Días de la semana</Text>
                      <View style={styles.chipGrid}>
                        {WEEKDAY_OPTIONS.map((weekday) => (
                          <Pressable
                            key={weekday.value}
                            style={[
                              styles.optionChip,
                              form.recurrenceDaysOfWeek.includes(weekday.value) && styles.optionChipActive,
                            ]}
                            onPress={() => toggleWeekday(weekday.value)}
                          >
                            <Text
                              style={[
                                styles.optionChipText,
                                form.recurrenceDaysOfWeek.includes(weekday.value) && styles.optionChipTextActive,
                              ]}
                            >
                              {weekday.short}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    </>
                  )}

                  {form.recurrenceFrequency === 'MONTHLY' && (
                    <>
                      <Text style={styles.label}>Día del mes</Text>
                      <TextInput
                        style={styles.input}
                        value={form.recurrenceDayOfMonth}
                        onChangeText={(value) => setForm((current) => ({ ...current, recurrenceDayOfMonth: value }))}
                        keyboardType="numeric"
                        placeholder="15"
                      />
                    </>
                  )}
                </>
              )}

              <Text style={styles.label}>Recordatorios</Text>
              <View style={styles.chipGrid}>
                {REMINDER_PRESETS.map((minute) => (
                  <Pressable
                    key={minute}
                    style={[styles.optionChip, form.reminders.includes(minute) && styles.optionChipActive]}
                    onPress={() => toggleReminderPreset(minute)}
                  >
                    <Text style={[styles.optionChipText, form.reminders.includes(minute) && styles.optionChipTextActive]}>
                      {minute} min
                    </Text>
                  </Pressable>
                ))}
              </View>

              <View style={styles.customReminderRow}>
                <TextInput
                  style={[styles.input, styles.customReminderInput]}
                  value={form.customReminder}
                  onChangeText={(value) => setForm((current) => ({ ...current, customReminder: value }))}
                  keyboardType="numeric"
                  placeholder="Personalizado"
                />
                <Pressable style={styles.smallButton} onPress={addCustomReminder}>
                  <Text style={styles.smallButtonText}>Agregar</Text>
                </Pressable>
              </View>

              <View style={styles.reminderList}>
                {form.reminders.slice().sort((a, b) => a - b).map((minute) => (
                  <View key={minute} style={styles.reminderPill}>
                    <Text style={styles.reminderPillText}>{minute} min</Text>
                    <Pressable onPress={() => setForm((current) => ({ ...current, reminders: current.reminders.filter((item) => item !== minute) }))}>
                      <Ionicons name="close-circle" size={16} color="#ef4444" />
                    </Pressable>
                  </View>
                ))}
              </View>

              <View style={styles.modalActions}>
                <Pressable
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => setIsModalVisible(false)}
                  disabled={isSubmitting}
                >
                  <Text style={styles.cancelButtonText}>Cancelar</Text>
                </Pressable>
                <Pressable
                  style={[styles.modalButton, styles.submitButton]}
                  onPress={handleSubmit}
                  disabled={isSubmitting}
                >
                  <Text style={styles.submitButtonText}>
                    {isSubmitting ? 'Guardando...' : 'Guardar'}
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
  hero: {
    backgroundColor: '#003e70',
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 16,
  },
  heroTitle: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '800',
  },
  heroText: {
    color: '#dbeafe',
    marginTop: 4,
    fontSize: 14,
    lineHeight: 20,
  },
  heroStats: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  statNumber: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '800',
  },
  statLabel: {
    color: '#bfdbfe',
    fontSize: 12,
    marginTop: 2,
    fontWeight: '600',
  },
  filterRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  filterChip: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
  },
  filterChipActive: {
    backgroundColor: '#e0f2fe',
    borderColor: '#7dd3fc',
  },
  filterChipText: {
    color: '#475569',
    fontWeight: '700',
  },
  filterChipTextActive: {
    color: '#0369a1',
  },
  list: {
    flex: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  primaryButton: {
    backgroundColor: '#0284c7',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    marginTop: 10,
    fontSize: 16,
    fontWeight: '700',
    color: '#334155',
    textAlign: 'center',
  },
  emptySubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  badge: {
    backgroundColor: '#ecfeff',
    borderColor: '#a5f3fc',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    color: '#0e7490',
    fontSize: 11,
    fontWeight: '700',
  },
  statusText: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '700',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 6,
  },
  cardText: {
    color: '#475569',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 10,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  metaText: {
    color: '#334155',
    fontSize: 13,
    flex: 1,
  },
  participantRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 10,
    gap: 12,
  },
  participantLabel: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
  },
  secondaryAction: {
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  secondaryActionText: {
    color: '#334155',
    fontWeight: '700',
    fontSize: 13,
  },
  dangerAction: {
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  dangerActionText: {
    color: '#b91c1c',
    fontWeight: '700',
    fontSize: 13,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '88%',
    padding: 20,
    paddingBottom: 28,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 16,
  },
  label: {
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
    minHeight: 80,
    textAlignVertical: 'top',
  },
  subjectRow: {
    gap: 8,
    paddingVertical: 4,
  },
  subjectChip: {
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  subjectChipActive: {
    backgroundColor: '#dbeafe',
    borderColor: '#93c5fd',
  },
  subjectChipText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '700',
  },
  subjectChipTextActive: {
    color: '#1d4ed8',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  switchPill: {
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  switchPillActive: {
    backgroundColor: '#dbeafe',
    borderColor: '#93c5fd',
  },
  switchPillText: {
    color: '#475569',
    fontWeight: '700',
    fontSize: 12,
  },
  switchPillTextActive: {
    color: '#1d4ed8',
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionChip: {
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  optionChipActive: {
    backgroundColor: '#ecfeff',
    borderColor: '#a5f3fc',
  },
  optionChipText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '700',
  },
  optionChipTextActive: {
    color: '#0e7490',
  },
  customReminderRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  customReminderInput: {
    flex: 1,
    marginTop: 0,
  },
  smallButton: {
    backgroundColor: '#0a7ea4',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  smallButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  reminderList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  reminderPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  reminderPillText: {
    color: '#1d4ed8',
    fontSize: 12,
    fontWeight: '700',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  modalButton: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  cancelButtonText: {
    color: '#475569',
    fontWeight: '700',
  },
  submitButton: {
    backgroundColor: '#003e70',
  },
  submitButtonText: {
    color: '#fff',
    fontWeight: '800',
  },
});
