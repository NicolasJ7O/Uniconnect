import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, TextInput, ActivityIndicator, Keyboard, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useLocalSearchParams, Stack, router } from 'expo-router';
import { forumApi, type ForumQuestion, type ForumAnswer } from '@/lib/forum-api';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { loadSession, type SessionData } from '@/lib/session';
import { useToast } from '@/components/Toast';

export default function ForumQuestionScreen() {
  const { questionId, subjectId } = useLocalSearchParams<{ questionId: string; subjectId: string }>();
  const [thread, setThread] = useState<ForumQuestion | null>(null);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<SessionData | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    loadSession().then(setSession);
    if (questionId) {
      loadThread();
    }
  }, [questionId]);

  const loadThread = async () => {
    try {
      setLoading(true);
      const data = await forumApi.getQuestionThread(questionId);
      setThread(data);
    } catch (error: any) {
      console.error(error);
      const msg = error.response?.data?.message || 'Error al cargar el hilo de discusión';
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleVoteQuestion = async (value: number) => {
    if (!thread) return;
    try {
      const updated = await forumApi.voteQuestion(thread.id, value);
      // Keep other loaded relations intact
      setThread({
        ...thread,
        score: updated.score,
      });
      showToast('Voto registrado', 'success');
    } catch (error: any) {
      console.error(error);
      const msg = error.response?.data?.message || 'Error al registrar el voto';
      showToast(msg, 'error');
    }
  };

  const handleVoteAnswer = async (answerId: string, value: number) => {
    if (!thread) return;
    try {
      const updated = await forumApi.voteAnswer(answerId, value);
      setThread({
        ...thread,
        answers: thread.answers?.map((ans) =>
          ans.id === answerId ? { ...ans, score: updated.score } : ans
        ),
      });
      showToast('Voto registrado', 'success');
    } catch (error: any) {
      console.error(error);
      const msg = error.response?.data?.message || 'Error al registrar el voto';
      showToast(msg, 'error');
    }
  };

  const handleAcceptAnswer = async (answerId: string) => {
    if (!thread) return;
    try {
      const updated = await forumApi.acceptAnswer(answerId);
      
      // Refresh the entire thread to update isAccepted across all answers and re-sort them
      const data = await forumApi.getQuestionThread(questionId);
      setThread(data);

      const status = updated.isAccepted ? 'marcada como solución' : 'desmarcada como solución';
      showToast(`Respuesta ${status}`, 'success');
    } catch (error: any) {
      console.error(error);
      const msg = error.response?.data?.message || 'Error al cambiar el estado de la solución';
      showToast(msg, 'error');
    }
  };

  const handlePostReply = async () => {
    if (!replyContent.trim()) {
      showToast('Escribe una respuesta antes de enviar', 'error');
      return;
    }

    try {
      setIsSubmittingReply(true);
      await forumApi.createAnswer(questionId, replyContent);
      showToast('Respuesta publicada con éxito', 'success');
      setReplyContent('');
      Keyboard.dismiss();
      // Reload thread to show new reply sorted
      const data = await forumApi.getQuestionThread(questionId);
      setThread(data);
    } catch (error: any) {
      console.error(error);
      const msg = error.response?.data?.message || 'Error al publicar la respuesta';
      showToast(msg, 'error');
    } finally {
      setIsSubmittingReply(false);
    }
  };

  if (loading && !thread) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color={Colors.light.tint} />
        <Text style={styles.loaderText}>Cargando discusión...</Text>
      </View>
    );
  }

  if (!thread) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
        <Text style={styles.errorText}>No se pudo cargar la discusión.</Text>
        <Pressable style={styles.btnBack} onPress={() => router.back()}>
          <Text style={styles.btnBackText}>Volver</Text>
        </Pressable>
      </View>
    );
  }

  const isQuestionAuthor = session?.user?.id === thread.authorId;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.keyboardContainer}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <Stack.Screen options={{ title: 'Discusión' }} />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Pregunta Principal */}
        <View style={styles.questionCard}>
          <View style={styles.headerRow}>
            <View style={styles.authorRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{thread.author.name?.charAt(0).toUpperCase() || 'E'}</Text>
              </View>
              <View>
                <Text style={styles.authorName}>{thread.author.name}</Text>
                <Text style={styles.dateText}>{new Date(thread.createdAt).toLocaleString()}</Text>
              </View>
            </View>
            
            {/* Votación de la pregunta */}
            <View style={styles.voteWidget}>
              <Pressable onPress={() => handleVoteQuestion(1)} style={styles.voteBtn}>
                <Ionicons name="arrow-up-outline" size={20} color="#10b981" />
              </Pressable>
              <Text style={styles.voteScore}>{thread.score}</Text>
              <Pressable onPress={() => handleVoteQuestion(-1)} style={styles.voteBtn}>
                <Ionicons name="arrow-down-outline" size={20} color="#ef4444" />
              </Pressable>
            </View>
          </View>

          <Text style={styles.questionTitle}>{thread.title}</Text>
          <Text style={styles.questionContent}>{thread.content}</Text>
        </View>

        {/* Separador de Respuestas */}
        <View style={styles.repliesHeaderRow}>
          <Text style={styles.repliesTitle}>
            Respuestas ({thread.answers ? thread.answers.length : 0})
          </Text>
        </View>

        {/* Listado de Respuestas */}
        {thread.answers && thread.answers.length > 0 ? (
          thread.answers.map((ans) => {
            return (
              <View
                key={ans.id}
                style={[
                  styles.answerCard,
                  ans.isAccepted && styles.acceptedAnswerCard,
                ]}
              >
                {ans.isAccepted && (
                  <View style={styles.acceptedBanner}>
                    <Ionicons name="checkmark-circle" size={16} color="#15803d" />
                    <Text style={styles.acceptedBannerText}>Solución Aceptada</Text>
                  </View>
                )}

                <View style={styles.headerRow}>
                  <View style={styles.authorRow}>
                    <View style={[styles.avatar, styles.answerAvatar, ans.isAccepted && styles.acceptedAvatar]}>
                      <Text style={styles.avatarText}>{ans.author.name?.charAt(0).toUpperCase() || 'E'}</Text>
                    </View>
                    <View>
                      <Text style={styles.authorName}>{ans.author.name}</Text>
                      <Text style={styles.dateText}>{new Date(ans.createdAt).toLocaleString()}</Text>
                    </View>
                  </View>

                  {/* Votación de la respuesta */}
                  <View style={styles.voteWidget}>
                    <Pressable onPress={() => handleVoteAnswer(ans.id, 1)} style={styles.voteBtn}>
                      <Ionicons name="arrow-up-outline" size={18} color="#10b981" />
                    </Pressable>
                    <Text style={styles.voteScore}>{ans.score}</Text>
                    <Pressable onPress={() => handleVoteAnswer(ans.id, -1)} style={styles.voteBtn}>
                      <Ionicons name="arrow-down-outline" size={18} color="#ef4444" />
                    </Pressable>
                  </View>
                </View>

                <Text style={styles.answerContent}>{ans.content}</Text>

                {/* Acciones del autor de la pregunta */}
                {isQuestionAuthor && (
                  <View style={styles.answerActions}>
                    <Pressable
                      style={[
                        styles.actionButton,
                        ans.isAccepted ? styles.actionBtnUnaccept : styles.actionBtnAccept,
                      ]}
                      onPress={() => handleAcceptAnswer(ans.id)}
                    >
                      <Ionicons
                        name={ans.isAccepted ? 'close-circle-outline' : 'checkmark-circle-outline'}
                        size={16}
                        color={ans.isAccepted ? '#ef4444' : '#10b981'}
                      />
                      <Text
                        style={[
                          styles.actionButtonText,
                          ans.isAccepted ? styles.actionTextUnaccept : styles.actionTextAccept,
                        ]}
                      >
                        {ans.isAccepted ? 'Desmarcar como Solución' : 'Aceptar como Solución'}
                      </Text>
                    </Pressable>
                  </View>
                )}
              </View>
            );
          })
        ) : (
          <View style={styles.emptyAnswers}>
            <Ionicons name="chatbox-outline" size={32} color="#94a3b8" />
            <Text style={styles.emptyAnswersText}>Aún no hay respuestas en este hilo.</Text>
            <Text style={styles.emptyAnswersSubtext}>¡Ayuda a tu compañero escribiendo la primera solución!</Text>
          </View>
        )}
      </ScrollView>

      {/* Input de Respuesta al final */}
      <View style={styles.replyBoxContainer}>
        <TextInput
          style={styles.replyInput}
          placeholder="Escribe tu respuesta..."
          value={replyContent}
          onChangeText={setReplyContent}
          multiline
          maxLength={2000}
        />
        <Pressable
          style={[styles.sendBtn, !replyContent.trim() && styles.sendBtnDisabled]}
          onPress={handlePostReply}
          disabled={isSubmittingReply || !replyContent.trim()}
        >
          {isSubmittingReply ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="send" size={18} color="#fff" />
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardContainer: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 24,
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
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 16,
  },
  errorText: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
  },
  btnBack: {
    backgroundColor: '#0a7ea4',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  btnBackText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  questionCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0a7ea4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  authorName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e293b',
  },
  dateText: {
    fontSize: 11,
    color: '#94a3b8',
  },
  voteWidget: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 20,
    paddingHorizontal: 6,
    paddingVertical: 4,
    gap: 6,
  },
  voteBtn: {
    padding: 2,
  },
  voteScore: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    minWidth: 16,
    textAlign: 'center',
  },
  questionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 8,
  },
  questionContent: {
    fontSize: 15,
    color: '#334155',
    lineHeight: 22,
  },
  repliesHeaderRow: {
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingBottom: 8,
    marginBottom: 12,
  },
  repliesTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1e293b',
  },
  answerCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 2,
    elevation: 1,
  },
  acceptedAnswerCard: {
    borderColor: '#bbf7d0',
    backgroundColor: '#f0fdf4',
    borderWidth: 2,
  },
  acceptedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#dcfce7',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 10,
  },
  acceptedBannerText: {
    fontSize: 11,
    color: '#15803d',
    fontWeight: '700',
  },
  answerAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#64748b',
  },
  acceptedAvatar: {
    backgroundColor: '#16a34a',
  },
  answerContent: {
    fontSize: 14,
    color: '#334155',
    lineHeight: 21,
    marginTop: 4,
  },
  answerActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    marginTop: 12,
    paddingTop: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  actionBtnAccept: {
    borderColor: '#bbf7d0',
    backgroundColor: '#f0fdf4',
  },
  actionBtnUnaccept: {
    borderColor: '#fca5a5',
    backgroundColor: '#fef2f2',
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '700',
  },
  actionTextAccept: {
    color: '#16a34a',
  },
  actionTextUnaccept: {
    color: '#dc2626',
  },
  emptyAnswers: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
    gap: 8,
  },
  emptyAnswersText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  emptyAnswersSubtext: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
  },
  replyBoxContainer: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    alignItems: 'center',
    gap: 10,
  },
  replyInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 80,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 14,
    color: '#0f172a',
  },
  sendBtn: {
    backgroundColor: '#0a7ea4',
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: '#94a3b8',
  },
});
