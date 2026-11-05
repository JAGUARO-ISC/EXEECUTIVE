import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSyncEngine, validateSyncChange, type SyncChange, type SyncTransport } from './sync';

const invoke = vi.hoisted(() => vi.fn());
vi.mock('@tauri-apps/api/core', () => ({ invoke }));

const change = (overrides: Partial<SyncChange> = {}): SyncChange => ({
  entityKind: 'task',
  entityId: '42',
  updatedAt: '2026-11-05T12:00:00.000Z',
  deletedAt: null,
  payload: { id: 42, title: 'Focus', status: 'todo' },
  ...overrides,
});

const transport = (overrides: Partial<SyncTransport> = {}): SyncTransport => ({
  upload: vi.fn().mockResolvedValue(undefined),
  download: vi.fn().mockResolvedValue({ changes: [], cursor: null }),
  ...overrides,
});

describe('sync engine', () => {
  beforeEach(() => vi.clearAllMocks());

  it('uploads pending changes and marks them only after server success', async () => {
    invoke.mockImplementation(async (command: string) => {
      if (command === 'sync_get_outbox') return [{ id: 7, ...change() }];
      if (command === 'sync_get_cursor') return null;
      return undefined;
    });
    const cloud = transport();

    const result = await createSyncEngine({ cloud, isApproved: () => true }).syncNow();

    expect(cloud.upload).toHaveBeenCalledWith([{ id: 7, ...change() }]);
    expect(invoke).toHaveBeenCalledWith('sync_mark_uploaded', { ids: [7] });
    expect(result.uploaded).toBe(1);
  });

  it('keeps outbox rows when upload fails so the next run can retry', async () => {
    invoke.mockImplementation(async (command: string) => command === 'sync_get_outbox' ? [{ id: 8, ...change() }] : null);
    const cloud = transport({ upload: vi.fn().mockRejectedValue(new Error('offline')) });

    await expect(createSyncEngine({ cloud, isApproved: () => true }).syncNow()).rejects.toThrow('offline');
    expect(invoke).not.toHaveBeenCalledWith('sync_mark_uploaded', expect.anything());
  });

  it('applies downloaded tombstones and records the new cursor', async () => {
    const tombstone = change({ deletedAt: '2026-11-05T13:00:00.000Z', payload: null });
    invoke.mockImplementation(async (command: string) => {
      if (command === 'sync_get_outbox') return [];
      if (command === 'sync_get_cursor') return '2026-11-05T11:00:00.000Z';
      return undefined;
    });
    const cloud = transport({ download: vi.fn().mockResolvedValue({ changes: [tombstone], cursor: tombstone.deletedAt }) });

    const result = await createSyncEngine({ cloud, isApproved: () => true }).syncNow();

    expect(invoke).toHaveBeenCalledWith('sync_apply_remote', { change: tombstone });
    expect(invoke).toHaveBeenCalledWith('sync_set_cursor', { cursor: tombstone.deletedAt });
    expect(result.downloaded).toBe(1);
  });

  it('rejects malformed payloads before local application', async () => {
    const malformed = change({ payload: { id: 'not-a-number' } });
    invoke.mockImplementation(async (command: string) => command === 'sync_get_outbox' ? [] : null);
    const cloud = transport({ download: vi.fn().mockResolvedValue({ changes: [malformed], cursor: null }) });

    await expect(createSyncEngine({ cloud, isApproved: true }).syncNow()).rejects.toThrow('Invalid sync payload');
    expect(invoke).not.toHaveBeenCalledWith('sync_apply_remote', expect.anything());
  });

  it('does not call cloud while device is pending', async () => {
    const cloud = transport();
    const result = await createSyncEngine({ cloud, isApproved: () => false }).syncNow();

    expect(result).toEqual({ uploaded: 0, downloaded: 0, skipped: true });
    expect(cloud.upload).not.toHaveBeenCalled();
    expect(cloud.download).not.toHaveBeenCalled();
  });

  it('validates entity kinds and tombstone shape', () => {
    expect(() => validateSyncChange(change({ entityKind: 'unknown' as never }))).toThrow('Invalid sync entity kind');
    expect(() => validateSyncChange(change({ payload: null, deletedAt: null }))).toThrow('Invalid sync payload');
    expect(validateSyncChange(change({ payload: null, deletedAt: '2026-11-05T13:00:00.000Z' })).deletedAt).toBeTruthy();
  });

  it('is idempotent when repeated with an empty outbox and unchanged cursor', async () => {
    invoke.mockImplementation(async (command: string) => command === 'sync_get_outbox' ? [] : 'cursor');
    const cloud = transport();
    const engine = createSyncEngine({ cloud, isApproved: true });

    await engine.syncNow();
    await engine.syncNow();

    expect(cloud.upload).not.toHaveBeenCalled();
    expect(cloud.download).toHaveBeenCalledTimes(2);
  });
});
