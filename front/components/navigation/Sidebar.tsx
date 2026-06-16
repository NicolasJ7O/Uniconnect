import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useNav } from './NavProvider';
import { useNotifications } from '@/context/NotificationContext';
import { router } from 'expo-router';
import { IconSymbol } from '@/components/ui/IconSymbol';

export default function Sidebar() {
  const { menuItems, collapsed, toggleCollapse } = useNav();
  const { unreadCount } = useNotifications();

  return (
    <View style={[styles.container, collapsed && styles.containerCollapsed]}>
      <View style={styles.logoContainer}>
        <Text style={styles.logoText}>UniConnect</Text>
      </View>
      <View style={styles.menuList}>
        {menuItems.map((it) => (
          <Pressable
            key={it.key}
            style={styles.menuItem}
            onPress={() => {
              if (it.action) return it.action();
              if (it.route) router.push(it.route as any);
            }}
          >
            {/* @ts-ignore */}
            <IconSymbol name={it.icon || 'circle'} size={20} color="#003e70" />
            {!collapsed && (
              <Text style={styles.menuLabel}>{it.label}</Text>
            )}
            {it.key === 'notifications' && unreadCount > 0 && (
              <View style={styles.badge}><Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text></View>
            )}
          </Pressable>
        ))}
      </View>

      <Pressable style={styles.collapseBtn} onPress={toggleCollapse}>
        <Text style={styles.collapseText}>{collapsed ? '▶' : '◀'} </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: 260, backgroundColor: '#fff', borderRightWidth: 1, borderRightColor: '#e6eef6', paddingVertical: 12, paddingHorizontal: 8 },
  containerCollapsed: { width: 72 },
  logoContainer: { padding: 8, marginBottom: 8 },
  logoText: { fontWeight: '800', color: '#003e70' },
  menuList: { marginTop: 8 },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 6, gap: 10 },
  menuLabel: { marginLeft: 10, fontWeight: '600', color: '#0f172a' },
  badge: { backgroundColor: '#ef4444', paddingHorizontal: 6, borderRadius: 12, marginLeft: 'auto' },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  collapseBtn: { marginTop: 'auto', padding: 8, alignItems: 'center' },
  collapseText: { color: '#64748b' },
});
