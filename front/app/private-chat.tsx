import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, Pressable, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, Stack, router } from 'expo-router';
import { chatApi, type ChatMessage } from '@/lib/chat-api';
import { loadSession, type SessionData } from '@/lib/session';
import { useNotifications } from '@/context/NotificationContext';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import * as DocumentPicker from 'expo-document-picker';
import { decorateMessage } from '@/lib/message-decorator';

export default function PrivateChat() {
  const { id, name } = useLocalSearchParams<{ id: string, name?: string }>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [session, setSession] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchingMore, setFetchingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [file, setFile] = useState<any>(null);
  const [isOnline, setIsOnline] = useState(false);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const flatListRef = useRef<FlatList>(null);

  const { socket } = useNotifications();

  const fetchHistory = useCallback(async (pageNumber: number) => {
    try {
      if (pageNumber === 1) setLoading(true);
      else setFetchingMore(true);

      const data = await chatApi.getPrivateHistory(id, pageNumber, 20);

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

  useEffect(() => {
    loadSession().then(setSession);
    fetchHistory(1);
  }, [id, fetchHistory]);

  const loadMore = () => {
    if (!hasMore || fetchingMore || loading) return;
    fetchHistory(page + 1);
  };

  useEffect(() => {
    if (!socket || !session) return;

    // Pedir estado inicial
    socket.emit('check-status', id);

    const onMessage = (msg: ChatMessage) => {
      // Check if message belongs to this conversation
      if ((msg.senderId === id && msg.receiverId === session.user.id) || 
          (msg.senderId === session.user.id && msg.receiverId === id)) {
        setMessages((prev) => {
          if (prev.find(m => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
      }
    };

    const onStatusChanged = (data: { userId: string, status: string }) => {
      if (data.userId === id) {
        setIsOnline(data.status === 'online');
      }
    };

    socket.on('private-message', onMessage);
    socket.on('user-status-changed', onStatusChanged);

    return () => {
      socket.off('private-message', onMessage);
      socket.off('user-status-changed', onStatusChanged);
    };
  }, [socket, id, session]);

  const handleSend = async () => {
    if (!inputText.trim() && !file) return;

    try {
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

      await chatApi.sendPrivateMessage(id, inputText.trim(), fileToUpload);
      setInputText('');
      setFile(null);
    } catch (e) {
      console.error(e);
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

  const insertMention = (memberName: string) => {
    const firstName = memberName.split(' ')[0];
    const newText = inputText.replace(/@\w*$/, `@${firstName} `);
    setInputText(newText);
    setShowMentions(false);
  };

  const pickDocument = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
    if (!result.canceled && result.assets) {
      setFile(result.assets[0]);
    }
  };

  const renderItem = ({ item }: { item: ChatMessage }) => {
    const isMe = item.senderId === session?.user.id;
    const firstName = session?.user.name?.split(' ')[0];
    const isMentioned = !!firstName && item.content.includes(`@${firstName}`);

    return (
      <View style={[styles.messageWrapper, isMe ? styles.messageWrapperMe : styles.messageWrapperOther]}>
        <View style={[styles.messageBubble, isMe ? styles.messageBubbleMe : styles.messageBubbleOther]}>
          {decorateMessage(item.content, item.fileUrl, item.fileName, item.fileType, isMentioned)}
        </View>
        <Text style={styles.timeText}>
          {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    );
  };

  if (loading) return <ActivityIndicator style={{ flex: 1 }} color={Colors.light.tint} />;

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen
        options={{
          headerLeft: () => (
            <Pressable onPress={() => router.back()} style={{ marginRight: 15 }}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </Pressable>
          ),
          headerTitle: () => (
            <View style={{ flexDirection: 'column' }}>
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>
                {name || 'Chat Privado'}
              </Text>
              <Text style={{ color: isOnline ? '#4ade80' : '#9ca3af', fontSize: 12 }}>
                {isOnline ? 'En línea' : 'Desconectado'}
              </Text>
            </View>
          )
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
        inverted={false}
      />

      {showMentions && name && name.toLowerCase().includes(mentionFilter.toLowerCase()) && (
        <View style={styles.mentionsContainer}>
          <Pressable onPress={() => insertMention(name)} style={styles.mentionItem}>
            <Text style={styles.mentionText}>{name}</Text>
          </Pressable>
        </View>
      )}

      {file && (
        <View style={styles.attachmentPreview}>
          <Text style={{ flex: 1 }} numberOfLines={1}>{file.name}</Text>
          <Pressable onPress={() => setFile(null)}>
            <Ionicons name="close-circle" size={24} color="red" />
          </Pressable>
        </View>
      )}

      <View style={styles.inputContainer}>
        <Pressable style={styles.attachBtn} onPress={pickDocument}>
          <Ionicons name="attach" size={28} color={Colors.light.tint} />
        </Pressable>
        <TextInput
          style={styles.input}
          placeholder="Escribe un mensaje..."
          value={inputText}
          onChangeText={handleTextChange}
          multiline
        />
        <Pressable style={styles.sendBtn} onPress={handleSend}>
          <Ionicons name="send" size={24} color="#fff" />
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
  messageBubble: { padding: 12, borderRadius: 16 },
  messageBubbleMe: { backgroundColor: '#dbeafe', borderBottomRightRadius: 0 },
  messageBubbleOther: { backgroundColor: '#fff', borderBottomLeftRadius: 0, borderWidth: 1, borderColor: '#e5e7eb' },
  timeText: { fontSize: 10, color: '#9ca3af', alignSelf: 'flex-end', marginTop: 4 },
  attachmentPreview: { flexDirection: 'row', backgroundColor: '#e5e7eb', padding: 10, marginHorizontal: 15, borderRadius: 8, alignItems: 'center' },
  inputContainer: { flexDirection: 'row', padding: 10, backgroundColor: '#fff', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  attachBtn: { padding: 5, marginRight: 5 },
  input: { flex: 1, backgroundColor: '#f3f4f6', borderRadius: 20, paddingHorizontal: 15, paddingVertical: 10, maxHeight: 100 },
  sendBtn: { backgroundColor: Colors.light.tint, width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginLeft: 10 },
  mentionsContainer: { backgroundColor: '#fff', borderTopWidth: 1, borderColor: '#e5e7eb', marginHorizontal: 10, borderRadius: 8, marginBottom: 5, elevation: 3, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 3, shadowOffset: { width: 0, height: -2 } },
  mentionItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  mentionText: { fontSize: 14, color: '#374151', fontWeight: '500' },
});
