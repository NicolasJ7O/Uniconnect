import React, { useState } from 'react';
import { Modal, View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { useNav } from './NavProvider';
import { useNotifications } from '@/context/NotificationContext';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { router } from 'expo-router';

export default function MobileMenu() {
  const { menuItems, mobileOpen, closeMobile } = useNav();
  const { unreadCount } = useNotifications();
  const [expandedKeys, setExpandedKeys] = useState<Record<string, boolean>>({});

  const toggleExpand = (key: string) => {
    setExpandedKeys(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <Modal visible={mobileOpen} animationType="slide" onRequestClose={closeMobile}>
      <View style={styles.header}>
        <Text style={styles.title}>Menú</Text>
        <Pressable onPress={closeMobile} style={styles.closeBtn}><Text style={{ color: '#fff' }}>Cerrar</Text></Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.container}>
        {menuItems.map((it) => (
          <View key={it.key}>
            <Pressable style={styles.row} onPress={() => {
              if (it.children && it.children.length > 0) {
                toggleExpand(it.key);
              } else {
                closeMobile();
                if (it.action) return it.action();
                if (it.route) router.push(it.route as any);
              }
            }}>
              {/* @ts-ignore */}
              <IconSymbol name={it.icon || 'circle'} size={22} color="#003e70" />
              <Text style={styles.label}>{it.label}</Text>
              {it.key === 'notifications' && unreadCount > 0 && (
                <View style={styles.badge}><Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text></View>
              )}
              {it.children && it.children.length > 0 && (
                // @ts-ignore
                <IconSymbol name={expandedKeys[it.key] ? 'chevron.down' : 'chevron.right'} size={16} color="#64748b" style={{ marginLeft: 'auto' }} />
              )}
            </Pressable>
            {expandedKeys[it.key] && it.children && (
              <View style={styles.subMenu}>
                {it.children.map(sub => (
                  <Pressable
                    key={sub.key}
                    style={styles.subMenuItem}
                    onPress={() => {
                      closeMobile();
                      if (sub.action) return sub.action();
                      if (sub.route) router.push(sub.route as any);
                    }}
                  >
                    {/* @ts-ignore */}
                    <IconSymbol name={sub.icon || 'circle'} size={16} color="#64748b" />
                    <Text style={styles.subMenuLabel} numberOfLines={1}>{sub.label}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        ))}
      </ScrollView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: { backgroundColor: '#003e70', padding: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: '#fff', fontWeight: '800', fontSize: 18 },
  closeBtn: { backgroundColor: '#0ea5a4', padding: 8, borderRadius: 8 },
  container: { padding: 16, backgroundColor: '#f8fafc' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#eef2f7' },
  label: { marginLeft: 12, fontWeight: '700', color: '#0f172a', flex: 1 },
  badge: { backgroundColor: '#ef4444', paddingHorizontal: 6, borderRadius: 12, marginLeft: 'auto' },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  subMenu: { paddingLeft: 36, paddingBottom: 6 },
  subMenuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  subMenuLabel: { fontSize: 14, color: '#475569', fontWeight: '500', flex: 1 },
});
