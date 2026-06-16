import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { assistantApi, type AssistantMessage, type AssistantSendResponse } from '@/lib/assistant-api';
import { assistantFeedbackApi } from '@/lib/assistant-feedback-api';
import type { SessionData } from '@/lib/session';

type AssistantWidgetProps = {
  session: SessionData;
  roleLabel: string;
};

type LocalMessage = AssistantMessage & {
  localOnly?: boolean;
};

const DEFAULT_EMPTY_NOTICE = 'Escribe una pregunta sobre UniConnect para empezar.';

export default function AssistantWidget({ session, roleLabel }: AssistantWidgetProps) {
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isSlow, setIsSlow] = useState(false);
  const [slowNotice, setSlowNotice] = useState(false);
  const [feedbackDrafts, setFeedbackDrafts] = useState<Record<string, string>>({});
  const [feedbackState, setFeedbackState] = useState<Record<string, 'USEFUL' | 'NOT_USEFUL' | 'SENT'>>({});
  const [feedbackBusy, setFeedbackBusy] = useState<Record<string, boolean>>({});
  const flatListRef = useRef<FlatList<LocalMessage>>(null);
  const pendingTimersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);

  const sessionKey = session.refreshToken.split('.')[0];

  const clearPendingTimers = () => {
    pendingTimersRef.current.forEach((timer) => clearTimeout(timer));
    pendingTimersRef.current = [];
  };

  const resetLatencyState = () => {
    clearPendingTimers();
    setIsSending(false);
    setIsSlow(false);
    setSlowNotice(false);
  };

  const scheduleLatencyWarnings = () => {
    clearPendingTimers();

    pendingTimersRef.current.push(
      setTimeout(() => {
        setIsSlow(true);
      }, 10_000),
      setTimeout(() => {
        setSlowNotice(true);
      }, 15_000)
    );
  };

  const hydrateHistory = async () => {
    try {
      setIsLoadingHistory(true);
      const history = await assistantApi.getSessionHistory(sessionKey);
      setMessages(history.messages);
    } catch (error) {
      console.error('Error loading assistant history', error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    void hydrateHistory();

    return () => {
      clearPendingTimers();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionKey]);

  useEffect(() => {
    if (!flatListRef.current || messages.length === 0) {
      return;
    }

    flatListRef.current.scrollToEnd({ animated: true });
  }, [messages]);

  const applySendResult = (result: AssistantSendResponse, tempId: string) => {
    setMessages((prev) => {
      const withoutTemp = prev.filter((message) => message.id !== tempId);
      return [...withoutTemp, result.userMessage, result.assistantMessage];
    });
  };

  const handleSend = async () => {
    const trimmed = inputText.trim();
    if (!trimmed || isSending) {
      return;
    }

    const tempId = `local-${Date.now()}`;
    const optimisticMessage: LocalMessage = {
      id: tempId,
      sessionId: sessionKey,
      speakerRole: 'user',
      content: trimmed,
      metadata: { pending: true },
      createdAt: new Date().toISOString(),
      localOnly: true,
    };

    setMessages((prev) => [...prev, optimisticMessage]);
    setInputText('');
    setIsSending(true);
    scheduleLatencyWarnings();

    try {
      const result = await assistantApi.sendMessage(sessionKey, trimmed);
      applySendResult(result, tempId);
    } catch (error) {
      console.error('Error sending assistant message', error);
      setMessages((prev) =>
        prev.map((message) =>
          message.id === tempId
            ? {
                ...message,
                speakerRole: 'system',
                content: 'No pude consultar el asistente en este momento. Intenta nuevamente.',
                metadata: { answerType: 'REFUSAL' },
              }
            : message
        )
      );
    } finally {
      resetLatencyState();
    }
  };

  const handleFeedback = async (message: LocalMessage, rating: 'USEFUL' | 'NOT_USEFUL') => {
    const question = typeof message.metadata?.question === 'string' ? message.metadata.question : '';
    const contextChunks = Array.isArray(message.metadata?.contextChunks) ? message.metadata.contextChunks : [];

    if (!question || !message.id) {
      return;
    }

    setFeedbackBusy((prev) => ({ ...prev, [message.id]: true }));

    try {
      await assistantFeedbackApi.submit({
        assistantMessageId: message.id,
        sessionId: sessionKey,
        question,
        answer: message.content,
        rating,
        comment: feedbackDrafts[message.id]?.trim() || undefined,
        chunks: contextChunks,
      });

      setFeedbackState((prev) => ({ ...prev, [message.id]: 'SENT' }));
    } catch (error) {
      console.error('Error submitting assistant feedback', error);
    } finally {
      setFeedbackBusy((prev) => ({ ...prev, [message.id]: false }));
    }
  };

  const renderItem = ({ item }: { item: LocalMessage }) => {
    const isUser = item.speakerRole === 'user';
    const isSystem = item.speakerRole === 'system';
    const answerType = typeof item.metadata?.answerType === 'string' ? item.metadata.answerType : undefined;
    const references = Array.isArray(item.metadata?.references) ? item.metadata?.references : [];
    const bubbleStyle = isSystem
      ? styles.systemBubble
      : isUser
        ? styles.userBubble
        : answerType === 'ADMIN'
          ? styles.adminBubble
          : answerType === 'REFUSAL'
            ? styles.refusalBubble
            : styles.assistantBubble;

    return (
      <View style={[styles.messageRow, isUser ? styles.messageRowRight : styles.messageRowLeft]}>
        <View style={[styles.messageBubble, bubbleStyle]}>
          {!isUser && !isSystem && (
            <View style={styles.messageMetaRow}>
              <Text style={styles.messageRoleLabel}>{answerType === 'ADMIN' ? 'Respuesta administrativa' : 'Respuesta contextual'}</Text>
            </View>
          )}
          <Text style={[styles.messageText, isUser && styles.userMessageText, isSystem && styles.systemMessageText]}>{item.content}</Text>
          {references.length > 0 && (
            <View style={styles.referencesContainer}>
              {references.map((reference: { reference: string }) => (
                <View key={reference.reference} style={styles.referenceChip}>
                  <Text style={styles.referenceChipText} numberOfLines={2}>{reference.reference}</Text>
                </View>
              ))}
            </View>
          )}

          {item.speakerRole === 'assistant' && (
            <View style={styles.feedbackSection}>
              <Text style={styles.feedbackHint}>¿Fue útil esta respuesta?</Text>
              <View style={styles.feedbackRow}>
                <Pressable
                  style={[styles.feedbackButton, styles.feedbackUseful, feedbackBusy[item.id] && styles.feedbackButtonDisabled]}
                  onPress={() => void handleFeedback(item, 'USEFUL')}
                  disabled={feedbackBusy[item.id]}
                >
                  <Text style={styles.feedbackButtonText}>Útil</Text>
                </Pressable>
                <Pressable
                  style={[styles.feedbackButton, styles.feedbackNotUseful, feedbackBusy[item.id] && styles.feedbackButtonDisabled]}
                  onPress={() => void handleFeedback(item, 'NOT_USEFUL')}
                  disabled={feedbackBusy[item.id]}
                >
                  <Text style={styles.feedbackButtonText}>No útil</Text>
                </Pressable>
              </View>
              <TextInput
                value={feedbackDrafts[item.id] ?? ''}
                onChangeText={(text) => setFeedbackDrafts((prev) => ({ ...prev, [item.id]: text }))}
                placeholder="Comentario opcional"
                placeholderTextColor="#94a3b8"
                style={styles.feedbackInput}
                multiline
              />
              {feedbackState[item.id] === 'SENT' && <Text style={styles.feedbackSaved}>Feedback enviado y registrado.</Text>}
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.card}>
      <Pressable style={styles.header} onPress={() => setIsCollapsed((current) => !current)}>
        <View style={styles.headerLeft}>
          <View style={styles.iconWrap}>
            <Ionicons name="sparkles" size={18} color="#003e70" />
          </View>
          <View>
            <Text style={styles.title}>Asistente UniConnect</Text>
            <Text style={styles.subtitle}>{roleLabel} · contexto de sesión actual</Text>
          </View>
        </View>
        <Ionicons name={isCollapsed ? 'chevron-down' : 'chevron-up'} size={18} color="#0f172a" />
      </Pressable>

      {!isCollapsed && (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.body}>
            {isLoadingHistory ? (
              <View style={styles.loaderBlock}>
                <ActivityIndicator color="#0a7ea4" />
                <Text style={styles.loaderText}>Recuperando historial de la sesión...</Text>
              </View>
            ) : messages.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="chatbubble-ellipses-outline" size={26} color="#64748b" />
                <Text style={styles.emptyStateText}>{DEFAULT_EMPTY_NOTICE}</Text>
              </View>
            ) : (
              <FlatList
                ref={flatListRef}
                data={messages}
                keyExtractor={(item) => item.id}
                renderItem={renderItem}
                contentContainerStyle={styles.listContent}
                keyboardShouldPersistTaps="handled"
              />
            )}

            {isSending && (
              <View style={styles.typingRow}>
                <ActivityIndicator size="small" color="#0a7ea4" />
                <Text style={styles.typingText}>{isSlow ? 'Procesando contexto extendido...' : 'Analizando contexto...'}</Text>
              </View>
            )}

            {slowNotice && (
              <View style={styles.slowNotice}>
                <Ionicons name="time-outline" size={16} color="#854d0e" />
                <Text style={styles.slowNoticeText}>El servicio está tardando más de lo esperado. Seguimos consultando UniConnect.</Text>
              </View>
            )}

            <View style={styles.composer}>
              <TextInput
                value={inputText}
                onChangeText={setInputText}
                placeholder="Pregunta sobre UniConnect..."
                placeholderTextColor="#94a3b8"
                style={styles.input}
                multiline
                editable={!isSending}
              />
              <Pressable onPress={handleSend} style={({ pressed }) => [styles.sendButton, pressed && styles.sendButtonPressed, isSending && styles.sendButtonDisabled]} disabled={isSending}>
                <Ionicons name="send" size={18} color="#fff" />
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#cfe7f4',
    marginBottom: 16,
    overflow: 'hidden',
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#eff8fc',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#d9f1fb',
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  subtitle: {
    marginTop: 2,
    fontSize: 12,
    color: '#475569',
  },
  body: {
    padding: 12,
    gap: 10,
  },
  loaderBlock: {
    paddingVertical: 24,
    alignItems: 'center',
    gap: 10,
  },
  loaderText: {
    color: '#475569',
    fontSize: 13,
  },
  emptyState: {
    minHeight: 120,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 18,
  },
  emptyStateText: {
    color: '#64748b',
    fontSize: 13,
    textAlign: 'center',
  },
  listContent: {
    paddingVertical: 4,
    gap: 10,
  },
  messageRow: {
    flexDirection: 'row',
  },
  messageRowLeft: {
    justifyContent: 'flex-start',
  },
  messageRowRight: {
    justifyContent: 'flex-end',
  },
  messageBubble: {
    maxWidth: '92%',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
  },
  userBubble: {
    backgroundColor: '#0a7ea4',
    borderColor: '#0a7ea4',
  },
  assistantBubble: {
    backgroundColor: '#f8fafc',
    borderColor: '#cbd5e1',
  },
  adminBubble: {
    backgroundColor: '#eff6ff',
    borderColor: '#93c5fd',
  },
  refusalBubble: {
    backgroundColor: '#fff7ed',
    borderColor: '#fdba74',
  },
  systemBubble: {
    backgroundColor: '#f1f5f9',
    borderColor: '#cbd5e1',
  },
  messageMetaRow: {
    marginBottom: 4,
  },
  messageRoleLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0f172a',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  messageText: {
    color: '#0f172a',
    fontSize: 14,
    lineHeight: 20,
  },
  userMessageText: {
    color: '#ffffff',
  },
  systemMessageText: {
    color: '#334155',
  },
  referencesContainer: {
    marginTop: 8,
    gap: 6,
  },
  referenceChip: {
    alignSelf: 'flex-start',
    backgroundColor: '#e2e8f0',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  referenceChipText: {
    fontSize: 11,
    color: '#334155',
  },
  typingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
  },
  typingText: {
    fontSize: 12,
    color: '#475569',
  },
  feedbackSection: {
    marginTop: 10,
    gap: 8,
  },
  feedbackHint: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '700',
  },
  feedbackRow: {
    flexDirection: 'row',
    gap: 8,
  },
  feedbackButton: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  feedbackUseful: {
    backgroundColor: '#dcfce7',
  },
  feedbackNotUseful: {
    backgroundColor: '#fee2e2',
  },
  feedbackButtonText: {
    fontSize: 12,
    color: '#0f172a',
    fontWeight: '700',
  },
  feedbackButtonDisabled: {
    opacity: 0.6,
  },
  feedbackInput: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
    color: '#0f172a',
    backgroundColor: '#fff',
  },
  feedbackSaved: {
    fontSize: 11,
    color: '#15803d',
  },
  slowNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    backgroundColor: '#fffbeb',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fcd34d',
  },
  slowNoticeText: {
    flex: 1,
    fontSize: 12,
    color: '#854d0e',
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    marginTop: 2,
  },
  input: {
    flex: 1,
    minHeight: 48,
    maxHeight: 108,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#0f172a',
    backgroundColor: '#ffffff',
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#0a7ea4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonPressed: {
    opacity: 0.86,
  },
  sendButtonDisabled: {
    opacity: 0.6,
  },
});
