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
  children?: NavItem[];
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

import { chatApi, type Conversation } from '@/lib/chat-api';
import { getStudentProfile } from '@/lib/student-api';

export const NavProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [privateChats, setPrivateChats] = useState<Conversation[]>([]);
  const [subjects, setSubjects] = useState<{id: string, name: string}[]>([]);
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
      if (session) {
        setUser(session.user);
        try {
          // Fetch dynamic data for submenus
          const [chats, profile] = await Promise.all([
            chatApi.getConversations(),
            getStudentProfile()
          ]);
          setPrivateChats(chats);
          setSubjects(profile.subjects.map(s => ({ id: s.id, name: s.name })));
        } catch (e) {
          console.error('Error fetching submenu data', e);
        }
      }
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
    { 
      key: 'private-messages', 
      label: 'Mensajes privados', 
      icon: 'envelope.fill', 
      route: '/private-chat',
      children: privateChats.map(chat => ({
        key: `chat-${chat.user.id}`,
        label: chat.user.name,
        icon: 'person.crop.circle',
        route: `/private-chat?id=${chat.user.id}&name=${encodeURIComponent(chat.user.name)}`
      }))
    },
    { key: 'events', label: 'Eventos universitarios', icon: 'calendar', route: '/events' },
    { key: 'study-sessions', label: 'Sesiones de estudio', icon: 'clock.fill', route: '/study-sessions' },
    { 
      key: 'library', 
      label: 'Biblioteca', 
      icon: 'book.fill', 
      route: '/subject-library',
      children: subjects.map(sub => ({
        key: `lib-${sub.id}`,
        label: sub.name,
        icon: 'book.fill',
        route: `/subject-library?subjectId=${sub.id}&subjectName=${encodeURIComponent(sub.name)}`
      }))
    },
    { 
      key: 'forum', 
      label: 'Foro', 
      icon: 'bubble.left.and.bubble.right.fill', 
      route: '/subject-forum',
      children: subjects.map(sub => ({
        key: `forum-${sub.id}`,
        label: sub.name,
        icon: 'bubble.left.and.bubble.right.fill',
        route: `/subject-forum?subjectId=${sub.id}&subjectName=${encodeURIComponent(sub.name)}`
      }))
    },
    { key: 'profiles', label: 'Explorador de perfiles', icon: 'person.crop.circle', route: '/student-search' },
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
