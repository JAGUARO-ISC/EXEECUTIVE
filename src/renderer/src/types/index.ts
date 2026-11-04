export interface Appointment {
  id?: number;
  title: string;
  description?: string | null;
  startDatetime: string;
  endDatetime: string;
  location?: string | null;
  category?: string | null;
  color?: string | null;
  priority: number;
  reminderMinutes: number;
  isRecurring: boolean;
  recurrencePattern?: string | null;
  recurrenceEnd?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export type CalendarView = 'day' | 'week' | 'month' | 'year';

export type TaskStatus = 'todo' | 'doing' | 'done';

export interface Task {
  id?: number;
  title: string;
  description?: string | null;
  dueDate?: string | null;
  dueTime?: string | null;
  priority: number; // 0 bassa, 1 media, 2 alta, 3 urgente
  status: TaskStatus;
  category?: string | null;
  reminderMinutes: number;
  completedAt?: string | null;
  createdAt?: string | null;
}

export type TxKind = 'income' | 'expense';

export interface Transaction {
  id?: number;
  kind: TxKind;
  /** Minor units of `currency`. */
  amountCents: number;
  currency: string;
  description?: string | null;
  category: string;
  /** Who paid you / who you paid. */
  counterparty?: string | null;
  paymentMethod?: string | null;
  date: string; // YYYY-MM-DD, local
  notes?: string | null;
  createdAt?: string | null;
}

export interface Note {
  id?: number;
  title: string;
  content?: string | null;
  category?: string | null;
  linkedDate?: string | null;
  important: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface Goal {
  id?: number;
  title: string;
  targetCents: number;
  currentCents: number;
  currency: string;
  deadline?: string | null;
  createdAt?: string | null;
}
