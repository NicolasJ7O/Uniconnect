import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCountdown } from '@/hooks/useCountdown';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ModerationSeverity = 'low' | 'medium' | 'high';

export interface ModerationRejectedPayload {
  moderationCode: string;
  message: string;
  severity: ModerationSeverity;
  suggestion: string;
  whyUrl: string;
  blockedUntil?: string; // ISO string
}

interface Props {
  payload: ModerationRejectedPayload;
  onDismiss: () => void;
  onWhyPress: () => void;
  /** Called when a block expires so the parent can re-enable the input */
  onBlockExpired?: () => void;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const SEVERITY_CONFIG = {
  low:    { bg: '#fefce8', border: '#fde047', iconColor: '#ca8a04', icon: 'warning-outline'      as const },
  medium: { bg: '#fff7ed', border: '#fb923c', iconColor: '#ea580c', icon: 'alert-circle-outline' as const },
  high:   { bg: '#fef2f2', border: '#f87171', iconColor: '#dc2626', icon: 'ban-outline'          as const },
};

const CODE_LABEL: Record<string, string> = {
  MO_001: 'Longitud',
  MO_002: 'Contenido',
  MO_003: 'Spam',
  MO_004: 'Enlace externo',
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function ModerationBanner({ payload, onDismiss, onWhyPress, onBlockExpired }: Props) {
  const { moderationCode, severity, suggestion, blockedUntil } = payload;
  const config = SEVERITY_CONFIG[severity] ?? SEVERITY_CONFIG.medium;

  const { minutes, seconds, expired } = useCountdown(blockedUntil);
  const slideAnim = useRef(new Animated.Value(-20)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  // Slide + fade in on mount
  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 80, friction: 10 }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();
  }, []);

  // Notify parent when countdown expires
  useEffect(() => {
    if (expired && blockedUntil && onBlockExpired) {
      onBlockExpired();
    }
  }, [expired, blockedUntil]);

  const pad = (n: number) => String(n).padStart(2, '0');

  return (
    <Animated.View
      style={[
        styles.container,
        { backgroundColor: config.bg, borderColor: config.border },
        { transform: [{ translateY: slideAnim }], opacity: opacityAnim },
      ]}
    >
      {/* Header row */}
      <View style={styles.headerRow}>
        <View style={styles.leftRow}>
          <Ionicons name={config.icon} size={18} color={config.iconColor} />
          <View style={[styles.codeBadge, { borderColor: config.border }]}>
            <Text style={[styles.codeText, { color: config.iconColor }]}>
              {moderationCode}
            </Text>
          </View>
          <Text style={[styles.label, { color: config.iconColor }]}>
            {CODE_LABEL[moderationCode] ?? 'Moderación'}
          </Text>
        </View>

        <Pressable onPress={onDismiss} hitSlop={10} style={styles.closeBtn}>
          <Ionicons name="close" size={18} color="#6b7280" />
        </Pressable>
      </View>

      {/* Suggestion */}
      <Text style={styles.suggestion}>{suggestion}</Text>

      {/* Countdown for spam blocks */}
      {blockedUntil && !expired && (
        <View style={styles.countdownRow}>
          <Ionicons name="time-outline" size={14} color="#dc2626" />
          <Text style={styles.countdownText}>
            Podrás escribir en{' '}
            <Text style={styles.countdownTimer}>
              {pad(minutes)}:{pad(seconds)}
            </Text>
          </Text>
        </View>
      )}

      {blockedUntil && expired && (
        <Text style={styles.unblocked}>✅ ¡Ya puedes escribir de nuevo!</Text>
      )}

      {/* Why link */}
      <Pressable onPress={onWhyPress} style={styles.whyBtn}>
        <Ionicons name="information-circle-outline" size={14} color="#3b82f6" />
        <Text style={styles.whyText}>¿Por qué ocurrió esto?</Text>
      </Pressable>
    </Animated.View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 12,
    marginBottom: 6,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  codeBadge: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  codeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
  },
  closeBtn: {
    padding: 2,
  },
  suggestion: {
    fontSize: 13,
    color: '#374151',
    lineHeight: 18,
  },
  countdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  countdownText: {
    fontSize: 12,
    color: '#6b7280',
  },
  countdownTimer: {
    fontWeight: '700',
    color: '#dc2626',
    fontVariant: ['tabular-nums'],
  },
  unblocked: {
    fontSize: 12,
    color: '#16a34a',
    fontWeight: '600',
    marginTop: 2,
  },
  whyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
    alignSelf: 'flex-start',
  },
  whyText: {
    fontSize: 12,
    color: '#3b82f6',
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
});
