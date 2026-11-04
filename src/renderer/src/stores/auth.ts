import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';

export interface AuthUser {
  id: number;
  email: string;
  displayName: string;
}

interface AuthStore {
  user: AuthUser | null;
  loaded: boolean;
  load: () => Promise<void>;
  login: (email: string, password: string) => Promise<string | null>;
  register: (email: string, password: string, displayName: string) => Promise<string | null>;
  logout: () => void;
}

const SESSION_KEY = 'exec_user_id';

export const useAuth = create<AuthStore>((set) => ({
  user: null,
  loaded: false,

  load: async () => {
    try {
      const id = localStorage.getItem(SESSION_KEY);
      if (!id) { set({ loaded: true }); return; }
      const user = await invoke<AuthUser>('get_current_user', { userId: Number(id) });
      set({ user, loaded: true });
    } catch {
      localStorage.removeItem(SESSION_KEY);
      set({ loaded: true });
    }
  },

  login: async (email, password) => {
    try {
      const user = await invoke<AuthUser>('login', { email, password });
      localStorage.setItem(SESSION_KEY, String(user.id));
      set({ user });
      return null;
    } catch (e) {
      return String(e);
    }
  },

  register: async (email, password, displayName) => {
    try {
      const user = await invoke<AuthUser>('register', { email, password, displayName });
      localStorage.setItem(SESSION_KEY, String(user.id));
      set({ user });
      return null;
    } catch (e) {
      return String(e);
    }
  },

  logout: () => {
    localStorage.removeItem(SESSION_KEY);
    set({ user: null });
  },
}));
