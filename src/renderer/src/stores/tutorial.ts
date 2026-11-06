import { create } from 'zustand';

export type TutorialStatus = 'idle' | 'running' | 'skipped' | 'completed';
const steps = 7;
const key = (id: string) => `exec_tutorial:${id}`;

interface TutorialState {
  userId: string | null;
  status: TutorialStatus;
  step: number;
  prepare: (userId: string) => void;
  start: (userId?: string) => void;
  next: () => void;
  back: () => void;
  skip: () => void;
  complete: () => void;
  restart: () => void;
}

export const useTutorialStore = create<TutorialState>((set, get) => ({
  userId: null,
  status: 'idle',
  step: 0,
  prepare: (userId) => {
    let status: TutorialStatus = 'idle';
    try { status = (localStorage.getItem(key(userId)) as TutorialStatus | null) ?? 'idle'; } catch { /* ignore */ }
    set({ userId, status: status === 'completed' || status === 'skipped' ? status : 'running', step: 0 });
  },
  start: (userId) => {
    const id = userId ?? get().userId;
    if (id) set({ userId: id, status: 'running', step: 0 });
  },
  next: () => {
    const state = get();
    if (state.step < steps - 1) return set({ step: state.step + 1 });
    if (state.userId) try { localStorage.setItem(key(state.userId), 'completed'); } catch { /* ignore */ }
    set({ status: 'completed' });
  },
  back: () => set((state) => ({ step: Math.max(0, state.step - 1) })),
  skip: () => { const userId = get().userId; if (userId) try { localStorage.setItem(key(userId), 'skipped'); } catch { /* ignore */ } set({ status: 'skipped' }); },
  complete: () => { const userId = get().userId; if (userId) try { localStorage.setItem(key(userId), 'completed'); } catch { /* ignore */ } set({ status: 'completed' }); },
  restart: () => {
    const userId = get().userId;
    if (userId) try { localStorage.removeItem(key(userId)); } catch { /* ignore */ }
    set({ status: 'running', step: 0 });
  },
}));
