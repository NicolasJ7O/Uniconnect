import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { authConfig } from '@/constants/AuthConfig';
import { useToast } from '@/components/Toast';
import { libraryApi, type AcademicResource } from '@/lib/library-api';
import { loadSession } from '@/lib/session';

const TYPE_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  LINK: 'link-outline',
  PDF: 'document-text-outline',
  VIDEO: 'videocam-outline',
  DOCUMENTO: 'document-outline',
  OTRO: 'attach-outline',
};

const EDITABLE_TYPES: AcademicResource['type'][] = ['LINK', 'PDF', 'IMAGE', 'VIDEO', 'DOCUMENTO', 'OTRO'];

type EditFormState = {
  title: string;
  description: string;
  url: string;
  type: AcademicResource['type'];
  tags: string;
};

function toAbsoluteUploadUrl(url?: string | null) {
  if (!url) return undefined;
  if (/^https?:\/\//i.test(url)) return url;
  return `${authConfig.backendUrl.replace(/\/$/, '')}${url}`;
}

export default function LibraryResourceScreen() {
  const { resourceId } = useLocalSearchParams<{
    resourceId: string;
  }>();
  const { showToast } = useToast();

  const [resource, setResource] = useState<AcademicResource | null>(null);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [isVoting, setIsVoting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<EditFormState>({
    title: '',
    description: '',
    url: '',
    type: 'LINK',
    tags: '',
  });

  const isOwner = userId === resource?.authorId;

  const editableTags = useMemo(() => resource?.tags ?? [], [resource]);

  const loadResource = useCallback(async () => {
    try {
      setLoading(true);
      const data = await libraryApi.getResource(resourceId);
      setResource(data);
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Error al cargar el recurso';
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  }, [resourceId, showToast]);

  const openEditModal = () => {
    if (!resource) return;

    setEditForm({
      title: resource.title,
      description: resource.description ?? '',
      url: resource.url ?? '',
      type: resource.type,
      tags: editableTags.join(', '),
    });
    setIsEditing(true);
  };

  const handleSaveResource = async () => {
    if (!resource) return;

    if (!editForm.title.trim()) {
      showToast('El título es requerido', 'error');
      return;
    }

    if (!editForm.type) {
      showToast('El tipo de recurso es requerido', 'error');
      return;
    }

    try {
      const parsedTags = editForm.tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean);

      const updated = await libraryApi.updateResource(resource.id, {
        title: editForm.title.trim(),
        description: editForm.description.trim() || undefined,
        url: editForm.url.trim() || undefined,
        type: editForm.type,
        tags: parsedTags,
      });

      setResource(updated);
      setIsEditing(false);
      showToast('Recurso actualizado', 'success');
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Error al actualizar el recurso';
      showToast(msg, 'error');
    }
  };

  useEffect(() => {
    loadSession().then((s) => setUserId(s?.user?.id ?? null));
    if (resourceId) loadResource();
  }, [resourceId, loadResource]);

  const handleVote = async (value: 1 | -1) => {
    if (!resource) return;
    setIsVoting(true);
    try {
      const updated = await libraryApi.voteResource(resource.id, value);
      setResource((prev) => prev ? { ...prev, stats: updated.stats } : prev);
      showToast('Voto registrado', 'success');
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Error al votar';
      showToast(msg, 'error');
    } finally {
      setIsVoting(false);
    }
  };

  const handleDelete = () => {
    if (!resource) return;
    Alert.alert(
      'Eliminar recurso',
      '¿Estás seguro de que quieres eliminar este recurso?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            setIsDeleting(true);
            try {
              await libraryApi.deleteResource(resource.id);
              showToast('Recurso eliminado', 'success');
              router.back();
            } catch (err: any) {
              const msg = err.response?.data?.message || 'Error al eliminar el recurso';
              showToast(msg, 'error');
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ],
    );
  };

  const handleOpenLink = () => {
    const targetUrl = toAbsoluteUploadUrl(resource?.url);
    if (targetUrl) Linking.openURL(targetUrl).catch(() => showToast('No se pudo abrir el enlace', 'error'));
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.light.tint} />
        <Text style={styles.loadingText}>Cargando recurso...</Text>
      </View>
    );
  }

  if (!resource) {
    return (
      <View style={styles.centered}>
        <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
        <Text style={styles.errorText}>No se pudo cargar el recurso.</Text>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Volver</Text>
        </Pressable>
      </View>
    );
  }

  const og = resource.openGraph;
  const stats = resource.stats;
  const tags = resource.tags ?? [];
  const categories = resource.categories ?? [];
  const previewImage = og?.ogImage || (resource.type === 'IMAGE' ? toAbsoluteUploadUrl(resource.url) : null);
  const votes = stats?.votes ?? 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: 'Recurso Académico' }} />

      {/* OG Image */}
      {previewImage ? (
        <Image source={{ uri: previewImage }} style={styles.heroImage} resizeMode="cover" />
      ) : null}

      {/* Type badge */}
      <View style={styles.typeBadgeRow}>
        <View style={styles.typeBadge}>
          <Ionicons name={TYPE_ICONS[resource.type] ?? 'attach-outline'} size={13} color="#0369a1" />
          <Text style={styles.typeBadgeText}>{resource.type}</Text>
        </View>
        {isOwner && (
          <View style={styles.ownerActions}>
            <Pressable style={styles.editBtn} onPress={openEditModal}>
              <Ionicons name="create-outline" size={18} color="#0369a1" />
              <Text style={styles.editBtnText}>Editar</Text>
            </Pressable>
            <Pressable style={styles.deleteBtn} onPress={handleDelete} disabled={isDeleting}>
              <Ionicons name="trash-outline" size={18} color="#ef4444" />
              <Text style={styles.deleteBtnText}>{isDeleting ? 'Eliminando...' : 'Eliminar'}</Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* Title */}
      <Text style={styles.title}>{og?.ogTitle || resource.title}</Text>

      <Text style={styles.subjectName}>{resource.subject?.name ?? 'Asignatura'}</Text>

      {/* OG description or resource description */}
      {(og?.ogDescription || resource.description) ? (
        <Text style={styles.description}>{og?.ogDescription || resource.description}</Text>
      ) : null}

      {/* OG site name */}
      {og?.ogSiteName ? (
        <Text style={styles.siteName}>🔗 {og.ogSiteName}</Text>
      ) : null}

      {/* Open link button */}
      {resource.url ? (
        <Pressable style={styles.linkBtn} onPress={handleOpenLink}>
          <Ionicons name="open-outline" size={16} color="#fff" />
          <Text style={styles.linkBtnText}>Abrir enlace</Text>
        </Pressable>
      ) : null}

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Ionicons name="eye-outline" size={18} color="#64748b" />
          <Text style={styles.statValue}>{stats?.views ?? 0}</Text>
          <Text style={styles.statLabel}>vistas</Text>
        </View>
        <View style={styles.statItem}>
          <Ionicons name="download-outline" size={18} color="#64748b" />
          <Text style={styles.statValue}>{stats?.downloads ?? 0}</Text>
          <Text style={styles.statLabel}>descargas</Text>
        </View>
        <View style={styles.statItem}>
          <Ionicons name="thumbs-up-outline" size={18} color="#64748b" />
          <Text style={styles.statValue}>{votes}</Text>
          <Text style={styles.statLabel}>votos</Text>
        </View>
      </View>

      {/* Vote actions */}
      <View style={styles.voteRow}>
        <Pressable
          style={[styles.voteBtn, styles.voteUp]}
          onPress={() => handleVote(1)}
          disabled={isVoting}
        >
          <Ionicons name="arrow-up-outline" size={18} color="#10b981" />
          <Text style={styles.voteUpText}>Útil</Text>
        </Pressable>
        <Pressable
          style={[styles.voteBtn, styles.voteDown]}
          onPress={() => handleVote(-1)}
          disabled={isVoting}
        >
          <Ionicons name="arrow-down-outline" size={18} color="#ef4444" />
          <Text style={styles.voteDownText}>No útil</Text>
        </Pressable>
      </View>

      {/* Tags */}
      {tags.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Etiquetas</Text>
          <View style={styles.tagsRow}>
            {tags.map((tag) => (
              <View key={tag} style={styles.tag}>
                <Text style={styles.tagText}>#{tag}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {categories.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Categorias</Text>
          <View style={styles.tagsRow}>
            {categories.map((category) => (
              <View key={category} style={styles.categoryTag}>
                <Text style={styles.categoryTagText}>{category}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Author */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Publicado por</Text>
        <View style={styles.authorRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{resource.author.name?.charAt(0).toUpperCase() ?? 'E'}</Text>
          </View>
          <View>
            <Text style={styles.authorName}>{resource.author.name ?? 'Estudiante'}</Text>
            <Text style={styles.authorDate}>{new Date(resource.publishedAt).toLocaleString()}</Text>
          </View>
        </View>
      </View>

      <Modal visible={isEditing} transparent animationType="slide" onRequestClose={() => setIsEditing(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Editar recurso</Text>

            <Text style={styles.label}>Título *</Text>
            <TextInput
              style={styles.input}
              value={editForm.title}
              onChangeText={(value) => setEditForm((current) => ({ ...current, title: value }))}
              maxLength={120}
            />

            <Text style={styles.label}>Descripción</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={editForm.description}
              onChangeText={(value) => setEditForm((current) => ({ ...current, description: value }))}
              multiline
              numberOfLines={4}
              maxLength={500}
            />

            <Text style={styles.label}>URL</Text>
            <TextInput
              style={styles.input}
              value={editForm.url}
              onChangeText={(value) => setEditForm((current) => ({ ...current, url: value }))}
              autoCapitalize="none"
              keyboardType="url"
            />

            <Text style={styles.label}>Tipo</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typeRow}>
              {EDITABLE_TYPES.map((type) => (
                <Pressable
                  key={type}
                  style={[styles.typeChip, editForm.type === type && styles.typeChipActive]}
                  onPress={() => setEditForm((current) => ({ ...current, type }))}
                >
                  <Text style={[styles.typeChipText, editForm.type === type && styles.typeChipTextActive]}>
                    {type}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            <Text style={styles.label}>Etiquetas</Text>
            <TextInput
              style={styles.input}
              value={editForm.tags}
              onChangeText={(value) => setEditForm((current) => ({ ...current, tags: value }))}
              placeholder="cálculo, resumen, examen"
            />

            <View style={styles.modalActions}>
              <Pressable style={[styles.modalButton, styles.cancelButton]} onPress={() => setIsEditing(false)}>
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </Pressable>
              <Pressable style={[styles.modalButton, styles.submitButton]} onPress={handleSaveResource}>
                <Text style={styles.submitButtonText}>Guardar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { paddingBottom: 48 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  loadingText: { color: '#64748b', fontSize: 14 },
  errorText: { fontSize: 16, color: '#64748b', textAlign: 'center' },
  backBtn: { backgroundColor: '#0a7ea4', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  backBtnText: { color: '#fff', fontWeight: '700' },
  heroImage: { width: '100%', height: 200 },
  typeBadgeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingBottom: 0 },
  typeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#f0f9ff', paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 8, borderWidth: 1, borderColor: '#bae6fd',
  },
  typeBadgeText: { fontSize: 12, color: '#0369a1', fontWeight: '700' },
  ownerActions: { flexDirection: 'row', gap: 10 },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: '#bae6fd',
    backgroundColor: '#f0f9ff',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  editBtnText: { fontSize: 13, color: '#0369a1', fontWeight: '600' },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  deleteBtnText: { fontSize: 13, color: '#ef4444', fontWeight: '600' },
  title: { fontSize: 22, fontWeight: '800', color: '#0f172a', padding: 16, paddingBottom: 6 },
  subjectName: { fontSize: 12, color: '#0369a1', paddingHorizontal: 16, marginBottom: 8, fontWeight: '700' },
  description: { fontSize: 15, color: '#334155', lineHeight: 22, paddingHorizontal: 16, marginBottom: 6 },
  siteName: { fontSize: 12, color: '#0369a1', paddingHorizontal: 16, marginBottom: 12, fontWeight: '600' },
  linkBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: '#0a7ea4', marginHorizontal: 16, borderRadius: 12,
    paddingVertical: 13, marginBottom: 20,
  },
  linkBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  statsRow: {
    flexDirection: 'row', justifyContent: 'space-around', backgroundColor: '#fff',
    marginHorizontal: 16, borderRadius: 14, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: '#e2e8f0',
  },
  statItem: { alignItems: 'center', gap: 2 },
  statValue: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
  statLabel: { fontSize: 11, color: '#94a3b8' },
  voteRow: { flexDirection: 'row', gap: 10, marginHorizontal: 16, marginBottom: 20 },
  voteBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, padding: 12, borderRadius: 10, borderWidth: 1,
  },
  voteUp: { borderColor: '#bbf7d0', backgroundColor: '#f0fdf4' },
  voteUpText: { color: '#16a34a', fontWeight: '700' },
  voteDown: { borderColor: '#fecaca', backgroundColor: '#fef2f2' },
  voteDownText: { color: '#dc2626', fontWeight: '700' },
  section: { paddingHorizontal: 16, marginBottom: 20 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#64748b', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { backgroundColor: '#f1f5f9', borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0', paddingHorizontal: 10, paddingVertical: 4 },
  tagText: { fontSize: 13, color: '#475569', fontWeight: '500' },
  categoryTag: { backgroundColor: '#ecfeff', borderRadius: 8, borderWidth: 1, borderColor: '#a5f3fc', paddingHorizontal: 10, paddingVertical: 4 },
  categoryTagText: { fontSize: 13, color: '#0e7490', fontWeight: '600' },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#0a7ea4', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  authorName: { fontSize: 15, fontWeight: '700', color: '#1e293b' },
  authorDate: { fontSize: 12, color: '#94a3b8' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 22,
    paddingBottom: 36,
    maxHeight: '88%',
  },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#0f172a', marginBottom: 18 },
  label: { fontSize: 13, fontWeight: '600', color: '#334155', marginBottom: 4, marginTop: 12 },
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0f172a',
  },
  textArea: {
    minHeight: 88,
    textAlignVertical: 'top',
  },
  typeRow: {
    marginBottom: 2,
  },
  typeChip: {
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
  },
  typeChipActive: {
    backgroundColor: '#e0f2fe',
    borderColor: '#7dd3fc',
  },
  typeChipText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '700',
  },
  typeChipTextActive: {
    color: '#0369a1',
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
