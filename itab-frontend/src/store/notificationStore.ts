import { create } from 'zustand';
import type { Notification } from '../types';
import { notificationsApi } from '../lib/api';
import { apiSend } from '../lib/apiCall';

interface NotificationStore {
  notifications: Notification[];
  unreadCount: number;
  addNotification: (n: Notification) => void;
  markRead:        (id: string) => void;
  markAllRead:     () => void;
  setNotifications:(ns: Notification[]) => void;
}

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  notifications: [],
  unreadCount: 0,

  addNotification: (n) => {
    set(s => ({
      notifications: [n, ...s.notifications].slice(0, 50),
      unreadCount: s.unreadCount + (n.isRead ? 0 : 1),
    }));
  },

  markRead: (id) => {
    const n = get().notifications.find(x => x.id === id);
    if (!n || n.isRead) return;
    set(s => ({
      notifications: s.notifications.map(x => x.id === id ? { ...x, isRead: true } : x),
      unreadCount: Math.max(0, s.unreadCount - 1),
    }));
    // Sync to backend (fire-and-forget)
    apiSend(() => notificationsApi.markRead(id));
  },

  markAllRead: () => {
    set(s => ({
      notifications: s.notifications.map(n => ({ ...n, isRead: true })),
      unreadCount: 0,
    }));
    apiSend(() => notificationsApi.markAllRead());
  },

  setNotifications: (ns) => {
    set({
      notifications: ns,
      unreadCount: ns.filter(n => !n.isRead).length,
    });
  },
}));
