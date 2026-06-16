import React from 'react';
import { Pressable, Text, useWindowDimensions, Platform } from 'react-native';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useNav } from './NavProvider';

export default function HeaderLeft() {
  const { width } = useWindowDimensions();
  const { openMobile } = useNav();

  // show hamburger on small screens or mobile
  if (Platform.OS === 'web' && width > 900) return null;

  return (
    <Pressable onPress={openMobile} style={{ paddingHorizontal: 12 }}>
      {/* @ts-ignore */}
      <IconSymbol name="list.bullet" size={22} color="#ffffff" />
    </Pressable>
  );
}
