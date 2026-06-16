import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { useNav } from './NavProvider';
import { useNotifications } from '@/context/NotificationContext';
import { router } from 'expo-router';
import { IconSymbol } from '@/components/ui/IconSymbol';

export default function Sidebar() {
  const { menuItems, collapsed, toggleCollapse } = useNav();
  const { unreadCount } = useNotifications();
  const [expandedKeys, setExpandedKeys] = useState<Record<string, boolean>>({});

  const toggleExpand = (key: string) => {
    if (collapsed) toggleCollapse();
    setExpandedKeys(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <View style={[styles.container, collapsed && styles.containerCollapsed]}>
      <View style={styles.logoContainer}>
        <Pressable onPress={toggleCollapse} style={styles.hamburger}>
          {/* @ts-ignore */}
          <IconSymbol name="list.bullet" size={24} color="#ffffff" />
        </Pressable>
        {!collapsed && <Text style={styles.logoText}>UniConnect</Text>}
      </View>
      <ScrollView style={styles.menuList}>
        {menuItems.map((it) => (
          <View key={it.key}>
            <Pressable
              style={styles.menuItem}
              onPress={() => {
                if (it.children && it.children.length > 0) {
                  toggleExpand(it.key);
                } else {
                  if (it.action) return it.action();
                  if (it.route) router.push(it.route as any);
                }
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
              {!collapsed && it.children && it.children.length > 0 && (
                // @ts-ignore
                <IconSymbol name={expandedKeys[it.key] ? 'chevron.down' : 'chevron.right'} size={16} color="#64748b" style={{ marginLeft: 'auto' }} />
              )}
            </Pressable>
            {!collapsed && expandedKeys[it.key] && it.children && (
              <View style={styles.subMenu}>
                {it.children.map(sub => (
                  <Pressable
                    key={sub.key}
                    style={styles.subMenuItem}
                    onPress={() => {
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

      <Pressable style={styles.collapseBtn} onPress={toggleCollapse}>
        <Text style={styles.collapseText}>{collapsed ? '▶' : '◀'} </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: 260, backgroundColor: '#fff', borderRightWidth: 1, borderRightColor: '#e6eef6' },
  containerCollapsed: { width: 72 },
  logoContainer: { height: 60, backgroundColor: '#003e70', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20 },
  hamburger: { marginRight: 16 },
  logoText: { fontWeight: '800', color: '#ffffff', fontSize: 18 },
  menuList: { marginTop: 12, paddingHorizontal: 8, flex: 1 },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 6, gap: 10 },
  menuLabel: { marginLeft: 10, fontWeight: '600', color: '#0f172a', flex: 1 },
  subMenu: { paddingLeft: 36, paddingBottom: 6 },
  subMenuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 8 },
  subMenuLabel: { fontSize: 13, color: '#475569', fontWeight: '500', flex: 1 },
  badge: { backgroundColor: '#ef4444', paddingHorizontal: 6, borderRadius: 12, marginLeft: 'auto' },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  collapseBtn: { marginTop: 'auto', padding: 8, alignItems: 'center' },
  collapseText: { color: '#64748b' },
});
