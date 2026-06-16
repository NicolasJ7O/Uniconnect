import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Image, View, Pressable, Text, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/useColorScheme';
import ErrorBoundary from '@/components/ErrorBoundary';
import { ToastProvider } from '@/components/Toast';
import { NotificationProvider, useNotifications } from '@/context/NotificationContext';
import { IconSymbol } from '@/components/ui/IconSymbol';
import NotificationModal from '@/components/NotificationModal';
import { NavProvider } from '@/components/navigation/NavProvider';
import HeaderLeft from '@/components/navigation/HeaderLeft';
import GlobalNav from '@/components/navigation/GlobalNav';

function HeaderRight() {
  const { unreadCount, setModalVisible } = useNotifications();

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <Pressable 
        onPress={() => setModalVisible(true)} 
        style={{ marginRight: 16, position: 'relative' }}
      >
        {/* @ts-ignore */}
        <IconSymbol name="bell.fill" size={24} color="#ffffff" />
        {unreadCount > 0 && (
          <View style={styles.headerBadgeContainer}>
            <Text style={styles.headerBadgeCount}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
          </View>
        )}
      </Pressable>
      <Image
        source={require('../assets/images/LogoUC.png')}
        style={{ width: 36, height: 36, marginLeft: 0, marginRight: 12, borderRadius: 8 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  headerBadgeContainer: {
    position: 'absolute',
    top: -6,
    right: -8,
    backgroundColor: '#ef4444',
    borderRadius: 12,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#003e70',
    paddingHorizontal: 4,
  },
  headerBadgeCount: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
});

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= 900;

  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  if (!loaded) {
    // Async font loading only occurs in development.      
    return null;
  }

  return (
    <ErrorBoundary>
      <ToastProvider>
        <NotificationProvider>
          <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
            <NavProvider>
              <View style={{ flex: 1, flexDirection: isDesktop ? 'row' : 'column' }}>
                <GlobalNav />
                <View style={{ flex: 1, overflow: 'hidden' }}>
                  <Stack
                    screenOptions={{
                      headerStyle: { backgroundColor: '#003e70', height: 60 },
                      headerTintColor: '#fff',
                      headerTitleStyle: { fontWeight: 'bold' },
                      headerLeft: () => <HeaderLeft />,
                      headerRight: () => <HeaderRight />,
                    }}
                  >
                  <Stack.Screen name="index" options={{ headerShown: false }} />
                  <Stack.Screen name="signup" options={{ title: 'Sign Up' }} />
                  <Stack.Screen name="dashboard" options={{ title: 'Dashboard' }} />
                  <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                  <Stack.Screen name="profile-edit" options={{ title: 'Editar Perfil' }} />
                  <Stack.Screen name="events" options={{ title: 'Eventos Universitarios' }} />
                  <Stack.Screen name="study-sessions" options={{ title: 'Sesiones de Estudio' }} />
                  <Stack.Screen name="assistant" options={{ title: 'Chatbot UniConnect' }} />
                  <Stack.Screen name="subject-forum" options={{ title: 'Foro de Materia' }} />
                  <Stack.Screen name="subject-library" options={{ title: 'Biblioteca' }} />
                  <Stack.Screen name="private-chat" options={{ title: 'Mensajes Privados' }} />
                  <Stack.Screen name="student-search" options={{ title: 'Explorador de perfiles' }} />
                  </Stack>
                </View>
              </View>
            </NavProvider>
            <StatusBar style="auto" />
            <NotificationModal />
          </ThemeProvider>
        </NotificationProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}
