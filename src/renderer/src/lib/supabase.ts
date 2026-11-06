import { runtimeConfig } from './runtimeConfig';
import { errorMessage } from '../utils/errorMessage';

export type SupabaseUser = {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
};

export type SupabaseSession = {
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
  user: SupabaseUser;
};

type AuthChangeCallback = (event: string, session: SupabaseSession | null) => void;
type AuthResponse<T> = { data: T; error: null } | { data: null; error: { message: string } };

type QueryResult<T> = PromiseLike<{ data: T | null; error: { message: string } | null }>;

type DeviceQuery = {
  select: (columns?: string) => DeviceQuery;
  order: (column: string, options?: { ascending?: boolean }) => QueryResult<unknown[]>;
  upsert: (values: Record<string, unknown> | Record<string, unknown>[], options?: { onConflict?: string }) => QueryResult<unknown>;
  update: (values: Record<string, unknown>) => DeviceQuery;
  eq: (column: string, value: string) => DeviceQuery & QueryResult<unknown>;
  gt: (column: string, value: string) => DeviceQuery;
  then: PromiseLike<unknown>['then'];
};

const SESSION_KEY = 'exec_supabase_session';
const SESSION_ONLY_KEY = 'exec_supabase_session_tab';
let persistentSession = false;

export const setSessionPersistence = (remember: boolean): void => { persistentSession = remember; };

export const hasPersistentSession = (): boolean => {
  try { return !!localStorage.getItem(SESSION_KEY); } catch { return false; }
};

const createClient = (url: string, anonKey: string) => {
  let callback: AuthChangeCallback | null = null;

  const readSession = (): SupabaseSession | null => {
    try {
      const raw = (persistentSession ? localStorage : sessionStorage).getItem(persistentSession ? SESSION_KEY : SESSION_ONLY_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as SupabaseSession;
    } catch {
      (persistentSession ? localStorage : sessionStorage).removeItem(persistentSession ? SESSION_KEY : SESSION_ONLY_KEY);
      return null;
    }
  };

  const writeSession = (session: SupabaseSession | null): void => {
    const storage = persistentSession ? localStorage : sessionStorage;
    const key = persistentSession ? SESSION_KEY : SESSION_ONLY_KEY;
    if (session) storage.setItem(key, JSON.stringify(session));
    else storage.removeItem(key);
    callback?.(session ? 'SIGNED_IN' : 'SIGNED_OUT', session);
  };

  const request = async <T>(path: string, body?: unknown, token?: string): Promise<AuthResponse<T>> => {
    try {
      const response = await fetch(`${url}${path}`, {
        method: 'POST',
        headers: {
          apikey: anonKey,
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const payload = await response.json().catch(() => ({})) as { error_description?: string; msg?: string; message?: string } & T;
      if (!response.ok) return { data: null, error: { message: payload.error_description ?? payload.msg ?? payload.message ?? `HTTP ${response.status}` } };
      return { data: payload as T, error: null };
    } catch (error) {
      return { data: null, error: { message: errorMessage(error) } };
    }
  };

  const from = (table: string): DeviceQuery => {
    let method = 'GET';
    let body: unknown;
    let columns = '*';
    let orderBy = '';
    const filters: string[] = [];
    const query: DeviceQuery = {
      select: (selected = '*') => { columns = selected; return query; },
      order: (column, options = {}) => {
        orderBy = `&order=${encodeURIComponent(column)}.${options.ascending === false ? 'desc' : 'asc'}`;
        return run() as QueryResult<unknown[]>;
      },
      upsert: (values, options = {}) => {
        method = 'POST'; body = values;
        return run(options.onConflict ? `&on_conflict=${encodeURIComponent(options.onConflict)}` : '') as QueryResult<unknown>;
      },
      update: (values) => { method = 'PATCH'; body = values; return query; },
      eq: (column, value) => { filters.push(`${encodeURIComponent(column)}=eq.${encodeURIComponent(value)}`); return query as DeviceQuery & QueryResult<unknown>; },
      gt: (column, value) => { filters.push(`${encodeURIComponent(column)}=gt.${encodeURIComponent(value)}`); return query; },
      then: (...args) => run().then(...args),
    };
    const run = async (extra = '') => {
      const session = readSession();
      const suffix = `?select=${encodeURIComponent(columns)}${orderBy}${filters.length ? `&${filters.join('&')}` : ''}${extra}`;
      try {
        const response = await fetch(`${url}/rest/v1/${table}${suffix}`, {
          method,
          headers: { apikey: anonKey, Authorization: `Bearer ${session?.access_token ?? anonKey}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
          body: body === undefined ? undefined : JSON.stringify(body),
        });
        const data = await response.json().catch(() => null);
        return response.ok ? { data, error: null } : { data: null, error: { message: data?.message ?? `HTTP ${response.status}` } };
      } catch (error) {
        return { data: null, error: { message: errorMessage(error) } };
      }
    };
    return query;
  };

  return {
    from,
    auth: {
      getSession: async () => ({ data: { session: readSession() }, error: null }),
      onAuthStateChange: (next: AuthChangeCallback) => {
        callback = next;
        return { data: { subscription: { unsubscribe: () => { callback = null; } } } };
      },
      signInWithPassword: async ({ email, password }: { email: string; password: string }) => {
        const result = await request<SupabaseSession>('/auth/v1/token?grant_type=password', { email, password });
        if (result.error) return result;
        writeSession(result.data);
        return { data: { session: result.data, user: result.data.user }, error: null };
      },
      signUp: async ({ email, password, options }: { email: string; password: string; options?: { data?: Record<string, unknown> } }) => {
        const result = await request<SupabaseSession>('/auth/v1/signup', { email, password, data: options?.data });
        if (result.error) return result;
        if (result.data?.access_token) writeSession(result.data);
        return { data: { session: result.data?.access_token ? result.data : null, user: result.data?.user ?? null }, error: null };
      },
      resetPasswordForEmail: (email: string) => request<Record<string, never>>('/auth/v1/recover', { email }),
      resend: (options: { type: 'signup'; email: string }) => request<Record<string, never>>('/auth/v1/resend', options),
      signOut: async () => {
        const session = readSession();
        const result = await request<Record<string, never>>('/auth/v1/logout', undefined, session?.access_token);
        writeSession(null);
        return result;
      },
    },
  };
};

export const supabaseConfigured = runtimeConfig.hasSupabaseConfig;
export const supabase = supabaseConfigured
  ? createClient(runtimeConfig.supabaseUrl, runtimeConfig.supabaseAnonKey)
  : null;
