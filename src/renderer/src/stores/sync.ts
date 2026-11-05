import { create } from 'zustand';
import { createSupabaseSyncTransport, createSyncEngine, startSyncLoop, stopSyncLoop, type SyncResult } from '../lib/sync';
import { useDeviceStore } from './devices';

interface SyncStore {
  running: boolean;
  lastResult: SyncResult | null;
  error: string | null;
  start: () => Promise<void>;
  syncNow: () => Promise<SyncResult | null>;
  stop: () => void;
}

let engine: ReturnType<typeof createSyncEngine> | null = null;

export const useSyncStore = create<SyncStore>((set) => ({
  running: false,
  lastResult: null,
  error: null,
  start: async () => {
    if (!useDeviceStore.getState().isApproved()) return;
    try {
      engine = createSyncEngine({ cloud: createSupabaseSyncTransport(), isApproved: () => useDeviceStore.getState().isApproved() });
      startSyncLoop(engine);
      set({ running: true, error: null });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error), running: false });
    }
  },
  syncNow: async () => {
    if (!engine) return null;
    try {
      const result = await engine.syncNow();
      set({ lastResult: result, error: null });
      return result;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error) });
      return null;
    }
  },
  stop: () => {
    stopSyncLoop();
    engine = null;
    set({ running: false });
  },
}));
