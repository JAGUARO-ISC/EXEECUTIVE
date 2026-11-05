import { beforeEach, describe, expect, it, vi } from 'vitest';

const invoke = vi.hoisted(() => vi.fn());
const userState = vi.hoisted(() => ({ user: { id: 'user-1', email: 'user@example.com', displayName: 'User' }, logout: vi.fn() }));
const deviceApi = vi.hoisted(() => ({
  select: vi.fn(),
  upsert: vi.fn(),
  update: vi.fn(),
  eq: vi.fn(),
  order: vi.fn(),
  single: vi.fn(),
}));
const supabase = vi.hoisted(() => ({ from: vi.fn(() => deviceApi) }));

vi.mock('@tauri-apps/api/core', () => ({ invoke }));
vi.mock('./auth', () => ({ useAuth: { getState: () => userState } }));
vi.mock('../lib/supabase', () => ({ supabase }));

import { useDeviceStore } from './devices';

const currentDevice = {
  id: 'device-1',
  user_id: 'user-1',
  device_name: 'Office PC',
  device_key: 'stable-key-1',
  status: 'approved',
  is_primary: true,
  created_at: '2026-11-05T10:00:00Z',
  last_seen_at: '2026-11-05T10:00:00Z',
  revoked_at: null,
};

function resetStore() {
  useDeviceStore.setState({ current: null, devices: [], loaded: false, loading: false, error: null });
}

function queryResult(data: unknown) {
  deviceApi.select.mockReturnValue(deviceApi);
  deviceApi.order.mockResolvedValue({ data, error: null });
  deviceApi.upsert.mockResolvedValue({ data, error: null });
  deviceApi.single.mockResolvedValue({ data, error: null });
  deviceApi.update.mockReturnValue(deviceApi);
  deviceApi.eq.mockReturnValue(deviceApi);
  deviceApi.eq.mockResolvedValue({ data, error: null });
}

describe('useDeviceStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
    invoke.mockImplementation(async (command: string) => {
      if (command === 'get_device_identity') return 'stable-key-1';
      if (command === 'get_device_name') return 'Office PC';
      if (command === 'reset_device_identity') return undefined;
      throw new Error(`unexpected command: ${command}`);
    });
    queryResult([currentDevice]);
  });

  it('registers the first device and preserves primary approval', async () => {
    await useDeviceStore.getState().register();

    expect(supabase.from).toHaveBeenCalledWith('devices');
    expect(deviceApi.upsert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: 'user-1',
      device_key: 'stable-key-1',
      device_name: 'Office PC',
    }), { onConflict: 'user_id,device_key' });
    expect(useDeviceStore.getState().isApproved()).toBe(true);
    expect(useDeviceStore.getState().current?.is_primary).toBe(true);
  });

  it('keeps a second device pending until a primary approves it', async () => {
    const pending = { ...currentDevice, id: 'device-2', device_key: 'stable-key-2', status: 'pending', is_primary: false };
    queryResult([pending]);
    invoke.mockImplementation(async (command: string) => command === 'get_device_identity' ? 'stable-key-2' : 'Laptop');

    await useDeviceStore.getState().register();

    expect(useDeviceStore.getState().isApproved()).toBe(false);
    expect(useDeviceStore.getState().current?.status).toBe('pending');
  });

  it('allows a primary device to approve a pending device', async () => {
    useDeviceStore.setState({ current: currentDevice });
    await useDeviceStore.getState().approve('device-2');

    expect(deviceApi.update).toHaveBeenCalledWith({ status: 'approved', revoked_at: null });
    expect(deviceApi.eq).toHaveBeenCalledWith('id', 'device-2');
  });

  it('revokes a device and reports revoked current devices as not approved', async () => {
    useDeviceStore.setState({ current: currentDevice });
    await useDeviceStore.getState().revoke('device-2');

    expect(deviceApi.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'revoked' }));
    useDeviceStore.setState({ current: { ...currentDevice, status: 'revoked', revoked_at: '2026-11-05T11:00:00Z' } });
    expect(useDeviceStore.getState().isApproved()).toBe(false);
  });

  it('resets local identity through the Tauri app-data command', async () => {
    await useDeviceStore.getState().resetLocalDevice();

    expect(invoke).toHaveBeenCalledWith('reset_device_identity');
    expect(useDeviceStore.getState().current).toBeNull();
  });
});
