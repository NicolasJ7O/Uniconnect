import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, TextInput, Modal, ActivityIndicator, Keyboard, TouchableWithoutFeedback, ScrollView } from 'react-native';
import { useLocalSearchParams, Stack, router, useFocusEffect } from 'expo-router';
import { forumApi, type ForumQuestion } from '@/lib/forum-api';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { loadSession, type SessionData } from '@/lib/session';
import { useToast } from '@/components/Toast';

export default function SubjectForumScreen() {
  const { subjectId, subjectName } = useLocalSearchParams<{ subjectId: string; subjectName: string }>();
  const [questions, setQuestions] = useState<ForumQuestion[]>([]);
  const [filteredQuestions, setFilteredQuestions] = useState<ForumQuestion[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<SessionData | null>(null);
  const { showToast } = useToast();

  const [isModalVisible, setModalVisible] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);

  useEffect(() => {
    loadSession().then(setSession);
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (subjectId) {
        loadQuestions();
      }
    }, [subjectId])
  );

  useEffect(() => {
    filterQuestions();
  }, [questions, searchQuery]);

  const loadQuestions = async () => {
    try {
      setLoading(true);
      const data = await forumApi.getSubjectQuestions(subjectId);
      setQuestions(data);
    } catch (error: any) {
      console.error(error);
      const msg = error.response?.data?.message || 'Error al cargar las preguntas del foro';
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const filterQuestions = () => {
    if (!searchQuery.trim()) {
      setFilteredQuestions(questions);
      return;
    }
    const query = searchQuery.toLowerCase();
    const filtered = questions.filter(
      (q) =>
        q.title.toLowerCase().includes(query) ||
        q.content.toLowerCase().includes(query)
    );
    setFilteredQuestions(filtered);
  };

  const handleCreateQuestion = async () => {
    if (!newTitle.trim() || !newContent.trim()) {
      showToast('Título y contenido son requeridos', 'error');
      return;
    }

    try {
      setIsPublishing(true);
      await forumApi.createQuestion(subjectId, newTitle, newContent);
      showToast('Pregunta publicada con éxito', 'success');
      setModalVisible(false);
      setNewTitle('');
      setNewContent('');
      loadQuestions();
    } catch (error: any) {
      console.error(error);
      const msg = error.response?.data?.message || 'Error al publicar la pregunta';
      showToast(msg, 'error');
    } finally {
      setIsPublishing(false);
    }
  };

  const renderQuestion = ({ item }: { item: ForumQuestion }) => {
    const repliesCount = item.answers ? item.answers.length : 0;
    
    return (
      <Pressable
        style={styles.card}
        onPress={() => router.push({ pathname: '/forum-question' as any, params: { questionId: item.id, subjectId } })}
      >
        <View style={styles.cardHeader}>
          <View style={styles.authorContainer}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{item.author.name?.charAt(0).toUpperCase() || 'E'}</Text>
            </View>
            <View>
              <Text style={styles.authorName}>{item.author.name}</Text>
              <Text style={styles.dateText}>{new Date(item.createdAt).toLocaleDateString()}</Text>
            </View>
          </View>
          <View style={styles.badge}>
            <Ionicons name="chatbubbles-outline" size={14} color="#64748b" />
            <Text style={styles.badgeText}>{repliesCount} {repliesCount === 1 ? 'respuesta' : 'respuestas'}</Text>
          </View>
        </View>

        <Text style={styles.questionTitle}>{item.title}</Text>
        <Text style={styles.questionContent} numberOfLines={2}>
          {item.content}
        </Text>

        <View style={styles.cardFooter}>
          <View style={styles.scoreContainer}>
            <Ionicons name="chevron-up-circle" size={18} color={item.score > 0 ? '#10b981' : item.score < 0 ? '#ef4444' : '#94a3b8'} />
            <Text style={[styles.scoreText, item.score > 0 && styles.scorePositive, item.score < 0 && styles.scoreNegative]}>
              Puntaje: {item.score}
            </Text>
          </View>
          <Text style={styles.viewThreadText}>Ver discusión →</Text>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: subjectName ? `Foro: ${subjectName}` : 'Foro de Preguntas',
          headerRight: () => (
            <Pressable
              onPress={() => router.push({ pathname: '/forum-history' as any, params: { subjectId, subjectName } })}
              style={styles.headerButton}
            >
              <Ionicons name="time-outline" size={20} color={Colors.light.tint} />
              <Text style={styles.headerButtonText}>Historial</Text>
            </Pressable>
          ),
        }}
      />

      <View style={styles.searchBarContainer}>
        <Ionicons name="search" size={20} color="#94a3b8" style={styles.searchIcon} />
        <TextInput
          style={styles.searchBar}
          placeholder="Buscar preguntas..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <Pressable onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={18} color="#94a3b8" style={{ marginRight: 8 }} />
          </Pressable>
        )}
      </View>

      {loading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={Colors.light.tint} />
          <Text style={styles.loaderText}>Cargando preguntas...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredQuestions}
          keyExtractor={(item) => item.id}
          renderItem={renderQuestion}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="library-outline" size={48} color="#94a3b8" />
              <Text style={styles.emptyText}>No hay preguntas registradas aún.</Text>
              <Text style={styles.emptySubtext}>¡Sé el primero en publicar una duda!</Text>
            </View>
          }
        />
      )}

      <Pressable style={styles.fab} onPress={() => setModalVisible(true)}>
        <Ionicons name="add" size={28} color="#fff" />
      </Pressable>

      <Modal visible={isModalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Crear Nueva Pregunta</Text>
                
                <TextInput
                  style={styles.input}
                  placeholder="Título (mínimo 5 caracteres)"
                  value={newTitle}
                  onChangeText={setNewTitle}
                  maxLength={100}
                />
                
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Explica tu duda de forma detallada (mínimo 10 caracteres)"
                  multiline
                  numberOfLines={6}
                  value={newContent}
                  onChangeText={setNewContent}
                  maxLength={2000}
                />

                <View style={styles.modalActions}>
                  <Pressable style={[styles.btn, styles.btnCancel]} onPress={() => setModalVisible(false)}>
                    <Text style={styles.btnCancelText}>Cancelar</Text>
                  </Pressable>
                  <Pressable style={[styles.btn, styles.btnSubmit]} onPress={handleCreateQuestion} disabled={isPublishing}>
                    <Text style={styles.btnSubmitText}>
                      {isPublishing ? 'Publicando...' : 'Publicar'}
                    </Text>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  headerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingRight: 8,
  },
  headerButtonText: {
    color: '#0a7ea4',
    fontSize: 14,
    fontWeight: '600',
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    margin: 16,
    paddingHorizontal: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  searchIcon: {
    marginLeft: 6,
    marginRight: 6,
  },
  searchBar: {
    flex: 1,
    height: 44,
    fontSize: 14,
    color: '#0f172a',
  },
  loaderContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loaderText: {
    color: '#64748b',
    fontSize: 14,
  },
  listContainer: {
    padding: 16,
    paddingTop: 0,
    paddingBottom: 88,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  authorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#0a7ea4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  authorName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
  },
  dateText: {
    fontSize: 11,
    color: '#94a3b8',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  badgeText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '500',
  },
  questionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 6,
  },
  questionContent: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
    marginBottom: 12,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 10,
  },
  scoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  scoreText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  scorePositive: {
    color: '#10b981',
  },
  scoreNegative: {
    color: '#ef4444',
  },
  viewThreadText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0a7ea4',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
    gap: 12,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748b',
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    backgroundColor: '#0a7ea4',
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 36,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 20,
  },
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: '#0f172a',
    marginBottom: 16,
  },
  textArea: {
    height: 120,
    textAlignVertical: 'top',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  btn: {
    flex: 1,
    height: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 'bold',
  },
  btnCancel: {
    backgroundColor: '#f1f5f9',
  },
  btnCancelText: {
    color: '#475569',
    fontWeight: '600',
  },
  btnSubmit: {
    backgroundColor: '#0a7ea4',
  },
  btnSubmitText: {
    color: '#fff',
    fontWeight: '700',
  },
});
