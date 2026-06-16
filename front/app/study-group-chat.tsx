import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, Pressable, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, Stack, router } from 'expo-router';
import { chatApi, type ChatMessage } from '@/lib/chat-api';
import { getStudyGroupById, type StudyGroup, type StudyGroupMember } from '@/lib/study-group-api';
import { loadSession, type SessionData } from '@/lib/session';
import { useNotifications } from '@/context/NotificationContext';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import * as DocumentPicker from 'expo-document-picker';
import { decorateMessage } from '@/lib/message-decorator';
import type { ChatPoll } from '@/lib/chat-api';

export default function StudyGroupChat() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [session, setSession] = useState<SessionData | null>(null);
  const [group, setGroup] = useState<StudyGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchingMore, setFetchingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [file, setFile] = useState<any>(null);
  const [members, setMembers] = useState<StudyGroupMember[]>([]);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const [showPollComposer, setShowPollComposer] = useState(false);
  const [pollMessage, setPollMessage] = useState('');
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptionText, setPollOptionText] = useState('');
  const [pollOptions, setPollOptions] = useState<string[]>([]);
  const [pollAllowMultiple, setPollAllowMultiple] = useState(false);
  const [pollMaxSelections, setPollMaxSelections] = useState('2');
  const [pollDurationMinutes, setPollDurationMinutes] = useState('');
  const [pollClosingAt, setPollClosingAt] = useState('');
  const [isSending, setIsSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const { socket } = useNotifications();

  const fetchHistory = useCallback(async (pageNumber: number) => {
    try {
      if (pageNumber === 1) setLoading(true);
      else setFetchingMore(true);

      const data = await chatApi.getGroupHistory(id as string, pageNumber, 20);
      setMessages(prev => pageNumber === 1 ? data.messages : [...data.messages, ...prev]);
      setHasMore(data.page < data.totalPages);
      setPage(pageNumber);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setFetchingMore(false);
    }
  }, [id]);

  const applyPollUpdate = useCallback((updatedPoll: ChatPoll) => {
    setMessages((prev) =>
      prev.map((message) =>
        message.poll?.id === updatedPoll.id
          ? {
              ...message,
              poll: updatedPoll,
            }
          : message
      )
    );
  }, []);

  const fetchGroupDetails = useCallback(async () => {
    try {
      const data = await getStudyGroupById(id as string);
      setGroup(data);
      if (data.members) setMembers(data.members);
    } catch (e) {
      console.error(e);
    }
  }, [id]);

  useEffect(() => {
    loadSession().then(setSession);
    fetchGroupDetails();
    fetchHistory(1);
  }, [id, fetchHistory, fetchGroupDetails]);

  const loadMore = () => {
    if (!hasMore || fetchingMore || loading) return;
    fetchHistory(page + 1);
  };

  useEffect(() => {
    if (!socket) return;

    socket.emit('join-group', id);

    const onMessage = (msg: ChatMessage) => {
      if (msg.groupId === id) {
        setMessages((prev) => {
          if (prev.find(m => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
      }
    };

    socket.on('group-message', onMessage);
    const onPollUpdated = (poll: ChatPoll) => {
      applyPollUpdate(poll);
    };
    const onPollClosed = (poll: ChatPoll) => {
      applyPollUpdate(poll);
    };

    socket.on('poll-updated', onPollUpdated);
    socket.on('poll-closed', onPollClosed);

    return () => {
      socket.emit('leave-group', id);
      socket.off('group-message', onMessage);
      socket.off('poll-updated', onPollUpdated);
      socket.off('poll-closed', onPollClosed);
    };
  }, [socket, id, applyPollUpdate]);

  const handleSend = async () => {
    if (!inputText.trim() && !file) return;
    if (isSending) return;

    try {
      setIsSending(true);
      let fileToUpload: any = null;
      if (file) {
        if (Platform.OS === 'web' && file.file) {
          fileToUpload = file.file;
        } else {
          fileToUpload = {
            uri: file.uri,
            type: file.mimeType || 'application/octet-stream',
            name: file.name || `file_${Date.now()}`
          };
        }
      }

      await chatApi.sendGroupMessage(id as string, inputText.trim(), fileToUpload);
      setInputText('');
      setFile(null);
    } catch (e: any) {
      console.error(e);
      const errorMsg = e?.response?.data?.message || 'Error al enviar el mensaje por moderación';
      alert(errorMsg);
    } finally {
      setIsSending(false);
    }
  };

  const resetPollComposer = () => {
    setPollMessage('');
    setPollQuestion('');
    setPollOptionText('');
    setPollOptions([]);
    setPollAllowMultiple(false);
    setPollMaxSelections('2');
    setPollDurationMinutes('');
    setPollClosingAt('');
    setShowPollComposer(false);
  };

  const addPollOption = () => {
    const normalized = pollOptionText.trim();
    if (!normalized) return;
    if (pollOptions.length >= 10) return;
    if (pollOptions.some((option) => option.toLowerCase() === normalized.toLowerCase())) return;
    setPollOptions((prev) => [...prev, normalized]);
    setPollOptionText('');
  };

  const removePollOption = (index: number) => {
    setPollOptions((prev) => prev.filter((_, currentIndex) => currentIndex !== index));
  };

  const handleCreatePoll = async () => {
    if (!pollQuestion.trim() || pollOptions.length < 2) return;
    if (isSending) return;

    try {
      setIsSending(true);
      let fileToUpload: any = null;
      if (file) {
        if (Platform.OS === 'web' && file.file) {
          fileToUpload = file.file;
        } else {
          fileToUpload = {
            uri: file.uri,
            type: file.mimeType || 'application/octet-stream',
            name: file.name || `file_${Date.now()}`
          };
        }
      }

      const duration = pollDurationMinutes.trim() ? Number(pollDurationMinutes) : undefined;
      const closingAt = pollClosingAt.trim()
        ? new Date(pollClosingAt.trim()).toISOString()
        : undefined;

      if (pollClosingAt.trim() && Number.isNaN(new Date(pollClosingAt.trim()).getTime())) {
        throw new Error('La fecha de cierre de la encuesta no es válida');
      }

      await chatApi.sendGroupMessage(
        id as string,
        pollMessage.trim(),
        fileToUpload,
        {
          question: pollQuestion.trim(),
          options: pollOptions,
          allowMultiple: pollAllowMultiple,
          maxSelections: pollAllowMultiple ? Number(pollMaxSelections) || 2 : 1,
          durationMinutes: Number.isFinite(duration as number) ? (duration as number) : undefined,
          closingAt,
        }
      );

      setInputText('');
      setFile(null);
      resetPollComposer();
    } catch (e: any) {
      console.error(e);
      const errorMsg = e?.response?.data?.message || 'Error al crear la encuesta por moderación';
      alert(errorMsg);
    } finally {
      setIsSending(false);
    }
  };

  const pickDocument = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
    if (!result.canceled && result.assets) {
      setFile(result.assets[0]);
    }
  };

  const handleTextChange = (text: string) => {
    setInputText(text);
    const match = text.match(/@(\w*)$/);
    if (match) {
      setShowMentions(true);
      setMentionFilter(match[1]);
    } else {
      setShowMentions(false);
    }
  };

  const insertMention = (name: string) => {
    const firstName = name.split(' ')[0];
    const newText = inputText.replace(/@\w*$/, `@${firstName} `);
    setInputText(newText);
    setShowMentions(false);
  };

  const handleVotePoll = async (pollId: string, optionId: string) => {
    try {
      const updated = await chatApi.voteOnPoll(id as string, pollId, [optionId]);
      applyPollUpdate(updated);
    } catch (e) {
      console.error(e);
    }
  };

  const renderItem = ({ item }: { item: ChatMessage }) => {
    const isMe = item.senderId === session?.user.id;
    const firstName = session?.user.name?.split(' ')[0];
    const isMentioned = !!firstName && item.content.includes(`@${firstName}`);

    return (
      <View style={[styles.messageWrapper, isMe ? styles.messageWrapperMe : styles.messageWrapperOther]}>
        {!isMe && <Text style={styles.senderName}>{item.sender.name || 'Usuario'}</Text>}
        <View style={[styles.messageBubble, isMe ? styles.messageBubbleMe : styles.messageBubbleOther]}>
          {/* Here we apply the Decorator pattern dynamically */}
          {decorateMessage(
            item.content,
            item.fileUrl,
            item.fileName,
            item.fileType,
            isMentioned,
            item.poll,
            session?.user.id,
            handleVotePoll
          )}
        </View>
        <Text style={styles.timeText}>
          {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    );
  };

  if (loading && !messages.length) return <ActivityIndicator style={{ flex: 1 }} color={Colors.light.tint} />;

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 80}>
      <Stack.Screen 
        options={{ 
          headerLeft: () => (
            <Pressable onPress={() => router.back()} style={{ marginRight: 15 }}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </Pressable>
          ),
          title: group?.name ? `Chat: ${group.name}` : 'Chat Grupal' 
        }} 
      />
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        onContentSizeChange={() => {
            if (page === 1) flatListRef.current?.scrollToEnd({ animated: true })
        }}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
      />

      {file && (
        <View style={styles.attachmentPreview}>
          <Text style={{ flex: 1 }} numberOfLines={1}>{file.name}</Text>
          <Pressable onPress={() => setFile(null)}>
            <Ionicons name="close-circle" size={24} color="red" />
          </Pressable>
        </View>
      )}

      {showMentions && members.length > 0 && (
        <View style={styles.mentionsContainer}>
          <FlatList
            data={members.filter(m => m.name?.toLowerCase().includes(mentionFilter.toLowerCase()))}
            keyExtractor={m => m.id}
            renderItem={({ item }) => (
              <Pressable onPress={() => insertMention(item.name || '')} style={styles.mentionItem}>
                <Text style={styles.mentionText}>{item.name}</Text>
              </Pressable>
            )}
            keyboardShouldPersistTaps="handled"
          />
        </View>
      )}

      {showPollComposer && (
        <View style={styles.pollComposer}>
          <View style={styles.pollComposerHeader}>
            <Text style={styles.pollComposerTitle}>Nueva encuesta</Text>
            <Pressable onPress={resetPollComposer} disabled={isSending}>
              <Ionicons name="close-circle" size={22} color="#ef4444" />
            </Pressable>
          </View>

          <TextInput
            style={styles.pollInput}
            placeholder="Mensaje opcional"
            value={pollMessage}
            onChangeText={setPollMessage}
            multiline
            editable={!isSending}
          />
          <TextInput
            style={styles.pollInput}
            placeholder="Pregunta de la encuesta"
            value={pollQuestion}
            onChangeText={setPollQuestion}
            multiline
            editable={!isSending}
          />

          <View style={styles.pollOptionRowComposer}>
            <TextInput
              style={[styles.pollInput, styles.pollOptionDraft]}
              placeholder="Agregar opción"
              value={pollOptionText}
              onChangeText={setPollOptionText}
              onSubmitEditing={addPollOption}
              returnKeyType="done"
              editable={!isSending}
            />
            <Pressable style={styles.pollAddBtn} onPress={addPollOption} disabled={isSending}>
              <Ionicons name="add" size={20} color="#fff" />
            </Pressable>
          </View>

          <View style={styles.pollChips}>
            {pollOptions.map((option, index) => (
              <Pressable key={`${option}-${index}`} style={styles.pollChip} onPress={() => removePollOption(index)} disabled={isSending}>
                <Text style={styles.pollChipText}>{option}</Text>
                <Ionicons name="close" size={14} color="#334155" />
              </Pressable>
            ))}
          </View>

          <View style={styles.pollSettingsRow}>
            <Pressable
              style={[styles.pollToggle, pollAllowMultiple && styles.pollToggleActive]}
              onPress={() => setPollAllowMultiple((prev) => !prev)}
              disabled={isSending}
            >
              <Text style={[styles.pollToggleText, pollAllowMultiple && styles.pollToggleTextActive]}>
                Voto múltiple
              </Text>
            </Pressable>
            <TextInput
              style={[styles.pollInput, styles.pollInlineInput]}
              placeholder="Máx."
              keyboardType="number-pad"
              value={pollMaxSelections}
              onChangeText={setPollMaxSelections}
              editable={!isSending}
            />
          </View>

          <View style={styles.pollSettingsRow}>
            <TextInput
              style={[styles.pollInput, styles.pollInlineInput]}
              placeholder="Cierra en min"
              keyboardType="number-pad"
              value={pollDurationMinutes}
              onChangeText={setPollDurationMinutes}
              editable={!isSending}
            />
            <TextInput
              style={[styles.pollInput, styles.pollDateInput]}
              placeholder="Fecha cierre ISO"
              value={pollClosingAt}
              onChangeText={setPollClosingAt}
              autoCapitalize="none"
              editable={!isSending}
            />
          </View>

          <Pressable
            style={[styles.sendPollBtn, (!pollQuestion.trim() || pollOptions.length < 2 || isSending) && styles.sendPollBtnDisabled]}
            onPress={handleCreatePoll}
            disabled={!pollQuestion.trim() || pollOptions.length < 2 || isSending}
          >
            {isSending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.sendPollBtnText}>Publicar encuesta</Text>
            )}
          </Pressable>
        </View>
      )}

      <View style={styles.inputContainer}>
        <Pressable style={styles.attachBtn} onPress={pickDocument} disabled={isSending}>
          <Ionicons name="attach" size={28} color={isSending ? '#9ca3af' : Colors.light.tint} />
        </Pressable>
        <Pressable style={styles.attachBtn} onPress={() => setShowPollComposer((prev) => !prev)} disabled={isSending}>
          <Ionicons name="bar-chart" size={26} color={showPollComposer ? '#2563eb' : (isSending ? '#9ca3af' : Colors.light.tint)} />
        </Pressable>
        <TextInput
          style={styles.input}
          placeholder={isSending ? "Enviando..." : "Escribe un mensaje..."}
          value={inputText}
          onChangeText={handleTextChange}
          multiline
          editable={!isSending}
        />
        <Pressable 
          style={[styles.sendBtn, (!inputText.trim() && !file || isSending) && styles.sendBtnDisabled]} 
          onPress={handleSend}
          disabled={!inputText.trim() && !file || isSending}
        >
          {isSending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="send" size={24} color="#fff" />
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  listContent: { padding: 15, paddingBottom: 20 },
  messageWrapper: { marginBottom: 15, maxWidth: '85%' },
  messageWrapperMe: { alignSelf: 'flex-end' },
  messageWrapperOther: { alignSelf: 'flex-start' },
  senderName: { fontSize: 12, color: '#6b7280', marginBottom: 4, marginLeft: 4 },
  messageBubble: { padding: 12, borderRadius: 16 },
  messageBubbleMe: { backgroundColor: '#dcf8c6', borderBottomRightRadius: 0 },
  messageBubbleOther: { backgroundColor: '#fff', borderBottomLeftRadius: 0, borderWidth: 1, borderColor: '#e5e7eb' },
  timeText: { fontSize: 10, color: '#9ca3af', alignSelf: 'flex-end', marginTop: 4 },
  attachmentPreview: { flexDirection: 'row', backgroundColor: '#e5e7eb', padding: 10, marginHorizontal: 15, borderRadius: 8, alignItems: 'center' },
  inputContainer: { flexDirection: 'row', padding: 10, backgroundColor: '#fff', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  attachBtn: { padding: 5, marginRight: 5 },
  input: { flex: 1, backgroundColor: '#f3f4f6', borderRadius: 20, paddingHorizontal: 15, paddingVertical: 10, maxHeight: 100 },
  sendBtn: { backgroundColor: Colors.light.tint, width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginLeft: 10 },
  sendBtnDisabled: { opacity: 0.5, backgroundColor: '#9ca3af' },
  mentionsContainer: { maxHeight: 150, backgroundColor: '#fff', borderTopWidth: 1, borderColor: '#e5e7eb', marginHorizontal: 10, borderRadius: 8, marginBottom: 5, elevation: 3, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 3, shadowOffset: { width: 0, height: -2 } },
  mentionItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  mentionText: { fontSize: 14, color: '#374151', fontWeight: '500' },
  pollComposer: {
    marginHorizontal: 10,
    marginBottom: 8,
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#dbeafe',
    padding: 12,
    gap: 10,
  },
  pollComposerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pollComposerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  pollInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#0f172a',
  },
  pollOptionRowComposer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pollOptionDraft: {
    flex: 1,
  },
  pollAddBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.light.tint,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pollChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pollChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  pollChipText: {
    color: '#1e3a8a',
    fontSize: 12,
    fontWeight: '600',
  },
  pollSettingsRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  pollToggle: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingVertical: 11,
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  pollToggleActive: {
    backgroundColor: '#dbeafe',
    borderColor: '#60a5fa',
  },
  pollToggleText: {
    color: '#334155',
    fontWeight: '600',
  },
  pollToggleTextActive: {
    color: '#1d4ed8',
  },
  pollInlineInput: {
    width: 90,
    textAlign: 'center',
  },
  pollDateInput: {
    flex: 1,
  },
  sendPollBtn: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  sendPollBtnDisabled: {
    opacity: 0.5,
  },
  sendPollBtnText: {
    color: '#fff',
    fontWeight: '700',
  },
});
