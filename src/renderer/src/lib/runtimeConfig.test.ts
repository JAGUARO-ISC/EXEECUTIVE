import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadRuntimeConfig, reportRuntimeConfig } from './runtimeConfig';

const validUrl = 'https://example.supabase.co';
const validPublishableKey = 'sb_publishable_test-key_123';
const serviceRoleKey = 'service_role_super_secret_value';

const env = (url?: string, key?: string) => ({
  VITE_SUPABASE_URL: url,
  VITE_SUPABASE_ANON_KEY: key,
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('loadRuntimeConfig', () => {
  it('rejects missing configuration', () => {
    expect(loadRuntimeConfig(env())).toMatchObject({ status: 'missing', hasSupabaseConfig: false });
  });

  it('rejects malformed Supabase URLs', () => {
    expect(loadRuntimeConfig(env('not-a-url', validPublishableKey))).toMatchObject({
      status: 'invalid',
      hasSupabaseConfig: false,
    });
    expect(loadRuntimeConfig(env('http://example.supabase.co', validPublishableKey))).toMatchObject({
      status: 'invalid',
      hasSupabaseConfig: false,
    });
  });

  it('accepts valid publishable keys', () => {
    expect(loadRuntimeConfig(env(validUrl, validPublishableKey))).toMatchObject({
      status: 'valid',
      hasSupabaseConfig: true,
      supabaseUrl: validUrl,
      supabaseAnonKey: validPublishableKey,
    });
  });

  it('accepts valid anon JWT keys', () => {
    const payload = btoa(JSON.stringify({ role: 'anon' })).replace(/=/g, '');
    const anonKey = `header.${payload}.signature`;
    expect(loadRuntimeConfig(env(validUrl, anonKey))).toMatchObject({ status: 'valid', hasSupabaseConfig: true });
  });

  it('rejects service-role credentials', () => {
    const result = loadRuntimeConfig(env(validUrl, serviceRoleKey));
    expect(result).toMatchObject({ status: 'invalid', hasSupabaseConfig: false });
    expect(result.supabaseAnonKey).toBe('');

    const payload = btoa(JSON.stringify({ role: 'service_role' })).replace(/=/g, '');
    const serviceRoleJwt = `header.${payload}.signature`;
    expect(loadRuntimeConfig(env(validUrl, serviceRoleJwt))).toMatchObject({
      status: 'invalid',
      hasSupabaseConfig: false,
    });
  });

  it('never logs configuration values', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const invalid = loadRuntimeConfig(env('https://bad.supabase.co', serviceRoleKey));

    reportRuntimeConfig(invalid);

    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0]?.join(' ')).not.toContain(serviceRoleKey);
    expect(warn.mock.calls[0]?.join(' ')).not.toContain('https://bad.supabase.co');
  });
});
