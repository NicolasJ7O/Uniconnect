import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  visible: boolean;
  moderationCode?: string;
  onClose: () => void;
}

// ─── Normas reales de la plataforma UniConnect ────────────────────────────────

interface RuleData {
  title: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  color: string;
  description: string;
  allowed: string[];
  notAllowed: string[];
}

const RULES: Record<string, RuleData> = {
  MO_001: {
    title: 'Límite de longitud',
    icon: 'resize-outline',
    color: '#ca8a04',
    description:
      'Los mensajes en UniConnect tienen un límite de 1000 caracteres para mantener las conversaciones claras y ágiles. Los mensajes largos pueden dificultar la lectura para el resto de los miembros.',
    allowed: [
      'Mensajes concisos y directos al punto.',
      'Dividir información larga en varios mensajes sucesivos.',
      'Usar archivos adjuntos para compartir documentos extensos.',
    ],
    notAllowed: [
      'Mensajes que superen los 1000 caracteres en un solo envío.',
      'Copiar y pegar artículos o textos completos en el chat.',
    ],
  },
  MO_002: {
    title: 'Palabras prohibidas',
    icon: 'chatbubble-ellipses-outline',
    color: '#ea580c',
    description:
      'UniConnect es un espacio académico y respetuoso. El uso de palabras ofensivas, insultos, lenguaje discriminatorio o expresiones que puedan dañar la convivencia está estrictamente prohibido en todos los chats de la plataforma.',
    allowed: [
      'Lenguaje respetuoso y constructivo.',
      'Críticas académicas orientadas al contenido, no a las personas.',
      'Expresar desacuerdos de forma educada y argumentada.',
    ],
    notAllowed: [
      'Insultos, groserías o lenguaje ofensivo hacia otros usuarios.',
      'Expresiones discriminatorias por género, raza, religión u orientación.',
      'Amenazas o mensajes que generen un ambiente hostil.',
    ],
  },
  MO_003: {
    title: 'Anti-spam',
    icon: 'flash-outline',
    color: '#dc2626',
    description:
      'Para garantizar una experiencia fluida para todos, el sistema limita la frecuencia con la que puedes enviar mensajes. Si envías más de 5 mensajes en menos de 30 segundos, tu cuenta quedará bloqueada temporalmente por 5 minutos. Acumular 3 bloqueos genera una revisión administrativa.',
    allowed: [
      'Enviar mensajes a un ritmo natural de conversación.',
      'Esperar respuestas antes de enviar múltiples mensajes seguidos.',
      'Usar un solo mensaje para comunicar varias ideas.',
    ],
    notAllowed: [
      'Enviar el mismo mensaje repetidamente (flood).',
      'Enviar más de 5 mensajes en un lapso de 30 segundos.',
      'Intentar evadir el bloqueo cerrando y reabriendo la sesión.',
    ],
  },
  MO_004: {
    title: 'Enlaces externos',
    icon: 'link-outline',
    color: '#7c3aed',
    description:
      'Por seguridad, los mensajes no pueden contener enlaces a sitios web externos. Esto protege a los miembros de la comunidad de posibles enlaces maliciosos o de phishing. Si necesitas compartir un recurso, utiliza el módulo de Biblioteca o adjunta el archivo directamente.',
    allowed: [
      'Compartir archivos adjuntos directamente desde el chat.',
      'Subir recursos al módulo de Biblioteca del grupo de estudio.',
      'Mencionar el nombre de un recurso para que otros lo busquen.',
    ],
    notAllowed: [
      'Incluir URLs de sitios web externos (http://, https://, www.).',
      'Compartir enlaces a servicios de almacenamiento como Drive o Dropbox.',
      'Enviar links acortados o redirecciones externas.',
    ],
  },
};

const DEFAULT_RULE: RuleData = {
  title: 'Normas de la comunidad',
  icon: 'shield-checkmark-outline',
  color: '#3b82f6',
  description:
    'Tu mensaje fue rechazado por el sistema de moderación de UniConnect. Revisa las normas de la comunidad para asegurarte de que tus mensajes cumplan con los lineamientos de la plataforma.',
  allowed: ['Mensajes respetuosos y académicos.', 'Contenido relevante para el grupo o conversación.'],
  notAllowed: ['Mensajes ofensivos, spam o con enlaces externos.'],
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function ModerationWhyModal({ visible, moderationCode, onClose }: Props) {
  const rule = (moderationCode && RULES[moderationCode]) || DEFAULT_RULE;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose} />

      <View style={styles.sheet}>
        {/* Handle */}
        <View style={styles.handle} />

        {/* Header */}
        <View style={styles.header}>
          <View style={[styles.iconCircle, { backgroundColor: rule.color + '20' }]}>
            <Ionicons name={rule.icon} size={22} color={rule.color} />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.codeLabel}>
              {moderationCode ?? 'Moderación'}
            </Text>
            <Text style={styles.ruleTitle}>{rule.title}</Text>
          </View>
          <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn}>
            <Ionicons name="close-circle" size={26} color="#9ca3af" />
          </Pressable>
        </View>

        <ScrollView
          style={styles.body}
          contentContainerStyle={styles.bodyContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Description */}
          <Text style={styles.description}>{rule.description}</Text>

          {/* Allowed */}
          <SectionBlock
            title="✅ Permitido"
            items={rule.allowed}
            itemColor="#16a34a"
            bgColor="#f0fdf4"
            borderColor="#86efac"
          />

          {/* Not allowed */}
          <SectionBlock
            title="🚫 No permitido"
            items={rule.notAllowed}
            itemColor="#dc2626"
            bgColor="#fef2f2"
            borderColor="#fca5a5"
          />

          {/* Footer note */}
          <View style={styles.footerNote}>
            <Ionicons name="information-circle-outline" size={14} color="#6b7280" />
            <Text style={styles.footerText}>
              UniConnect aplica estas normas automáticamente para mantener un ambiente de aprendizaje
              respetuoso y seguro para todos los miembros.
            </Text>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Section sub-component ────────────────────────────────────────────────────

function SectionBlock({
  title,
  items,
  itemColor,
  bgColor,
  borderColor,
}: {
  title: string;
  items: string[];
  itemColor: string;
  bgColor: string;
  borderColor: string;
}) {
  return (
    <View style={[styles.section, { backgroundColor: bgColor, borderColor }]}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {items.map((item, idx) => (
        <View key={idx} style={styles.bulletRow}>
          <Text style={[styles.bullet, { color: itemColor }]}>•</Text>
          <Text style={styles.bulletText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    paddingBottom: Platform.OS === 'ios' ? 32 : 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 20,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#e5e7eb',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerText: {
    flex: 1,
  },
  codeLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9ca3af',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  ruleTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  closeBtn: {
    padding: 2,
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
    gap: 14,
  },
  description: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 21,
  },
  section: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  bulletRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  bullet: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
  },
  bulletText: {
    flex: 1,
    fontSize: 13,
    color: '#374151',
    lineHeight: 19,
  },
  footerNote: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'flex-start',
    paddingTop: 4,
  },
  footerText: {
    flex: 1,
    fontSize: 11,
    color: '#9ca3af',
    lineHeight: 16,
  },
});
