import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { supabase } from '../lib/supabase';
import { useAuth } from './auth';

export type DeviceStatus = 'pending' | 'approved' | 'revoked';

export interface Device {
  id: string;
  user_id: string;
  device_name: string;
  device_key: string;
  status: DeviceStatus;
  is_primary: boolean;
  created_at: string;
  last_seen_at: string;
  revoked_at: string | null;
}

interface DeviceStore {
  current: Device | null;
  devices: Device[];
  loaded: boolean;
  loading: boolean;
  error: string | null;
  load: () => Promise<void>;
  register: () => Promise<void>;
  approve: (id: string) => Promise<void>;
  revoke: (id: string) => Promise<void>;
  isApproved: () => boolean;
  resetLocalDevice: () => Promise<void>;
}

const deviceTable = () => {
  if (!supabase) throw new Error('Supabase configuration is missing');
  return supabase.from('devices');
};

const currentUserId = (): string => {
  const user = useAuth.getState().user;
  if (!user) throw new Error('Authentication required');
  return String(user.id);
};

const errorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return 'Errore dispositivi. Riprova.';
};

export const useDeviceStore = create<DeviceStore>((set, get) => ({
  current: null,
  devices: [],
  loaded: false,
  loading: false,
  error: null,

  load: async () => {
    set({ loading: true, error: null });
    try {
      const userId = currentUserId();
      const deviceKey = await invoke<string>('get_device_identity');
      const { data, error } = await deviceTable().select('*').order('created_at', { ascending: true });
      if (error) throw error;
      const devices = (data ?? []) as Device[];
      const current = devices.find((device) => device.user_id === userId && device.device_key === deviceKey) ?? null;
      set({ devices, current, loaded: true, loading: false });
      if (current?.status === 'revoked' || current?.revoked_at) await useAuth.getState().logout();
    } catch (error) {
      set({ loaded: true, loading: false, error: errorMessage(error) });
    }
  },

  register: async () => {
    set({ loading: true, error: null });
    try {
      const userId = currentUserId();
      const [deviceKey, deviceName] = await Promise.all([
        invoke<string>('get_device_identity'),
        invoke<string>('get_device_name'),
      ]);
      const { error } = await deviceTable().upsert({
        user_id: userId,
        device_key: deviceKey,
        device_name: deviceName,
        last_seen_at: new Date().toISOString(),
      }, { onConflict: 'user_id,device_key' });
      if (error) throw error;
      await get().load();
    } catch (error) {
      set({ loading: false, error: error instanceof Error ? error.message : String(error) });
    }
  },

  approve: async (id) => {
    const current = get().current;
    if (!current?.is_primary || current.status !== 'approved') throw new Error('Only the primary device can approve devices');
    const result = await deviceTable().update({ status: 'approved', revoked_at: null }).eq('id', id) as unknown as { error: { message: string } | null };
    if (result.error) throw result.error;
    await get().load();
  },

  revoke: async (id) => {
    const current = get().current;
    if (!current?.is_primary || current.status !== 'approved') throw new Error('Only the primary device can revoke devices');
    if (id === current.id) throw new Error('The primary device cannot revoke itself');
    const result = await deviceTable().update({ status: 'revoked', revoked_at: new Date().toISOString() }).eq('id', id) as unknown as { error: { message: string } | null };
    if (result.error) throw result.error;
    await get().load();
  },

  isApproved: () => get().current?.status === 'approved' && !get().current?.revoked_at,

  resetLocalDevice: async () => {
    await invoke('reset_device_identity');
    set({ current: null, devices: [], loaded: false, error: null });
  },
}));
