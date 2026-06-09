import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, Stack, router } from 'expo-router';
import { forumApi, type ForumHistory, type ForumQuestion, type ForumAnswer, type ForumAuditLog } from '@/lib/forum-api';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useToast } from '@/components/Toast';

type ActiveTab = 'questions' | 'answers' | 'logs';

export default function ForumHistoryScreen() {
  const { subjectId, subjectName } = useLocalSearchParams<{ subjectId: string; subjectName: string }>();
  const [history, setHistory] = useState<ForumHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ActiveTab>('questions');
  const { showToast } = useToast();

  useEffect(() => {
    if (subjectId) {
      loadHistory();
    }
  }, [subjectId]);

  const loadHistory = async () => {
    try {
      setLoading(true);
      const data = await forumApi.getForumHistory(subjectId);
      setHistory(data);
    } catch (error: any) {
      console.error(error);
      const msg = error.response?.data?.message || 'Error al cargar el historial de participación';
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const formatLogAction = (action: string, metadata?: any): string => {
    switch (action) {
      case 'CREATE_QUESTION':
        return 'Publicaste una nueva pregunta';
      case 'CREATE_ANSWER':
        return 'Publicaste una respuesta';
      case 'VOTE_QUESTION':
        return `Votaste ${metadata?.value === 1 ? 'positivo' : 'negativo'} en una pregunta`;
      case 'VOTE_ANSWER':
        return `Votaste ${metadata?.value === 1 ? 'positivo' : 'negativo'} en una respuesta`;
      case 'ACCEPT_ANSWER':
        return metadata?.accepted
          ? 'Marcaste una respuesta como solución aceptada'
          : 'Desmarcaste una respuesta como solución';
      default:
        return action;
    }
  };

  const getLogIcon = (action: string) => {
    switch (action) {
      case 'CREATE_QUESTION':
        return { name: 'help-circle', color: '#0a7ea4' };
      case 'CREATE_ANSWER':
        return { name: 'chatbubble-ellipses', color: '#8b5cf6' };
      case 'VOTE_QUESTION':
      case 'VOTE_ANSWER':
        return { name: 'thumbs-up', color: '#f59e0b' };
      case 'ACCEPT_ANSWER':
        return { name: 'checkmark-circle', color: '#10b981' };
      default:
        return { name: 'information-circle', color: '#64748b' };
    }
  };

  if (loading && !history) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color={Colors.light.tint} />
        <Text style={styles.loaderText}>Cargando historial...</Text>
      </View>
    );
  }

  const questions = history?.questions || [];
  const answers = history?.answers || [];
  const logs = history?.logs || [];

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: subjectName ? `Historial: ${subjectName}` : 'Mi Historial' }} />

      {/* Tabs de Selección */}
      <View style={styles.tabsContainer}>
        <Pressable
          style={[styles.tab, activeTab === 'questions' && styles.activeTab]}
          onPress={() => setActiveTab('questions')}
        >
          <Text style={[styles.tabText, activeTab === 'questions' && styles.activeTabText]}>
            Preguntas ({questions.length})
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === 'answers' && styles.activeTab]}
          onPress={() => setActiveTab('answers')}
        >
          <Text style={[styles.tabText, activeTab === 'answers' && styles.activeTabText]}>
            Respuestas ({answers.length})
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === 'logs' && styles.activeTab]}
          onPress={() => setActiveTab('logs')}
        >
          <Text style={[styles.tabText, activeTab === 'logs' && styles.activeTabText]}>
            Actividad ({logs.length})
          </Text>
        </Pressable>
      </View>

      {/* Listados */}
      {activeTab === 'questions' && (
        <FlatList
          data={questions}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <Pressable
              style={styles.historyCard}
              onPress={() => router.push({ pathname: '/forum-question' as any, params: { questionId: item.id, subjectId } })}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.cardDate}>{new Date(item.createdAt).toLocaleDateString()}</Text>
                <View style={styles.scoreBadge}>
                  <Text style={styles.scoreText}>Puntos: {item.score}</Text>
                </View>
              </View>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardPreview} numberOfLines={2}>
                {item.content}
              </Text>
            </Pressable>
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="help-circle-outline" size={48} color="#94a3b8" />
              <Text style={styles.emptyText}>No has publicado ninguna pregunta en esta asignatura.</Text>
            </View>
          }
        />
      )}

      {activeTab === 'answers' && (
        <FlatList
          data={answers}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <Pressable
              style={[styles.historyCard, item.isAccepted && styles.acceptedCard]}
              onPress={() => router.push({ pathname: '/forum-question' as any, params: { questionId: item.questionId, subjectId } })}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.cardDate}>{new Date(item.createdAt).toLocaleDateString()}</Text>
                <View style={styles.scoreBadge}>
                  <Text style={styles.scoreText}>Puntos: {item.score}</Text>
                </View>
              </View>
              <Text style={styles.questionContextText}>Pregunta: {item.question.title}</Text>
              <Text style={styles.cardPreview} numberOfLines={2}>
                {item.content}
              </Text>
              {item.isAccepted && (
                <View style={styles.solutionTag}>
                  <Ionicons name="checkmark-circle" size={14} color="#15803d" />
                  <Text style={styles.solutionTagText}>Solución Aceptada</Text>
                </View>
              )}
            </Pressable>
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="chatbubble-outline" size={48} color="#94a3b8" />
              <Text style={styles.emptyText}>No has respondido a ninguna pregunta en esta asignatura.</Text>
            </View>
          }
        />
      )}

      {activeTab === 'logs' && (
        <FlatList
          data={logs}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const icon = getLogIcon(item.action);
            return (
              <View style={styles.logRow}>
                <View style={[styles.logIconWrapper, { backgroundColor: icon.color + '15' }]}>
                  <Ionicons name={icon.name as any} size={20} color={icon.color} />
                </View>
                <View style={styles.logInfo}>
                  <Text style={styles.logActionText}>{formatLogAction(item.action, item.metadata)}</Text>
                  <Text style={styles.logDateText}>{new Date(item.createdAt).toLocaleString()}</Text>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="receipt-outline" size={48} color="#94a3b8" />
              <Text style={styles.emptyText}>No hay registros de auditoría disponibles.</Text>
            </View>
          }
        />
      )}
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
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loaderText: {
    color: '#64748b',
    fontSize: 14,
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#0a7ea4',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  activeTabText: {
    color: '#0a7ea4',
    fontWeight: '700',
  },
  listContent: {
    padding: 16,
  },
  historyCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 12,
  },
  acceptedCard: {
    borderColor: '#bbf7d0',
    backgroundColor: '#f0fdf4',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardDate: {
    fontSize: 11,
    color: '#94a3b8',
  },
  scoreBadge: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  scoreText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '600',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 6,
  },
  questionContextText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 6,
  },
  cardPreview: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
  },
  solutionTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 10,
    backgroundColor: '#dcfce7',
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  solutionTagText: {
    fontSize: 10,
    color: '#15803d',
    fontWeight: '700',
  },
  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 10,
    gap: 12,
  },
  logIconWrapper: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logInfo: {
    flex: 1,
  },
  logActionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1e293b',
  },
  logDateText: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
  },
});
