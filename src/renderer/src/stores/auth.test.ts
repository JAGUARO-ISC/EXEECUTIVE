import { beforeEach, describe, expect, it, vi } from 'vitest';

const authApi = vi.hoisted(() => {
  const api = {
    getSession: vi.fn(),
    onAuthStateChange: vi.fn(),
    signInWithPassword: vi.fn(),
    signUp: vi.fn(),
    resetPasswordForEmail: vi.fn(),
    resend: vi.fn(),
    signOut: vi.fn(),
  };
  return { ...api, auth: api };
});
const supabaseConfig = vi.hoisted(() => ({ configured: true }));

vi.mock('../lib/supabase', () => ({
  supabase: authApi,
  setSessionPersistence: vi.fn(),
  hasPersistentSession: vi.fn(() => false),
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
const sessionStorageMock = { ...localStorageMock };
vi.stubGlobal('localStorage', localStorageMock);
vi.stubGlobal('sessionStorage', sessionStorageMock);

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

  it('clears persistent and tab sessions on logout', async () => {
    authApi.signOut.mockResolvedValue({ error: null });
    localStorage.setItem('exec_supabase_session', '{"access_token":"persistent"}');
    sessionStorage.setItem('exec_supabase_session_tab', '{"access_token":"tab"}');
    useAuth.setState({ user: { id: 'user-1', email: 'user@example.com', displayName: 'User' }, session: { access_token: 'token' } as never, loaded: true, pendingError: null });

    await useAuth.getState().logout();

    expect(authApi.signOut).toHaveBeenCalledOnce();
    expect(invoke).toHaveBeenCalledWith('clear_session_state');
    expect(useAuth.getState().user).toBeNull();
    expect(useAuth.getState().session).toBeNull();
    expect(localStorage.getItem('exec_supabase_session')).toBeNull();
    expect(sessionStorage.getItem('exec_supabase_session_tab')).toBeNull();
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

  it('normalizes object-shaped errors without rendering object stringification', async () => {
    authApi.signInWithPassword.mockResolvedValue({ error: { code: 'invalid' } });

    const result = await useAuth.getState().login('user@example.com', 'password');

    expect(result).toBe('Authentication failed.');
    expect(result).not.toContain('[object Object]');
  });

  it('resends confirmation and enforces a 60-second cooldown', async () => {
    authApi.resend.mockResolvedValue({ data: {}, error: null });
    const now = vi.spyOn(Date, 'now').mockReturnValue(1_000);

    expect(await useAuth.getState().resendConfirmation('user@example.com')).toBeNull();
    expect(authApi.resend).toHaveBeenCalledWith({ type: 'signup', email: 'user@example.com' });
    expect(useAuth.getState().resendAvailableAt).toBe(61_000);
    expect(await useAuth.getState().resendConfirmation('user@example.com')).toBe('Please wait before requesting another email.');
    expect(authApi.resend).toHaveBeenCalledOnce();
    now.mockRestore();
  });

  it('enters confirmation flow when signup requires email verification', async () => {
    authApi.signUp.mockResolvedValue({ data: { session: null, user: null }, error: null });

    const result = await useAuth.getState().register('user@example.com', 'password', 'Mario', 'Rossi', false);

    expect(result).toBeNull();
  });

  it('validates registration names', async () => {
    const result = await useAuth.getState().register('user@example.com', 'password', '', 'Rossi', false);

    expect(result).toBe('First name and last name are required.');
    expect(authApi.signUp).not.toHaveBeenCalled();
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
