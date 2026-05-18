import React, { useCallback, useState, useEffect } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, ScrollView, Modal, FlatList, TouchableOpacity } from 'react-native';
import { clearSession, loadSession, type SessionData } from '@/lib/session';
import { getStudentProfile, type StudentProfile } from '@/lib/student-api';
import { chatApi, type Conversation } from '@/lib/chat-api';
import { logoutWithRefreshToken } from '@/lib/auth-api';
import { useNotifications } from '@/context/NotificationContext';

export default function DashboardScreen() {
  const [session, setSession] = useState<SessionData | null>(null);
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const { reconnectSocket } = useNotifications();

  useFocusEffect(
    useCallback(() => {
      async function hydrateSession() {
        const stored = await loadSession();
        if (!stored) {
          router.replace('/signup');
          return;
        }
        setSession(stored);
        reconnectSocket();

        try {
          const studentData = await getStudentProfile();
          setProfile(studentData);
          const userConversations = await chatApi.getConversations();
          setConversations(userConversations);
        } catch (e) {
          console.error('Error fetching dashboard data', e);
        }

        setIsLoading(false);
      }

      void hydrateSession();
    }, [])
  );

  async function handleLogout() {
    try {
      setIsLoggingOut(true);
      const currentSession = await loadSession();
      if (currentSession?.refreshToken) {
        await logoutWithRefreshToken(currentSession.refreshToken);
      }
    } catch {
      // Ignore errors if backend fails, still clear local session
    } finally {
      await clearSession();
      setIsLoggingOut(false);
      setTimeout(() => {
        router.replace('/');
      }, 0);
    }
  }

  if (isLoading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator />
        <Text style={styles.loaderText}>Cargando sesion...</Text>
      </View>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.headerContainer}>
        <View>
          <Text style={styles.title}>Dashboard</Text>
          <Text style={styles.subtitle}>Bienvenido a UniConnect.</Text>
        </View>
      </View>



      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Tu Perfil Universitario</Text>
          <Pressable onPress={() => router.push('/profile-edit')} style={styles.editButton}>
            <Text style={styles.editButtonText}>Editar</Text>
          </Pressable>
        </View>

        <Text style={styles.cardText}>Correo: {profile?.email || session.user.email}</Text>
        <Text style={styles.cardText}>Nombre: {profile?.name || session.user.name || 'Sin nombre'}</Text>
        <Text style={styles.cardText}>Rol: {session.user.role === 'student' ? 'Estudiante' : session.user.role === 'admin' ? 'Administrador' : session.user.role}</Text>

        {profile && (
          <View style={styles.extraProfileInfo}>
            <View style={styles.divider} />
            <Text style={styles.cardText}>Carrera: {profile.career || 'No especificada'}</Text>
            <Text style={styles.cardText}>Semestre: {profile.currentSemester || 'No especificado'}</Text>

            <Text style={[styles.cardTitle, { marginTop: 12 }]}>Materias inscritas:</Text>
            {profile.subjects.length > 0 ? (
              <View style={styles.subjectTags}>
                {profile.subjects.map(s => (
                  <View key={s.id} style={styles.badge}>
                    <Text style={styles.badgeText}>{s.name}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.cardText}>Ninguna materia inscrita.</Text>
            )}
          </View>
        )}
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Grupos de Estudio</Text>
        </View>
        <Text style={styles.cardText}>Explora los grupos disponibles o gestiona los tuyos.</Text>
        <Pressable style={styles.actionButton} onPress={() => router.push('/study-groups')}>
          <Text style={styles.actionButtonLabel}>Ir a Grupos de Estudio</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Eventos Universitarios</Text>
        </View>
        <Text style={styles.cardText}>Explora eventos, fíltralos por categoría y suscríbete a notificaciones.</Text>
        <Pressable style={[styles.actionButton, { backgroundColor: '#0284c7', borderColor: '#bae6fd' }]} onPress={() => router.push('/events')}>
          <Text style={styles.actionButtonLabel}>Explorar Eventos</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Mensajes Privados</Text>
        {conversations.length > 0 ? (
          conversations.map((conv) => (
            <Pressable
              key={conv.user.id}
              style={styles.chatRow}
              onPress={() => router.push({ pathname: '/private-chat', params: { id: conv.user.id, name: conv.user.name } })}
            >
              <View style={styles.chatAvatar}>
                <Text style={styles.chatAvatarText}>{conv.user.name?.charAt(0) || 'U'}</Text>
              </View>
              <View style={styles.chatInfo}>
                <Text style={styles.chatName}>{conv.user.name}</Text>
                <Text style={styles.chatPreview} numberOfLines={1}>
                  {conv.lastMessage.fileUrl ? '📎 Archivo adjunto' : conv.lastMessage.content}
                </Text>
              </View>
            </Pressable>
          ))
        ) : (
          <Text style={styles.cardText}>No tienes mensajes privados aún.</Text>
        )}
      </View>

      <Pressable style={styles.logoutButton} disabled={isLoggingOut} onPress={handleLogout}>
        <Text style={styles.logoutLabel}>{isLoggingOut ? 'Cerrando...' : 'Cerrar sesión'}</Text>
      </Pressable>
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    padding: 20,
    paddingTop: 36,
  },
  loaderContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#f8fafc',
  },
  loaderText: {
    fontSize: 14,
    color: '#475569',
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0f172a',
  },
  subtitle: {
    marginTop: 2,
    color: '#334155',
    fontSize: 14,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 16,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 8,
  },
  cardText: {
    fontSize: 14,
    color: '#475569',
    marginBottom: 4,
  },
  logoutButton: {
    marginTop: 10,
    backgroundColor: '#045389',
    borderRadius: 12,
    paddingVertical: 13,
  },
  logoutLabel: {
    color: '#ffffff',
    textAlign: 'center',
    fontWeight: '700',
    fontSize: 15,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  editButton: {
    backgroundColor: '#e2e8f0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  editButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  extraProfileInfo: {
    marginTop: 8,
  },
  divider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 12,
  },
  chatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  chatAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  chatAvatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#475569',
  },
  chatInfo: {
    flex: 1,
  },
  chatName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
  },
  chatPreview: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  subjectTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  badge: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  badgeText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '500',
  },
  actionButton: {
    marginTop: 6,
    backgroundColor: '#003e70',
    borderRadius: 12,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  actionButtonLabel: {
    color: '#ffffff',
    textAlign: 'center',
    fontWeight: '700',
    fontSize: 15,
  },
});
