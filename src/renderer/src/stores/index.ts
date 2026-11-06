import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import type { Appointment, Goal, Note, Task, Transaction } from '../types';
import { enqueueChange } from '../lib/sync';

export const errMsg = (e: unknown): string => {
  if (typeof e === 'string' && e.trim()) return e;
  if (e instanceof Error && e.message.trim()) return e.message;
  if (typeof e === 'object' && e !== null && 'message' in e) {
    const message = (e as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return 'Operation failed.';
};

// ------------------------------------------------------------ appointments

interface AppointmentStore {
  appointments: Appointment[];
  loading: boolean;
  error: string | null;
  lastRange: [string, string] | null;
  fetchAppointments: (rangeStart: Date, rangeEnd: Date) => Promise<void>;
  refresh: () => Promise<void>;
  addAppointment: (a: Omit<Appointment, 'id'>) => Promise<boolean>;
  updateAppointment: (id: number, a: Omit<Appointment, 'id'>) => Promise<boolean>;
  deleteAppointment: (id: number) => Promise<boolean>;
}

export const useAppointmentStore = create<AppointmentStore>((set, get) => ({
  appointments: [],
  loading: false,
  error: null,
  lastRange: null,
  fetchAppointments: async (rangeStart, rangeEnd) => {
    const range: [string, string] = [rangeStart.toISOString(), rangeEnd.toISOString()];
    set({ loading: true, error: null, lastRange: range });
    try {
      const appointments = await invoke<Appointment[]>('get_appointments', { rangeStart: range[0], rangeEnd: range[1] });
      set({ appointments, loading: false });
    } catch (e) {
      set({ error: errMsg(e), loading: false });
    }
  },
  refresh: async () => {
    const r = get().lastRange;
    if (r) await get().fetchAppointments(new Date(r[0]), new Date(r[1]));
  },
  addAppointment: async (a) => {
    try {
      const id = await invoke<number>('create_appointment', { appointment: a });
      await enqueueChange({ entityKind: 'appointment', entityId: String(id), updatedAt: new Date().toISOString(), deletedAt: null, payload: { ...a, id } });
      await get().refresh();
      return true;
    } catch (e) {
      set({ error: errMsg(e) });
      return false;
    }
  },
  updateAppointment: async (id, a) => {
    try {
      await invoke('update_appointment', { id, appointment: a });
      await enqueueChange({ entityKind: 'appointment', entityId: String(id), updatedAt: new Date().toISOString(), deletedAt: null, payload: { ...a, id } });
      await get().refresh();
      return true;
    } catch (e) {
      set({ error: errMsg(e) });
      return false;
    }
  },
  deleteAppointment: async (id) => {
    try {
      await invoke('delete_appointment', { id });
      await enqueueChange({ entityKind: 'appointment', entityId: String(id), updatedAt: new Date().toISOString(), deletedAt: new Date().toISOString(), payload: null });
      await get().refresh();
      return true;
    } catch (e) {
      set({ error: errMsg(e) });
      return false;
    }
  },
}));

// ----------------------------------------------------------- generic CRUD

interface EntityStore<T> {
  items: T[];
  loaded: boolean;
  error: string | null;
  load: () => Promise<void>;
  /** Each mutation resolves to null on success or an error message. */
  add: (v: Omit<T, 'id'>) => Promise<string | null>;
  update: (id: number, v: Omit<T, 'id'>) => Promise<string | null>;
  remove: (id: number) => Promise<string | null>;
}

interface Commands {
  list: string;
  create: string;
  update: string;
  remove: string;
  /** Argument name the Rust command expects for the entity. */
  key: string;
  kind: 'task' | 'transaction' | 'note' | 'goal';
}

function makeStore<T>(c: Commands) {
  return create<EntityStore<T>>((set, get) => {
    const run = async (fn: () => Promise<unknown>, change: (result: unknown) => Parameters<typeof enqueueChange>[0]): Promise<string | null> => {
      try {
        const result = await fn();
        await enqueueChange(change(result));
        await get().load();
        return null;
      } catch (e) {
        const m = errMsg(e);
        set({ error: m });
        return m;
      }
    };
    return {
      items: [],
      loaded: false,
      error: null,
      load: async () => {
        try {
          const items = await invoke<T[]>(c.list);
          set({ items, loaded: true, error: null });
        } catch (e) {
          set({ error: errMsg(e), loaded: true });
        }
      },
      add: (v) => run(() => invoke(c.create, { [c.key]: v }), (result) => ({ entityKind: c.kind, entityId: String(result), updatedAt: new Date().toISOString(), deletedAt: null, payload: { ...v as object, id: Number(result) } })),
      update: (id, v) => run(() => invoke(c.update, { id, [c.key]: v }), () => ({ entityKind: c.kind, entityId: String(id), updatedAt: new Date().toISOString(), deletedAt: null, payload: { ...v as object, id } })),
      remove: (id) => run(() => invoke(c.remove, { id }), () => ({ entityKind: c.kind, entityId: String(id), updatedAt: new Date().toISOString(), deletedAt: new Date().toISOString(), payload: null })),
    };
  });
}

export const useTaskStore = makeStore<Task>({ list: 'get_tasks', create: 'create_task', update: 'update_task', remove: 'delete_task', key: 'task', kind: 'task' });
export const useTxStore = makeStore<Transaction>({
  list: 'get_transactions',
  create: 'create_transaction',
  update: 'update_transaction',
  remove: 'delete_transaction',
  key: 'transaction',
  kind: 'transaction',
});
export const useNoteStore = makeStore<Note>({ list: 'get_notes', create: 'create_note', update: 'update_note', remove: 'delete_note', key: 'note', kind: 'note' });
export const useGoalStore = makeStore<Goal>({ list: 'get_goals', create: 'create_goal', update: 'update_goal', remove: 'delete_goal', key: 'goal', kind: 'goal' });

/** Marks a task done / not done, keeping every other field. */
export const toggleTask = (t: Task): Promise<string | null> => {
  const { id, ...rest } = t;
  return useTaskStore.getState().update(id!, { ...rest, status: t.status === 'done' ? 'todo' : 'done' });
};
