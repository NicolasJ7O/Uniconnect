import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Platform } from 'react-native';
import { loadSession, type SessionUser } from '@/lib/session';
import { useNotifications } from '@/context/NotificationContext';

export type NavItem = {
  key: string;
  label: string;
  icon?: string;
  route?: string;
  adminOnly?: boolean;
  action?: () => void;
};

type NavContextType = {
  menuItems: NavItem[];
  collapsed: boolean;
  toggleCollapse: () => void;
  mobileOpen: boolean;
  openMobile: () => void;
  closeMobile: () => void;
  user: SessionUser | null;
};

const NavContext = createContext<NavContextType | undefined>(undefined);

export const NavProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      if (Platform.OS === 'web') return localStorage.getItem('nav.collapsed') === 'true';
    } catch (e) {}
    return false;
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const { unreadCount, setModalVisible } = useNotifications() as any;

  useEffect(() => {
    (async () => {
      const session = await loadSession();
      if (session) setUser(session.user);
    })();
    // sync collapsed across tabs
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const onStorage = (ev: StorageEvent) => {
        if (ev.key === 'nav.collapsed') setCollapsed(ev.newValue === 'true');
      };
      window.addEventListener('storage', onStorage);
      return () => window.removeEventListener('storage', onStorage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      if (Platform.OS === 'web') localStorage.setItem('nav.collapsed', String(collapsed));
    } catch (e) {}
  }, [collapsed]);

  const toggleCollapse = useCallback(() => setCollapsed((v) => !v), []);
  const openMobile = useCallback(() => setMobileOpen(true), []);
  const closeMobile = useCallback(() => setMobileOpen(false), []);

  const baseItems: NavItem[] = [
    { key: 'dashboard', label: 'Dashboard', icon: 'house.fill', route: '/dashboard' },
    { key: 'chatbot', label: 'Chatbot UniConnect', icon: 'sparkles', route: '/assistant' },
    { key: 'study-groups', label: 'Grupos de estudio', icon: 'person.3.fill', route: '/study-groups' },
    { key: 'group-chats', label: 'Chats grupales', icon: 'bubble.left.and.bubble.right.fill', route: '/study-group-chat' },
    { key: 'private-messages', label: 'Mensajes privados', icon: 'envelope.fill', route: '/private-chat' },
    { key: 'events', label: 'Eventos universitarios', icon: 'calendar', route: '/events' },
    { key: 'study-sessions', label: 'Sesiones de estudio', icon: 'clock.fill', route: '/study-sessions' },
    { key: 'polls', label: 'Encuestas', icon: 'chart.bar.fill', route: '/study-groups' },
    { key: 'library', label: 'Biblioteca', icon: 'book.fill', route: '/subject-library' },
    { key: 'profiles', label: 'Explorador de perfiles', icon: 'person.crop.circle', route: '/student-search' },
    { key: 'notifications', label: 'Notificaciones', icon: 'bell.fill', action: () => (setModalVisible ? setModalVisible(true) : null) },
    { key: 'my-events', label: 'Mis eventos', icon: 'bookmark.fill', route: '/events' },
    { key: 'my-groups', label: 'Mis grupos', icon: 'person.crop.circle.badge.checkmark', route: '/study-groups' },
    { key: 'settings', label: 'Configuración', icon: 'gear', route: '/profile-edit' },
    { key: 'profile', label: 'Perfil del estudiante', icon: 'person.fill', route: '/profile-edit' },
  ];

  const adminItems: NavItem[] = [
    { key: 'admin-panel', label: 'Panel administrativo', icon: 'shield.fill', route: '/admin' },
    { key: 'categories', label: 'Gestión de categorías', icon: 'tag.fill', route: '/admin/categories' },
    { key: 'logs', label: 'Logs del sistema', icon: 'doc.text.fill', route: '/admin/logs' },
    { key: 'chatbot-feedback', label: 'Feedback del chatbot', icon: 'message.fill', route: '/admin/assistant-feedback' },
    { key: 'moderation', label: 'Moderación', icon: 'exclamationmark.triangle.fill', route: '/admin/moderation' },
    { key: 'metrics', label: 'Métricas RAG', icon: 'chart.pie.fill', route: '/admin/metrics' },
    { key: 'audit', label: 'Auditoría', icon: 'calendar.badge.clock', route: '/admin/audit' },
  ];

  const menuItems = user && user.role === 'super_admin' ? [...baseItems, ...adminItems] : baseItems;

  return (
    <NavContext.Provider value={{ menuItems, collapsed, toggleCollapse, mobileOpen, openMobile, closeMobile, user }}>
      {children}
    </NavContext.Provider>
  );
};

export const useNav = () => {
  const ctx = useContext(NavContext);
  if (!ctx) throw new Error('useNav must be used within NavProvider');
  return ctx;
};

export default NavProvider;
