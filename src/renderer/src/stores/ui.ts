import { create } from 'zustand';
import type { Appointment, Goal, Note, Task, Transaction, TxKind } from '../types';

export type Page = 'dashboard' | 'calendar' | 'tasks' | 'finance' | 'advisor' | 'stats' | 'notes' | 'profile' | 'settings';

export type ModalState =
  | { type: 'appointment'; appointment: Appointment | null; date: Date }
  | { type: 'task'; task: Task | null }
  | { type: 'transaction'; kind: TxKind; transaction: Transaction | null }
  | { type: 'note'; note: Note | null }
  | { type: 'goal'; goal: Goal | null }
  | null;

interface UiStore {
  page: Page;
  modal: ModalState;
  /** Increments on every open so a modal remounts with fresh form state. */
  modalId: number;
  setPage: (p: Page) => void;
  open: (m: Exclude<ModalState, null>) => void;
  close: () => void;
}

const KEY = 'executive.page';
const PAGES: Page[] = ['dashboard', 'calendar', 'tasks', 'finance', 'advisor', 'stats', 'notes', 'profile', 'settings'];

const initialPage = (): Page => {
  try {
    const v = localStorage.getItem(KEY) as Page | null;
    return v && PAGES.includes(v) ? v : 'dashboard';
  } catch {
    return 'dashboard';
  }
};

export const useUi = create<UiStore>((set) => ({
  page: initialPage(),
  modal: null,
  modalId: 0,
  setPage: (page) => {
    try {
      localStorage.setItem(KEY, page);
    } catch {
      /* storage unavailable */
    }
    set({ page });
  },
  open: (modal) => set((s) => ({ modal, modalId: s.modalId + 1 })),
  close: () => set({ modal: null }),
}));

export const nextHour = (): Date => {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return d;
};

/** Quick-add helpers used by buttons, the sidebar menu and the tray. */
export const quick = {
  appointment: (date: Date = nextHour()) => useUi.getState().open({ type: 'appointment', appointment: null, date }),
  task: () => useUi.getState().open({ type: 'task', task: null }),
  income: () => useUi.getState().open({ type: 'transaction', kind: 'income', transaction: null }),
  expense: () => useUi.getState().open({ type: 'transaction', kind: 'expense', transaction: null }),
  note: () => useUi.getState().open({ type: 'note', note: null }),
  goal: () => useUi.getState().open({ type: 'goal', goal: null }),
};
