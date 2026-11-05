import { invoke } from '@tauri-apps/api/core';
import { supabase } from './supabase';

export const SYNC_ENTITY_KINDS = ['appointment', 'task', 'transaction', 'note', 'goal'] as const;
export type SyncEntityKind = typeof SYNC_ENTITY_KINDS[number];

export interface SyncChange {
  id?: number;
  accountId?: string | null;
  deviceId?: string | null;
  entityKind: SyncEntityKind;
  entityId: string;
  updatedAt: string;
  deletedAt: string | null;
  payload: Record<string, unknown> | null;
}

export interface SyncResult {
  uploaded: number;
  downloaded: number;
  skipped?: boolean;
}

export interface SyncTransport {
  upload: (changes: SyncChange[]) => Promise<void>;
  download: (cursor: string | null) => Promise<{ changes: SyncChange[]; cursor: string | null }>;
}

export const validateSyncChange = (change: SyncChange): SyncChange => {
  if (!SYNC_ENTITY_KINDS.includes(change.entityKind)) throw new Error('Invalid sync entity kind');
  if (!change.entityId || !/^\d+$/.test(change.entityId)) throw new Error('Invalid sync entity id');
  if (!change.updatedAt || Number.isNaN(Date.parse(change.updatedAt))) throw new Error('Invalid sync timestamp');
  if (change.deletedAt === null) {
    if (!change.payload || typeof change.payload !== 'object' || Array.isArray(change.payload)) throw new Error('Invalid sync payload');
    if (String(change.payload.id) !== change.entityId) throw new Error('Invalid sync payload');
  } else if (Number.isNaN(Date.parse(change.deletedAt))) {
    throw new Error('Invalid sync tombstone');
  }
  return change;
};

const local = {
  outbox: () => invoke<SyncChange[]>('sync_get_outbox'),
  cursor: () => invoke<string | null>('sync_get_cursor'),
  markUploaded: (ids: number[]) => invoke('sync_mark_uploaded', { ids }),
  applyRemote: (change: SyncChange) => invoke('sync_apply_remote', { change }),
  setCursor: (cursor: string | null) => invoke('sync_set_cursor', { cursor }),
};

export const enqueueChange = async (change: SyncChange): Promise<void> => {
  validateSyncChange(change);
  await invoke('sync_enqueue_change', { change });
};

export const createSupabaseSyncTransport = (): SyncTransport => {
  const client = supabase;
  if (!client) throw new Error('Supabase configuration is missing');
  return {
    upload: async (changes) => {
      const { error } = await client.from('sync_records').upsert(changes.map(({ id: _id, ...change }) => ({ ...change })), { onConflict: 'user_id,entity_kind,entity_id' });
      if (error) throw new Error(error.message);
    },
    download: async (cursor) => {
      let query = client.from('sync_records').select('*');
      if (cursor) query = query.gt('updated_at', cursor);
      const result = await query.order('updated_at', { ascending: true });
      if (result.error) throw new Error(result.error.message);
      const changes = (result.data ?? []) as unknown as SyncChange[];
      return { changes, cursor: changes.at(-1)?.updatedAt ?? cursor };
    },
  };
};

export interface SyncEngineOptions {
  cloud: SyncTransport;
  isApproved: boolean | (() => boolean);
}

export const createSyncEngine = ({ cloud, isApproved }: SyncEngineOptions) => ({
  syncNow: async (): Promise<SyncResult> => {
    const approved = typeof isApproved === 'function' ? isApproved() : isApproved;
    if (!approved) return { uploaded: 0, downloaded: 0, skipped: true };

    const pending = await local.outbox();
    for (const change of pending) validateSyncChange(change);
    if (pending.length) {
      await cloud.upload(pending);
      await local.markUploaded(pending.flatMap((change) => change.id === undefined ? [] : [change.id]));
    }

    const cursor = await local.cursor();
    const pulled = await cloud.download(cursor);
    for (const change of pulled.changes) {
      validateSyncChange(change);
      await local.applyRemote(change);
    }
    if (pulled.cursor !== cursor) await local.setCursor(pulled.cursor);
    return { uploaded: pending.length, downloaded: pulled.changes.length };
  },
});

let loopTimer: ReturnType<typeof setInterval> | null = null;
let activeEngine: ReturnType<typeof createSyncEngine> | null = null;

export const startSyncLoop = (engine: ReturnType<typeof createSyncEngine>, intervalMs = 30_000): void => {
  stopSyncLoop();
  activeEngine = engine;
  void engine.syncNow().catch(() => undefined);
  loopTimer = setInterval(() => void activeEngine?.syncNow().catch(() => undefined), intervalMs);
};

export const stopSyncLoop = (): void => {
  if (loopTimer) clearInterval(loopTimer);
  loopTimer = null;
  activeEngine = null;
};
