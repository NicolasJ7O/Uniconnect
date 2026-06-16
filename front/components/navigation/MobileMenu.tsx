import React from 'react';
import { Modal, View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { useNav } from './NavProvider';
import { useNotifications } from '@/context/NotificationContext';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { router } from 'expo-router';

export default function MobileMenu() {
  const { menuItems, mobileOpen, closeMobile } = useNav();
  const { unreadCount } = useNotifications();

  return (
    <Modal visible={mobileOpen} animationType="slide" onRequestClose={closeMobile}>
      <View style={styles.header}>
        <Text style={styles.title}>Menú</Text>
        <Pressable onPress={closeMobile} style={styles.closeBtn}><Text style={{ color: '#fff' }}>Cerrar</Text></Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.container}>
        {menuItems.map((it) => (
          <Pressable key={it.key} style={styles.row} onPress={() => {
            closeMobile();
            if (it.action) return it.action();
            if (it.route) router.push(it.route as any);
          }}>
            {/* @ts-ignore */}
            <IconSymbol name={it.icon || 'circle'} size={22} color="#003e70" />
            <Text style={styles.label}>{it.label}</Text>
            {it.key === 'notifications' && unreadCount > 0 && (
              <View style={styles.badge}><Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text></View>
            )}
          </Pressable>
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
  label: { marginLeft: 12, fontWeight: '700', color: '#0f172a' },
  badge: { backgroundColor: '#ef4444', paddingHorizontal: 6, borderRadius: 12, marginLeft: 'auto' },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
});
