import React, { useEffect, useState } from 'react';
import { Modal, View, Text, StyleSheet, ActivityIndicator, Image, ScrollView, Pressable } from 'react-native';
import { getEnrichedStudentProfile } from '@/lib/student-api';
import { getStudentStudyGroups } from '@/lib/study-group-api';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';

export default function StudentProfileModal({ visible, onClose, userId }: { visible: boolean; onClose: () => void; userId: string | null }) {
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<any | null>(null);

  useEffect(() => {
    if (!visible || !userId) return;
    let mounted = true;
    setLoading(true);
    setProfile(null);
    getEnrichedStudentProfile(userId)
      .then((data) => { if (mounted) setProfile(data); })
      .catch((e) => { console.error('Error loading profile', e); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [visible, userId]);

  useEffect(() => {
    // If profile doesn't include groups, fetch them separately
    if (!profile || !profile.id) return;
    if (Array.isArray(profile.groups) && profile.groups.length > 0) return;

    let mounted = true;
    getStudentStudyGroups(profile.id)
      .then((groups) => {
        if (!mounted) return;
        setProfile((prev: any) => ({ ...prev, groups }));
      })
      .catch((e) => console.error('Error loading student groups', e));
    return () => { mounted = false; };
  }, [profile]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>Perfil de estudiante</Text>
            <Pressable onPress={onClose} style={styles.closeBtn}><Ionicons name="close" size={20} color="#fff" /></Pressable>
          </View>

          {loading ? (
            <View style={styles.center}><ActivityIndicator size="large" color={Colors.light.tint} /></View>
          ) : profile ? (
            <ScrollView contentContainerStyle={styles.content}>
              <View style={styles.topRow}>
                {profile.avatarUrl ? (
                  <Image source={{ uri: profile.avatarUrl }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarPlaceholder}><Ionicons name="person" size={36} color="#fff" /></View>
                )}
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.name}>{profile.name || profile.email}</Text>
                  <Text style={styles.sub}>{profile.email}</Text>
                  {profile.role && <Text style={styles.role}>{profile.role}</Text>}
                  {profile.career && <Text style={styles.sub}>{profile.career} · Semestre {profile.currentSemester ?? '-'}</Text>}
                </View>
              </View>

              {/* Badges / Achievements */}
              {/* Subjects */}
              {Array.isArray(profile.subjects) && profile.subjects.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Materias</Text>
                  <View style={styles.badgeRow}>
                    {profile.subjects.map((s: any) => (
                      <View key={s.id || s.name} style={styles.badgeCard}>
                        <Text style={styles.badgeLabel}>{s.name}</Text>
                        {s.code && <Text style={styles.badgeCount}>{s.code}</Text>}
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {Array.isArray(profile.badges) && profile.badges.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Insignias y logros</Text>
                  <View style={styles.badgeRow}>
                    {profile.badges.map((b: any) => (
                      <View key={b.id || b.label} style={styles.badgeCard}>
                        <View style={styles.badgeIcon}><Ionicons name={b.icon || 'sparkles'} size={20} color={Colors.light.tint} /></View>
                        <Text style={styles.badgeLabel}>{b.label}</Text>
                        {b.count != null && <Text style={styles.badgeCount}>{b.count}</Text>}
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Activity stats */}
              {profile.activityStats && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Estadísticas de actividad</Text>
                  <View style={styles.statsRow}>
                    <View style={styles.statCard}>
                      <Text style={styles.statNumber}>{profile.activityStats.posts ?? 0}</Text>
                      <Text style={styles.statLabel}>Publicaciones</Text>
                    </View>
                    <View style={styles.statCard}>
                      <Text style={styles.statNumber}>{profile.activityStats.comments ?? 0}</Text>
                      <Text style={styles.statLabel}>Comentarios</Text>
                    </View>
                    <View style={styles.statCard}>
                      <Text style={styles.statNumber}>{profile.activityStats.eventsAttended ?? 0}</Text>
                      <Text style={styles.statLabel}>Eventos</Text>
                    </View>
                    <View style={styles.statCard}>
                      <Text style={styles.statNumber}>{profile.activityStats.pollsCreated ?? 0}</Text>
                      <Text style={styles.statLabel}>Encuestas</Text>
                    </View>
                  </View>
                </View>
              )}

              {/* Recent achievements or notes */}
              {/* Groups */}
              {Array.isArray(profile.groups) && profile.groups.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Grupos</Text>
                  {profile.groups.map((g: any) => (
                    <View key={g.id} style={styles.achievementRow}>
                      <Text style={styles.achievementTitle}>{g.name}</Text>
                      {g.description && <Text style={styles.achievementDesc}>{g.description}</Text>}
                      <Text style={styles.achievementDate}>Miembros: {g.members?.length ?? '-'}</Text>
                    </View>
                  ))}
                </View>
              )}

              {Array.isArray(profile.achievements) && profile.achievements.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Logros recientes</Text>
                  {profile.achievements.map((a: any) => (
                    <View key={a.id || a.title} style={styles.achievementRow}>
                      <Text style={styles.achievementTitle}>{a.title}</Text>
                      {a.date && <Text style={styles.achievementDate}>{new Date(a.date).toLocaleDateString()}</Text>}
                      {a.description && <Text style={styles.achievementDesc}>{a.description}</Text>}
                    </View>
                  ))}
                </View>
              )}

              <View style={{ height: 24 }} />
            </ScrollView>
          ) : (
            <View style={styles.center}><Text>No se encontró el perfil.</Text></View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(2,6,23,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '85%', padding: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 16, fontWeight: '800', color: '#0f172a' },
  closeBtn: { backgroundColor: '#0a7ea4', padding: 8, borderRadius: 8 },
  content: { paddingVertical: 12 },
  center: { padding: 24, alignItems: 'center', justifyContent: 'center' },
  topRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#f1f5f9' },
  avatarPlaceholder: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#0a7ea4', alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
  sub: { fontSize: 12, color: '#64748b', marginTop: 2 },
  role: { fontSize: 12, color: '#0a7ea4', fontWeight: '700', marginTop: 4 },
  section: { marginTop: 16 },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: '#0f172a', marginBottom: 8 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  badgeCard: { backgroundColor: '#f1f5f9', padding: 10, borderRadius: 12, marginRight: 8, width: 120, alignItems: 'center' },
  badgeIcon: { backgroundColor: '#fff', padding: 6, borderRadius: 10, marginBottom: 6 },
  badgeLabel: { fontSize: 12, fontWeight: '700', color: '#0f172a', textAlign: 'center' },
  badgeCount: { fontSize: 11, color: '#64748b', marginTop: 6 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  statCard: { flex: 1, backgroundColor: '#f8fafc', padding: 12, borderRadius: 12, alignItems: 'center' },
  statNumber: { fontSize: 18, fontWeight: '900', color: '#0f172a' },
  statLabel: { fontSize: 12, color: '#64748b', marginTop: 4 },
  achievementRow: { backgroundColor: '#fff', padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#eef2f7', marginBottom: 8 },
  achievementTitle: { fontSize: 13, fontWeight: '800', color: '#0f172a' },
  achievementDate: { fontSize: 12, color: '#94a3b8', marginTop: 4 },
  achievementDesc: { fontSize: 12, color: '#475569', marginTop: 6 },
});
