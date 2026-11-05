import { beforeEach, describe, expect, it, vi } from 'vitest';

const authApi = vi.hoisted(() => {
  const api = {
    getSession: vi.fn(),
    onAuthStateChange: vi.fn(),
    signInWithPassword: vi.fn(),
    signUp: vi.fn(),
    resetPasswordForEmail: vi.fn(),
    signOut: vi.fn(),
  };
  return { ...api, auth: api };
});
const supabaseConfig = vi.hoisted(() => ({ configured: true }));

vi.mock('../lib/supabase', () => ({
  supabase: authApi,
  get supabaseConfigured() { return supabaseConfig.configured; },
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

import { invoke } from '@tauri-apps/api/core';
import { useAuth } from './auth';

const storage = new Map<string, string>();
const localStorageMock = {
  clear: () => storage.clear(),
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
  removeItem: (key: string) => storage.delete(key),
};
vi.stubGlobal('localStorage', localStorageMock);

const resetStore = () => {
  useAuth.setState({ user: null, session: null, loaded: false, pendingError: null });
};

describe('useAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabaseConfig.configured = true;
    localStorage.clear();
    resetStore();
    authApi.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
  });

  it('loads a Supabase session and exposes its user metadata', async () => {
    const session = { access_token: 'token', user: { id: 'user-1', email: 'user@example.com', user_metadata: { display_name: 'User' } } };
    authApi.getSession.mockResolvedValue({ data: { session }, error: null });

    await useAuth.getState().load();

    expect(useAuth.getState().session).toEqual(session);
    expect(useAuth.getState().user).toEqual({ id: 'user-1', email: 'user@example.com', displayName: 'User' });
    expect(useAuth.getState().loaded).toBe(true);
  });

  it('clears session and local sync state on logout', async () => {
    authApi.signOut.mockResolvedValue({ error: null });
    useAuth.setState({ user: { id: 'user-1', email: 'user@example.com', displayName: 'User' }, session: { access_token: 'token' } as never, loaded: true, pendingError: null });

    await useAuth.getState().logout();

    expect(authApi.signOut).toHaveBeenCalledOnce();
    expect(invoke).toHaveBeenCalledWith('clear_session_state');
    expect(useAuth.getState().user).toBeNull();
    expect(useAuth.getState().session).toBeNull();
  });

  it('clears malformed stored session and reports loaded state', async () => {
    localStorage.setItem('exec_supabase_user_metadata', '{bad json');
    authApi.getSession.mockResolvedValue({ data: { session: null }, error: null });

    await useAuth.getState().load();

    expect(localStorage.getItem('exec_supabase_session')).toBeNull();
    expect(useAuth.getState().loaded).toBe(true);
    expect(useAuth.getState().pendingError).toBeNull();
  });

  it('returns recovery errors without claiming success', async () => {
    authApi.resetPasswordForEmail.mockResolvedValue({ error: { message: 'SMTP is not configured' } });

    const result = await useAuth.getState().requestRecovery('user@example.com');

    expect(result).toBe('SMTP is not configured');
    expect(useAuth.getState().pendingError).toBe('SMTP is not configured');
  });
});

describe('useAuth without Supabase configuration', () => {
  it('reports missing configuration without calling cloud auth', async () => {
    supabaseConfig.configured = false;

    const result = await useAuth.getState().login('user@example.com', 'password');

    expect(result).toContain('Supabase configuration');
    expect(authApi.signInWithPassword).not.toHaveBeenCalled();
    expect(useAuth.getState().loaded).toBe(true);
  });
});
