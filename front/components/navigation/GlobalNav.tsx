import React from 'react';
import { View, StyleSheet, Platform, useWindowDimensions, Pressable, Text } from 'react-native';
import Sidebar from './Sidebar';
import MobileMenu from './MobileMenu';
import { useNav } from './NavProvider';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { router } from 'expo-router';

export default function GlobalNav() {
  const { width } = useWindowDimensions();
  const { mobileOpen, openMobile, closeMobile } = useNav();

  const isDesktop = Platform.OS === 'web' && width >= 900;

  return (
    <>
      <MobileMenu />

      {!isDesktop && (
        <>
          <View style={styles.bottomNav} pointerEvents="box-none">
            <Pressable style={styles.navBtn} onPress={() => router.push('/dashboard')}>
              {/* @ts-ignore */}
              <IconSymbol name="house.fill" size={24} color="#fff" />
              <Text style={styles.btnLabel}>Inicio</Text>
            </Pressable>
            <Pressable style={styles.navBtn} onPress={() => router.push('/student-search' as any)}>
              {/* @ts-ignore */}
              <IconSymbol name="person.crop.circle" size={24} color="#fff" />
              <Text style={styles.btnLabel}>Perfiles</Text>
            </Pressable>
            <Pressable style={styles.navBtn} onPress={openMobile}>
              {/* @ts-ignore */}
              <IconSymbol name="list.bullet" size={24} color="#fff" />
              <Text style={styles.btnLabel}>Menú</Text>
            </Pressable>
          </View>
        </>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  sidebarWrapper: { zIndex: 40, borderRightWidth: 1, borderRightColor: '#e6eef6' },
  bottomNav: { position: 'absolute', left: 0, right: 0, bottom: 12, height: 64, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', zIndex: 50 },
  navBtn: { backgroundColor: '#003e70', padding: 10, borderRadius: 12, alignItems: 'center', width: 100 },
  btnLabel: { color: '#fff', fontWeight: '700', marginTop: 4 },
});
