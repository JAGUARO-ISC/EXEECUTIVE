import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { hasPersistentSession, setSessionPersistence, supabase, supabaseConfigured, type SupabaseSession, type SupabaseUser } from '../lib/supabase';

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
}

interface AuthStore {
  user: AuthUser | null;
  session: SupabaseSession | null;
  loaded: boolean;
  pendingError: string | null;
  resendAvailableAt: number;
  load: () => Promise<void>;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<string | null>;
  register: (email: string, password: string, firstName: string, lastName?: string, rememberMe?: boolean) => Promise<string | null>;
  resendConfirmation: (email: string) => Promise<string | null>;
  requestRecovery: (email: string) => Promise<string | null>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const SESSION_METADATA_KEY = 'exec_supabase_user_metadata';
const CONFIG_ERROR = 'Supabase configuration is missing or invalid.';

export const errorMessage = (error: unknown): string => {
  if (typeof error === 'string' && error.trim()) return error;
  if (error instanceof Error && error.message.trim()) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return 'Authentication failed.';
};

const RESEND_COOLDOWN_MS = 60_000;
const resendKey = (email: string) => `exec_resend_available_at:${email.trim().toLowerCase()}`;

const rememberSession = (rememberMe: boolean): void => {
  try {
    setSessionPersistence(rememberMe);
    localStorage.setItem('exec_remember_me', rememberMe ? '1' : '0');
    if (!rememberMe) localStorage.removeItem('exec_supabase_session');
  } catch {
    // Storage can be unavailable in restricted windows.
  }
};

const toAuthUser = (user: SupabaseUser | null): AuthUser | null => user
  ? {
      id: user.id,
      email: user.email ?? '',
      displayName: String(user.user_metadata?.display_name ?? user.user_metadata?.full_name ?? user.email ?? ''),
    }
  : null;

const saveMetadata = (user: AuthUser | null): void => {
  try {
    if (!user) {
      localStorage.removeItem(SESSION_METADATA_KEY);
      return;
    }
    localStorage.setItem(SESSION_METADATA_KEY, JSON.stringify(user));
  } catch {
    // Browser storage can be unavailable in private or restricted windows.
  }
};

const clearLocalMetadata = (): void => {
  try {
    localStorage.removeItem(SESSION_METADATA_KEY);
    localStorage.removeItem('exec_supabase_session');
    sessionStorage.removeItem('exec_supabase_session_tab');
  } catch {
    // Browser storage can be unavailable in private or restricted windows.
  }
};

const clearMalformedMetadata = (): void => {
  try {
    const raw = localStorage.getItem(SESSION_METADATA_KEY);
    if (!raw) return;
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed !== 'object' || parsed === null ||
      typeof (parsed as { id?: unknown }).id !== 'string' ||
      typeof (parsed as { email?: unknown }).email !== 'string'
    ) {
      localStorage.removeItem(SESSION_METADATA_KEY);
    }
  } catch {
    clearLocalMetadata();
  }
};

const applySession = (session: SupabaseSession | null, set: (state: Partial<AuthStore>) => void): void => {
  const user = toAuthUser(session?.user ?? null);
  saveMetadata(user);
  set({ session, user, pendingError: null });
};

export const useAuth = create<AuthStore>((set) => ({
  user: null,
  session: null,
  loaded: false,
  pendingError: null,
  resendAvailableAt: 0,

  load: async () => {
    clearMalformedMetadata();
    try {
      const preference = localStorage.getItem('exec_remember_me');
      setSessionPersistence(preference === '1' || (preference === null && hasPersistentSession()));
    } catch { setSessionPersistence(false); }
    if (!supabaseConfigured || !supabase) {
      set({ loaded: true, pendingError: CONFIG_ERROR });
      return;
    }

    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      applySession(data.session, set);
      supabase.auth.onAuthStateChange((_event, session) => {
        applySession(session, set);
      });
    } catch (error) {
      clearLocalMetadata();
      set({ session: null, user: null, pendingError: errorMessage(error) });
    } finally {
      set({ loaded: true });
    }
  },

  login: async (email, password, rememberMe = false) => {
    if (!supabaseConfigured || !supabase) {
      const message = CONFIG_ERROR;
      set({ loaded: true, pendingError: message });
      return message;
    }
    try {
      rememberSession(rememberMe);
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      rememberSession(rememberMe);
      applySession(data.session, set);
      set({ loaded: true });
      return null;
    } catch (error) {
      const message = errorMessage(error);
      set({ pendingError: message, loaded: true });
      return message;
    }
  },

  register: async (email, password, firstName, lastName = '', rememberMe = false) => {
    if (!firstName.trim() || !lastName.trim()) {
      const message = 'First name and last name are required.';
      set({ pendingError: message, loaded: true });
      return message;
    }
    if (!supabaseConfigured || !supabase) {
      const message = CONFIG_ERROR;
      set({ loaded: true, pendingError: message });
      return message;
    }
    try {
      rememberSession(rememberMe);
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { first_name: firstName.trim(), last_name: lastName.trim(), display_name: `${firstName.trim()} ${lastName.trim()}` } },
      });
      if (error) throw error;
      rememberSession(rememberMe);
      applySession(data.session, set);
      set({ loaded: true });
      return null;
    } catch (error) {
      const message = errorMessage(error);
      set({ pendingError: message, loaded: true });
      return message;
    }
  },

  resendConfirmation: async (email) => {
    if (!supabaseConfigured || !supabase) return CONFIG_ERROR;
    const key = resendKey(email);
    let availableAt = 0;
    try { availableAt = Number(localStorage.getItem(key) ?? 0); } catch { /* ignore */ }
    if (Date.now() < availableAt) {
      set({ resendAvailableAt: availableAt });
      return 'Please wait before requesting another email.';
    }
    try {
      const { error } = await supabase.auth.resend({ type: 'signup', email: email.trim() });
      if (error) throw error;
      const next = Date.now() + RESEND_COOLDOWN_MS;
      try { localStorage.setItem(key, String(next)); } catch { /* ignore */ }
      set({ resendAvailableAt: next, pendingError: null });
      return null;
    } catch (error) {
      const message = errorMessage(error);
      set({ pendingError: message });
      return message;
    }
  },

  requestRecovery: async (email) => {
    if (!supabaseConfigured || !supabase) {
      const message = CONFIG_ERROR;
      set({ pendingError: message, loaded: true });
      return message;
    }
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
      if (error) throw error;
      set({ pendingError: null });
      return null;
    } catch (error) {
      const message = errorMessage(error);
      set({ pendingError: message });
      return message;
    }
  },

  logout: async () => {
    try {
      if (supabase) await supabase.auth.signOut();
    } catch (error) {
      set({ pendingError: errorMessage(error) });
    } finally {
      clearLocalMetadata();
      await Promise.resolve(invoke('clear_session_state')).catch(() => undefined);
      set({ user: null, session: null, loaded: true });
    }
  },

  refreshSession: async () => {
    if (!supabaseConfigured || !supabase) {
      set({ pendingError: CONFIG_ERROR, loaded: true });
      return;
    }
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      applySession(data.session, set);
      set({ loaded: true });
    } catch (error) {
      clearLocalMetadata();
      set({ user: null, session: null, pendingError: errorMessage(error), loaded: true });
    }
  },
}));

export const authConfigError = CONFIG_ERROR;
