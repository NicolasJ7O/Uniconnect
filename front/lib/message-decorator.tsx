import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { authConfig } from '@/constants/AuthConfig';
import { Colors } from '@/constants/Colors';

export interface BaseMessageProps {
  content: string;
}

export interface PollOptionData {
  id: string;
  label: string;
  votes: number;
  voterIds: string[];
  percentage: number;
}

export interface PollData {
  id: string;
  question: string;
  allowMultiple: boolean;
  maxSelections: number;
  closingAt?: string | null;
  closedAt?: string | null;
  status: 'ACTIVE' | 'CLOSED';
  totalVotes: number;
  participantCount: number;
  participantIds: string[];
  options: PollOptionData[];
}

// 1. Componente Base
export const BaseMessage: React.FC<BaseMessageProps> = ({ content }) => {
  // Parse HTML from backend: mentions and links
  const regex = /(<span class="mention">.*?<\/span>|<a href=".*?">.*?<\/a>)/gi;
  const parts = content.split(regex);

  if (parts.length === 1) {
    const cleanContent = content.replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    return <Text style={styles.messageText}>{cleanContent}</Text>;
  }

  return (
    <Text style={styles.messageText}>
      {parts.map((part, index) => {
        if (part.startsWith('<span class="mention"')) {
          const innerText = part.replace(/<[^>]+>/g, '');
          return <Text key={index} style={styles.inlineMention}>{innerText}</Text>;
        }
        if (part.startsWith('<a href="')) {
          const matchUrl = part.match(/href="(.*?)"/);
          const url = matchUrl ? matchUrl[1] : '';
          const innerText = part.replace(/<[^>]+>/g, '');
          return (
            <Text key={index} style={styles.inlineLink} onPress={() => { if(url) Linking.openURL(url).catch(console.error); }}>
              {innerText}
            </Text>
          );
        }
        
        // Strip any residual/naked </span> tags that may have resulted from double-wrapping bugs from database history
        const cleanPart = part.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/<\/span>/g, '').replace(/<span[^>]*>/g, '');
        return <Text key={index}>{cleanPart}</Text>;
      })}
    </Text>
  );
};

// 2. Decorador de Adjunto
export const withAttachment = (WrappedComponent: React.FC<BaseMessageProps>, fileUrl: string, fileName: string, fileType: string) => {
  return function AttachmentDecorator(props: BaseMessageProps) {
    const handleOpenFile = () => {
      if (fileUrl) {
        const fullUrl = authConfig.backendUrl.replace('/api', '') + fileUrl;
        Linking.openURL(fullUrl).catch(console.error);
      }
    };

    let iconName = 'document-text';
    if (fileType?.includes('image')) iconName = 'image';
    else if (fileType?.includes('pdf')) iconName = 'document-text';
    else if (fileType?.includes('video')) iconName = 'videocam';
    else if (fileType?.includes('audio')) iconName = 'musical-notes';
    else if (fileType?.includes('zip') || fileType?.includes('archive') || fileType?.includes('rar')) iconName = 'archive';
    else if (fileType?.includes('sheet') || fileType?.includes('excel') || fileType?.includes('csv')) iconName = 'stats-chart';
    else if (fileType?.includes('word')) iconName = 'document';

    return (
      <View style={styles.decoratedContainer}>
        <WrappedComponent {...props} />
        <Pressable onPress={handleOpenFile} style={styles.attachmentBox}>
          <Ionicons name={iconName as any} size={24} color={Colors.light.tint} />
          <Text style={styles.attachmentName} numberOfLines={1}>{fileName || 'Archivo adjunto'}</Text>
        </Pressable>
      </View>
    );
  };
};

// 3. Decorador de Mención
export const withMention = (WrappedComponent: React.FC<BaseMessageProps>, isMentioned: boolean) => {
  return function MentionDecorator(props: BaseMessageProps) {
    return (
      <View style={[styles.decoratedContainer, isMentioned && styles.mentionHighlight]}>
        <WrappedComponent {...props} />
      </View>
    );
  };
};

// 4. Decorador de Encuesta
export const withPoll = (
  WrappedComponent: React.FC<BaseMessageProps>,
  poll: PollData,
  currentUserId?: string,
  onVote?: (pollId: string, optionId: string) => void | Promise<void>,
) => {
  return function PollDecorator(props: BaseMessageProps) {
    const isClosed = poll.status === 'CLOSED';
    const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);

    useEffect(() => {
      let timer: ReturnType<typeof setInterval> | null = null;

      const compute = () => {
        if (!poll.closingAt || poll.status === 'CLOSED') {
          setRemainingSeconds(null);
          return;
        }
        const diff = Math.max(0, Math.floor((Date.parse(poll.closingAt) - Date.now()) / 1000));
        setRemainingSeconds(diff);
        if (diff <= 0 && timer) {
          clearInterval(timer);
          timer = null;
        }
      };

      compute();
      if (poll.closingAt && poll.status !== 'CLOSED') {
        timer = setInterval(compute, 1000);
      }

      return () => {
        if (timer) clearInterval(timer);
      };
    }, [poll.closingAt, poll.status]);

    const closingAtLabel = poll.closingAt
      ? new Date(poll.closingAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })
      : null;

    const formatSeconds = (s: number) => {
      const mm = Math.floor(s / 60).toString().padStart(2, '0');
      const ss = (s % 60).toString().padStart(2, '0');
      return `${mm}:${ss}`;
    };

    return (
      <View style={styles.decoratedContainer}>
        <WrappedComponent {...props} />
        <View style={[styles.pollCard, isClosed && styles.pollCardClosed]}>
          <View style={styles.pollHeader}>
            <Text style={styles.pollQuestion}>{poll.question}</Text>
            <Text style={[styles.pollStatus, isClosed ? styles.pollStatusClosed : styles.pollStatusActive]}>
              {isClosed ? 'Cerrada' : 'Activa'}
            </Text>
          </View>

          {poll.status !== 'CLOSED' && remainingSeconds !== null && (
            <Text style={styles.pollMeta}>Cierra en: {formatSeconds(remainingSeconds)}</Text>
          )}
          {poll.status === 'CLOSED' && closingAtLabel && <Text style={styles.pollMeta}>Cierra: {closingAtLabel}</Text>}

          <Text style={styles.pollMeta}>
            {poll.totalVotes} votos · {poll.participantCount} participantes
          </Text>

          <View style={styles.pollOptions}>
            {poll.options.map((option) => {
              const selectedByMe = !!currentUserId && option.voterIds.includes(currentUserId);
              const disabled = isClosed || !onVote;

              return (
                <Pressable
                  key={option.id}
                  onPress={() => onVote?.(poll.id, option.id)}
                  disabled={disabled}
                  style={[
                    styles.pollOption,
                    selectedByMe && styles.pollOptionSelected,
                    disabled && styles.pollOptionDisabled,
                  ]}
                >
                  <View style={styles.pollOptionRow}>
                    <Text style={styles.pollOptionLabel}>{option.label}</Text>
                    <Text style={styles.pollOptionVotes}>{option.percentage}%</Text>
                  </View>
                  <View style={styles.pollProgressTrack}>
                    <View style={[styles.pollProgressFill, { width: `${option.percentage}%` }]} />
                  </View>
                  <Text style={styles.pollOptionCount}>
                    {option.votes} voto{option.votes === 1 ? '' : 's'}
                    {selectedByMe ? ' · tu voto' : ''}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.pollHint}>
            {isClosed
              ? 'Los resultados quedan guardados en el historial del chat.'
              : poll.allowMultiple
                ? `Puedes seleccionar hasta ${poll.maxSelections} opciones.`
                : 'Solo se permite un voto por usuario.'}
          </Text>
        </View>
      </View>
    );
  };
};

// Método para aplicar los decoradores dinámicamente
export const decorateMessage = (
  content: string,
  fileUrl?: string,
  fileName?: string,
  fileType?: string,
  isMentioned?: boolean,
  poll?: PollData,
  currentUserId?: string,
  onVote?: (pollId: string, optionId: string) => void | Promise<void>,
) => {
  let Component = BaseMessage;

  if (fileUrl && fileType) {
    Component = withAttachment(Component, fileUrl, fileName || 'Archivo', fileType) as any;
  }

  if (isMentioned) {
    Component = withMention(Component, isMentioned) as any;
  }

  if (poll) {
    Component = withPoll(Component, poll, currentUserId, onVote) as any;
  }

  return <Component content={content} />;
};

const styles = StyleSheet.create({
  messageText: {
    fontSize: 15,
    color: '#334155',
    lineHeight: 22,
  },
  decoratedContainer: {
    borderRadius: 8,
  },
  mentionHighlight: {
    backgroundColor: '#fef3c7', // Yellowish highlight
    borderColor: '#f59e0b',
    borderWidth: 1,
    padding: 8,
  },
  attachmentBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    padding: 10,
    borderRadius: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  attachmentName: {
    marginLeft: 8,
    color: Colors.light.tint,
    fontWeight: 'bold',
    flex: 1,
  },
  inlineMention: {
    color: '#d97706',
    fontWeight: 'bold',
    backgroundColor: '#fef3c7',
  },
  inlineLink: {
    color: Colors.light.tint,
    textDecorationLine: 'underline',
  },
  pollCard: {
    marginTop: 10,
    padding: 12,
    borderRadius: 14,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    gap: 8,
  },
  pollCardClosed: {
    opacity: 0.92,
    backgroundColor: '#f1f5f9',
  },
  pollHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  pollQuestion: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  pollStatus: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: 'hidden',
  },
  pollStatusActive: {
    color: '#166534',
    backgroundColor: '#dcfce7',
  },
  pollStatusClosed: {
    color: '#7f1d1d',
    backgroundColor: '#fee2e2',
  },
  pollMeta: {
    fontSize: 11,
    color: '#64748b',
  },
  pollOptions: {
    gap: 8,
  },
  pollOption: {
    padding: 10,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 6,
  },
  pollOptionSelected: {
    borderColor: Colors.light.tint,
    backgroundColor: '#eff6ff',
  },
  pollOptionDisabled: {
    opacity: 0.72,
  },
  pollOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  pollOptionLabel: {
    flex: 1,
    fontSize: 14,
    color: '#0f172a',
    fontWeight: '600',
  },
  pollOptionVotes: {
    fontSize: 12,
    color: Colors.light.tint,
    fontWeight: '700',
  },
  pollProgressTrack: {
    height: 8,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: '#e2e8f0',
  },
  pollProgressFill: {
    height: '100%',
    backgroundColor: Colors.light.tint,
    borderRadius: 999,
  },
  pollOptionCount: {
    fontSize: 11,
    color: '#64748b',
  },
  pollHint: {
    fontSize: 11,
    color: '#64748b',
    fontStyle: 'italic',
  },
});
