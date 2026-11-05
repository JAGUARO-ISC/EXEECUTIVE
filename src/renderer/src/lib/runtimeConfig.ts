export type RuntimeConfigStatus = 'valid' | 'missing' | 'invalid';

export type RuntimeConfig = {
  supabaseUrl: string;
  supabaseAnonKey: string;
  hasSupabaseConfig: boolean;
  status: RuntimeConfigStatus;
};

type RuntimeEnv = Record<string, unknown>;

const SUPABASE_HOST_PATTERN = /^[a-z0-9][a-z0-9-]*\.supabase\.co$/i;
const PUBLISHABLE_KEY_PATTERN = /^sb_publishable_[A-Za-z0-9_-]+$/;
const JWT_PATTERN = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

function isValidSupabaseUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      SUPABASE_HOST_PATTERN.test(url.hostname) &&
      (url.pathname === '/' || url.pathname === '') &&
      !url.search &&
      !url.hash
    );
  } catch {
    return false;
  }
}

function jwtRole(value: string): string | undefined {
  if (!JWT_PATTERN.test(value)) return undefined;

  try {
    const payload = value.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const decoded = atob(payload.padEnd(Math.ceil(payload.length / 4) * 4, '='));
    const parsed: unknown = JSON.parse(decoded);
    if (typeof parsed === 'object' && parsed !== null && 'role' in parsed) {
      const role = parsed.role;
      return typeof role === 'string' ? role : undefined;
    }
  } catch {
    return undefined;
  }

  return undefined;
}

function isValidSupabaseKey(value: string): boolean {
  if (value.toLowerCase().includes('service_role') || value.startsWith('sb_secret_')) {
    return false;
  }

  if (PUBLISHABLE_KEY_PATTERN.test(value)) return true;

  return jwtRole(value) === 'anon';
}

export function loadRuntimeConfig(env: RuntimeEnv): RuntimeConfig {
  const supabaseUrl = typeof env.VITE_SUPABASE_URL === 'string' ? env.VITE_SUPABASE_URL.trim() : '';
  const candidateKey = typeof env.VITE_SUPABASE_ANON_KEY === 'string' ? env.VITE_SUPABASE_ANON_KEY.trim() : '';

  if (!supabaseUrl || !candidateKey) {
    return {
      supabaseUrl: '',
      supabaseAnonKey: '',
      hasSupabaseConfig: false,
      status: 'missing',
    };
  }

  if (!isValidSupabaseUrl(supabaseUrl) || !isValidSupabaseKey(candidateKey)) {
    return {
      supabaseUrl: '',
      supabaseAnonKey: '',
      hasSupabaseConfig: false,
      status: 'invalid',
    };
  }

  return {
    supabaseUrl,
    supabaseAnonKey: candidateKey,
    hasSupabaseConfig: true,
    status: 'valid',
  };
}

export function reportRuntimeConfig(config: RuntimeConfig): void {
  if (config.status === 'missing') {
    const missing = [
      !config.supabaseUrl && 'VITE_SUPABASE_URL',
      !config.supabaseAnonKey && 'VITE_SUPABASE_ANON_KEY',
    ].filter(Boolean).join(', ');

    console.warn(
      `Supabase configuration incomplete. Missing: ${missing}. Cloud features disabled; local offline mode remains available.`,
    );
  } else if (config.status === 'invalid') {
    console.warn('Supabase configuration invalid. Cloud features disabled; local offline mode remains available.');
  }
}

export const runtimeConfig = loadRuntimeConfig(import.meta.env);
