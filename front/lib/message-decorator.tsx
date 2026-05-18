import React from 'react';
import { View, Text, StyleSheet, Pressable, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { authConfig } from '@/constants/AuthConfig';
import { Colors } from '@/constants/Colors';

export interface BaseMessageProps {
  content: string;
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

// Método para aplicar los decoradores dinámicamente
export const decorateMessage = (content: string, fileUrl?: string, fileName?: string, fileType?: string, isMentioned?: boolean) => {
  let Component = BaseMessage;

  if (fileUrl && fileType) {
    Component = withAttachment(Component, fileUrl, fileName || 'Archivo', fileType) as any;
  }

  if (isMentioned) {
    Component = withMention(Component, isMentioned) as any;
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
  }
});
