import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { authConfig } from '@/constants/AuthConfig';
import { useToast } from '@/components/Toast';
import {
  libraryApi,
  type AcademicResource,
  type ResourceType,
  type ListResourcesParams,
} from '@/lib/library-api';

// ─── Constants ────────────────────────────────────────────────────────────────

const RESOURCE_TYPES: { label: string; value: ResourceType | 'ALL' }[] = [
  { label: 'Todos', value: 'ALL' },
  { label: 'Enlace', value: 'LINK' },
  { label: 'PDF', value: 'PDF' },
  { label: 'Imagen', value: 'IMAGE' },
  { label: 'Video', value: 'VIDEO' },
  { label: 'Documento', value: 'DOCUMENTO' },
  { label: 'Otro', value: 'OTRO' },
];

const SORT_OPTIONS: { label: string; value: 'recent' | 'popular' }[] = [
  { label: 'Más recientes', value: 'recent' },
  { label: 'Más populares', value: 'popular' },
];

const TYPE_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  LINK: 'link-outline',
  PDF: 'document-text-outline',
  IMAGE: 'image-outline',
  VIDEO: 'videocam-outline',
  DOCUMENTO: 'document-outline',
  OTRO: 'attach-outline',
};

function toAbsoluteUploadUrl(url?: string | null) {
  if (!url) return undefined;
  if (/^https?:\/\//i.test(url)) return url;
  return `${authConfig.backendUrl.replace(/\/$/, '')}${url}`;
}

// ─── Resource Card ────────────────────────────────────────────────────────────

function ResourceCard({
  item,
  onPress,
}: {
  item: AcademicResource;
  onPress: () => void;
}) {
  const ogImage = item.openGraph?.ogImage || (item.type === 'IMAGE' ? toAbsoluteUploadUrl(item.url) : undefined);
  const ogTitle = item.openGraph?.ogTitle;
  const votes = item.stats?.votes ?? 0;
  const categories = item.categories ?? [];

  return (
    <Pressable style={({ pressed }) => [styles.card, pressed && styles.cardPressed]} onPress={onPress}>
      {ogImage ? (
        <Image source={{ uri: ogImage }} style={styles.ogImage} resizeMode="cover" />
      ) : null}

      <View style={styles.cardBody}>
        {/* Type badge + votes */}
        <View style={styles.cardMeta}>
          <View style={styles.typeBadge}>
            <Ionicons name={TYPE_ICONS[item.type] ?? 'attach-outline'} size={12} color="#0a7ea4" />
            <Text style={styles.typeBadgeText}>{item.type}</Text>
          </View>
          <View style={styles.votesRow}>
            <Ionicons
              name="arrow-up-circle-outline"
              size={15}
              color={votes > 0 ? '#10b981' : '#94a3b8'}
            />
            <Text style={[styles.votesText, votes > 0 && styles.votesPositive]}>{votes}</Text>
          </View>
        </View>

        <Text style={styles.cardTitle} numberOfLines={2}>
          {ogTitle || item.title}
        </Text>

        <Text style={styles.subjectText} numberOfLines={1}>
          {item.subject?.name ?? 'Asignatura'}
        </Text>

        {item.description ? (
          <Text style={styles.cardDesc} numberOfLines={2}>
            {item.description}
          </Text>
        ) : null}

        {/* Tags */}
        {item.tags && item.tags.length > 0 && (
          <View style={styles.tagsRow}>
            {item.tags.slice(0, 4).map((tag) => (
              <View key={tag} style={styles.tag}>
                <Text style={styles.tagText}>#{tag}</Text>
              </View>
            ))}
          </View>
        )}

        {categories.length > 0 && (
          <View style={styles.tagsRow}>
            {categories.slice(0, 3).map((category) => (
              <View key={category} style={styles.categoryTag}>
                <Text style={styles.categoryTagText}>{category}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Author + date */}
        <View style={styles.cardFooter}>
          <Text style={styles.authorText}>{item.author.name ?? 'Estudiante'}</Text>
          <Text style={styles.dateText}>{new Date(item.publishedAt).toLocaleDateString()}</Text>
        </View>
      </View>
    </Pressable>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function SubjectLibraryScreen() {
  const { subjectId, subjectName } = useLocalSearchParams<{
    subjectId: string;
    subjectName: string;
  }>();
  const { showToast } = useToast();

  const [resources, setResources] = useState<AcademicResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const [search, setSearch] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [activeType, setActiveType] = useState<ResourceType | 'ALL'>('ALL');
  const [sortBy, setSortBy] = useState<'recent' | 'popular'>('recent');

  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tagTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasMountedTagFilter = useRef(false);
  const currentSearch = useRef('');

  // ── Create modal state ──
  const [isModalVisible, setModalVisible] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    url: '',
    type: 'LINK' as ResourceType,
    tags: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fileToUpload, setFileToUpload] = useState<any>(null);

  const handlePickAttachment = async () => {
    if (form.type === 'IMAGE' || form.type === 'VIDEO') {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes:
          form.type === 'IMAGE'
            ? ImagePicker.MediaTypeOptions.Images
            : ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: false,
        quality: 0.9,
      });

      if (!result.canceled && result.assets.length > 0) {
        setFileToUpload(result.assets[0]);
      }
      return;
    }

    const result = await DocumentPicker.getDocumentAsync({
      type: '*/*',
      copyToCacheDirectory: true,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setFileToUpload(result.assets[0]);
    }
  };

  const buildParams = useCallback(
    (p: number, s: string): ListResourcesParams => ({
      page: p,
      limit: 20,
      sortBy,
      ...(activeType !== 'ALL' && { type: activeType }),
      ...(s.trim() && { search: s.trim() }),
      ...(tagFilter.trim() && { tag: tagFilter.trim() }),
    }),
    [sortBy, activeType, tagFilter],
  );

  const loadResources = useCallback(
    async (reset = false) => {
      if (!subjectId) return;
      const p = reset ? 1 : page;
      if (reset) {
        setLoading(true);
        setPage(1);
      } else {
        setLoadingMore(true);
      }

      try {
        const result = await libraryApi.listResources(subjectId, buildParams(p, currentSearch.current));
        const newItems = result.data;
        setResources((prev) => (reset ? newItems : [...prev, ...newItems]));
        setHasMore(result.pagination.page < result.pagination.totalPages);
        if (!reset) setPage(p + 1);
      } catch (err: any) {
        const msg = err.response?.data?.message || 'Error al cargar la biblioteca';
        showToast(msg, 'error');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [subjectId, page, buildParams, showToast],
  );

  useFocusEffect(
    useCallback(() => {
      loadResources(true);
    }, [loadResources]),
  );

  useEffect(() => {
    if (!hasMountedTagFilter.current) {
      hasMountedTagFilter.current = true;
      return;
    }

    if (tagTimeout.current) clearTimeout(tagTimeout.current);
    tagTimeout.current = setTimeout(() => {
      loadResources(true);
    }, 350);

    return () => {
      if (tagTimeout.current) clearTimeout(tagTimeout.current);
    };
  }, [tagFilter, loadResources]);

  const handleSearchChange = (text: string) => {
    setSearch(text);
    currentSearch.current = text;
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      loadResources(true);
    }, 350);
  };

  const handleCreateResource = async () => {
    if (!form.title.trim()) {
      showToast('El título es requerido', 'error');
      return;
    }

    if ((form.type === 'IMAGE' || form.type === 'VIDEO' || form.type === 'PDF' || form.type === 'DOCUMENTO') && !fileToUpload) {
      showToast('Debes adjuntar un archivo para este tipo de recurso', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const tags = form.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      const uploadPayload = fileToUpload
        ? {
            uri: fileToUpload.uri,
            type: fileToUpload.mimeType || fileToUpload.type || 'application/octet-stream',
            name: fileToUpload.name || fileToUpload.fileName || `file_${Date.now()}`,
            file: fileToUpload.file,
          }
        : undefined;

      await libraryApi.createResource(subjectId, {
        title: form.title,
        description: form.description || undefined,
        url: form.url || undefined,
        type: form.type,
        tags,
      }, uploadPayload);

      showToast('Recurso publicado con éxito', 'success');
      setModalVisible(false);
      setForm({ title: '', description: '', url: '', type: 'LINK', tags: '' });
      setFileToUpload(null);
      loadResources(true);
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Error al publicar el recurso';
      showToast(msg, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: subjectName ? `Biblioteca: ${subjectName}` : 'Biblioteca' }} />

      {/* Search bar */}
      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={18} color="#94a3b8" />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar recursos..."
          value={search}
          onChangeText={handleSearchChange}
          returnKeyType="search"
        />
        {search.length > 0 && (
          <Pressable onPress={() => handleSearchChange('')}>
            <Ionicons name="close-circle" size={16} color="#94a3b8" />
          </Pressable>
        )}
      </View>

      <View style={styles.filterBlock}>
        <TextInput
          style={styles.inlineFilter}
          placeholder="Filtrar por etiqueta..."
          value={tagFilter}
          onChangeText={setTagFilter}
          autoCapitalize="none"
        />
        {tagFilter.length > 0 && (
          <Pressable
            style={styles.clearFilter}
            onPress={() => {
              setTagFilter('');
              loadResources(true);
            }}
          >
            <Text style={styles.clearFilterText}>Limpiar</Text>
          </Pressable>
        )}
      </View>

      {/* Filters */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersRow}>
        {RESOURCE_TYPES.map((t) => (
          <Pressable
            key={t.value}
            style={[styles.chip, activeType === t.value && styles.chipActive]}
            onPress={() => { setActiveType(t.value); loadResources(true); }}
          >
            <Text style={[styles.chipText, activeType === t.value && styles.chipTextActive]}>
              {t.label}
            </Text>
          </Pressable>
        ))}
        <View style={styles.chipDivider} />
        {SORT_OPTIONS.map((s) => (
          <Pressable
            key={s.value}
            style={[styles.chip, sortBy === s.value && styles.chipActive]}
            onPress={() => { setSortBy(s.value); loadResources(true); }}
          >
            <Text style={[styles.chipText, sortBy === s.value && styles.chipTextActive]}>
              {s.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* List */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.light.tint} />
          <Text style={styles.loadingText}>Cargando biblioteca...</Text>
        </View>
      ) : (
        <FlatList
          data={resources}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ResourceCard
              item={item}
              onPress={() =>
                router.push({ pathname: '/library-resource' as any, params: { resourceId: item.id, subjectId } })
              }
            />
          )}
          contentContainerStyle={styles.list}
          onEndReached={() => hasMore && !loadingMore && loadResources(false)}
          onEndReachedThreshold={0.4}
          ListFooterComponent={loadingMore ? <ActivityIndicator color={Colors.light.tint} style={{ marginVertical: 12 }} /> : null}
          ListEmptyComponent={
            <View style={styles.centered}>
              <Ionicons name="library-outline" size={52} color="#94a3b8" />
              <Text style={styles.emptyText}>No hay recursos en esta asignatura.</Text>
              <Text style={styles.emptySubtext}>¡Sé el primero en compartir material!</Text>
            </View>
          }
        />
      )}

      {/* FAB */}
      <Pressable style={styles.fab} onPress={() => setModalVisible(true)}>
        <Ionicons name="add" size={28} color="#fff" />
      </Pressable>

      {/* Create Modal */}
      <Modal visible={isModalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.overlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modal}>
                <Text style={styles.modalTitle}>Compartir Recurso</Text>

                <Text style={styles.label}>Título *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ej. Apuntes de álgebra lineal"
                  value={form.title}
                  onChangeText={(v) => setForm((f) => ({ ...f, title: v }))}
                  maxLength={120}
                />

                <Text style={styles.label}>Descripción</Text>
                <TextInput
                  style={[styles.input, styles.textarea]}
                  placeholder="Breve descripción del recurso..."
                  multiline
                  numberOfLines={3}
                  value={form.description}
                  onChangeText={(v) => setForm((f) => ({ ...f, description: v }))}
                  maxLength={500}
                />

                <Text style={styles.label}>URL / Enlace</Text>
                  <TextInput
                  style={styles.input}
                  placeholder="https://..."
                  autoCapitalize="none"
                  keyboardType="url"
                  value={form.url}
                  onChangeText={(v) => setForm((f) => ({ ...f, url: v }))}
                />

                {(form.type === 'PDF' || form.type === 'DOCUMENTO' || form.type === 'VIDEO' || form.type === 'IMAGE') && (
                  <View style={{ marginBottom: 14 }}>
                     <Pressable style={[styles.btn, styles.btnCancel]} onPress={handlePickAttachment}>
                        <Text style={styles.btnCancelText}>
                          {fileToUpload
                            ? 'Cambiar archivo'
                            : form.type === 'IMAGE'
                              ? 'Adjuntar imagen'
                              : form.type === 'VIDEO'
                                ? 'Adjuntar video'
                                : 'Adjuntar documento/PDF'}
                        </Text>
                     </Pressable>
                     {fileToUpload && (
                        <Text style={{fontSize: 12, color: '#64748b', marginTop: 4}}>Adjunto: {fileToUpload.name}</Text>
                     )}
                  </View>
                )}

                <Text style={styles.label}>Tipo</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                  {(['LINK', 'PDF', 'IMAGE', 'VIDEO', 'DOCUMENTO', 'OTRO'] as ResourceType[]).map((t) => (
                    <Pressable
                      key={t}
                      style={[styles.chip, form.type === t && styles.chipActive, { marginRight: 6 }]}
                      onPress={() => {
                        setForm((f) => ({ ...f, type: t }));
                        setFileToUpload(null);
                      }}
                    >
                      <Text style={[styles.chipText, form.type === t && styles.chipTextActive]}>{t}</Text>
                    </Pressable>
                  ))}
                </ScrollView>

                <Text style={styles.label}>Etiquetas (separadas por coma)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="ej. cálculo, parcial, resumen"
                  value={form.tags}
                  onChangeText={(v) => setForm((f) => ({ ...f, tags: v }))}
                />

                <View style={styles.modalActions}>
                  <Pressable style={[styles.btn, styles.btnCancel]} onPress={() => setModalVisible(false)}>
                    <Text style={styles.btnCancelText}>Cancelar</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.btn, styles.btnSubmit]}
                    onPress={handleCreateResource}
                    disabled={isSubmitting}
                  >
                    <Text style={styles.btnSubmitText}>{isSubmitting ? 'Publicando...' : 'Publicar'}</Text>
                  </Pressable>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    margin: 14,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  searchInput: { flex: 1, height: 42, fontSize: 14, color: '#0f172a' },
  filterBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 14,
    marginBottom: 6,
  },
  inlineFilter: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#0f172a',
  },
  clearFilter: {
    backgroundColor: '#e2e8f0',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
  },
  clearFilterText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  filtersRow: { paddingHorizontal: 14, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', zIndex: 20, elevation: 6, borderBottomWidth: 1, borderBottomColor: '#e8eef2' },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginRight: 8,
  },
  chipActive: { backgroundColor: '#0a7ea4', borderColor: '#0a7ea4' },
  chipText: { fontSize: 12, fontWeight: '600', color: '#64748b' },
  chipTextActive: { color: '#fff' },
  chipDivider: { width: 1, backgroundColor: '#e2e8f0', marginHorizontal: 6, height: 28 },
  list: { padding: 14, paddingTop: 12, paddingBottom: 96 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 64, gap: 10 },
  loadingText: { color: '#64748b', fontSize: 14 },
  emptyText: { fontSize: 15, fontWeight: '600', color: '#64748b', textAlign: 'center' },
  emptySubtext: { fontSize: 13, color: '#94a3b8', textAlign: 'center' },
  // Card
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  cardPressed: { opacity: 0.92 },
  ogImage: { width: '100%', height: 160, maxHeight: 200, backgroundColor: '#f8fafc' },
  cardBody: { padding: 14 },
  cardMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f0f9ff',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  typeBadgeText: { fontSize: 11, color: '#0369a1', fontWeight: '700' },
  votesRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  votesText: { fontSize: 12, fontWeight: '700', color: '#94a3b8' },
  votesPositive: { color: '#10b981' },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#0f172a', marginBottom: 4 },
  subjectText: { fontSize: 11, fontWeight: '700', color: '#0369a1', marginBottom: 6 },
  cardDesc: { fontSize: 13, color: '#475569', lineHeight: 18, marginBottom: 8 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 },
  tag: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, marginRight: 8, marginBottom: 6 },
  tagText: { fontSize: 12, color: '#475569' },
  categoryTag: {
    backgroundColor: '#ecfeff',
    borderWidth: 1,
    borderColor: '#a5f3fc',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  categoryTagText: { fontSize: 11, color: '#0e7490', fontWeight: '600' },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 8, marginTop: 4 },
  authorText: { fontSize: 11, color: '#64748b', fontWeight: '600' },
  dateText: { fontSize: 11, color: '#94a3b8' },
  // FAB
  fab: {
    position: 'absolute', right: 20, bottom: 24,
    backgroundColor: '#0a7ea4', width: 56, height: 56,
    borderRadius: 28, alignItems: 'center', justifyContent: 'center',
    elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2, shadowRadius: 4,
  },
  // Modal
  overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' },
  modal: { backgroundColor: '#fff', borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 24, paddingBottom: 40 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#0f172a', marginBottom: 18 },
  label: { fontSize: 13, fontWeight: '600', color: '#334155', marginBottom: 4 },
  input: {
    backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0',
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, color: '#0f172a', marginBottom: 14,
  },
  textarea: { height: 80, textAlignVertical: 'top' },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  btn: { flex: 1, height: 48, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  btnCancel: { backgroundColor: '#f1f5f9' },
  btnCancelText: { color: '#475569', fontWeight: '600' },
  btnSubmit: { backgroundColor: '#0a7ea4' },
  btnSubmitText: { color: '#fff', fontWeight: '700' },
});
