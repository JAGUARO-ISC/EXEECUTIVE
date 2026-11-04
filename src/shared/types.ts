export type ISODate = string // YYYY-MM-DD (local)
export type ISODateTime = string // YYYY-MM-DDTHH:mm (local)

export type CategoryKind = 'event' | 'task' | 'income' | 'expense' | 'note'
export type Priority = 'low' | 'medium' | 'high' | 'urgent'
export type TaskStatus = 'todo' | 'in_progress' | 'done'
export type TaskType = 'task' | 'meeting' | 'call' | 'errand' | 'deadline' | 'goal' | 'reminder'
export type Scope = 'work' | 'personal'
export type TxKind = 'income' | 'expense'
export type Frequency = 'daily' | 'weekly' | 'monthly' | 'yearly'

export interface RecurrenceRule {
  freq: Frequency
  interval: number
  until?: ISODate | null
  count?: number | null
  byWeekday?: number[] | null // 0 = domenica ... 6 = sabato (solo weekly)
}

export interface Category {
  id: number
  kind: CategoryKind
  name: string
  color: string
  sort: number
  archived: boolean
}

export interface CalendarEvent {
  id: number
  title: string
  description: string
  location: string
  categoryId: number | null
  priority: Priority
  startAt: ISODateTime
  endAt: ISODateTime
  allDay: boolean
  completed: boolean
  reminderMinutes: number | null
  recurrence: RecurrenceRule | null
  createdAt: string
  updatedAt: string
}

/** Singola occorrenza di un evento (gli eventi ricorrenti generano più occorrenze). */
export interface EventOccurrence {
  key: string // `${eventId}:${occurrenceDate}`
  eventId: number
  occurrenceDate: ISODate
  title: string
  description: string
  location: string
  categoryId: number | null
  priority: Priority
  startAt: ISODateTime
  endAt: ISODateTime
  allDay: boolean
  completed: boolean
  recurring: boolean
  reminderMinutes: number | null
}

export interface Task {
  id: number
  title: string
  description: string
  type: TaskType
  scope: Scope
  date: ISODate | null
  time: string | null // HH:mm
  dueDate: ISODate | null
  priority: Priority
  status: TaskStatus
  categoryId: number | null
  reminderAt: ISODateTime | null
  recurrence: RecurrenceRule | null
  completedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface Transaction {
  id: number
  kind: TxKind
  amountCents: number
  description: string
  categoryId: number | null
  date: ISODate
  time: string // HH:mm
  paymentMethod: string
  notes: string
  attachment: string | null // nome file nella cartella allegati
  attachmentName: string | null // nome originale
  recurringId: number | null
  createdAt: string
  updatedAt: string
}

export interface RecurringPayment {
  id: number
  kind: TxKind
  amountCents: number
  description: string
  categoryId: number | null
  paymentMethod: string
  freq: 'weekly' | 'monthly' | 'yearly'
  nextDate: ISODate
  active: boolean
  createdAt: string
}

export interface Budget {
  categoryId: number
  amountCents: number
}

export interface Note {
  id: number
  title: string
  body: string
  categoryId: number | null
  linkedDate: ISODate | null
  important: boolean
  createdAt: string
  updatedAt: string
}

export type ThemePref = 'system' | 'light' | 'dark'
export type CloseBehavior = 'tray' | 'quit'
export type BackupFrequency = 'off' | 'daily' | 'weekly'

export type DashboardWidget =
  | 'today-finance'
  | 'month-finance'
  | 'agenda'
  | 'tasks'
  | 'overdue'
  | 'deadlines'
  | 'cashflow'
  | 'budgets'
  | 'insights'

export const ALL_WIDGETS: { id: DashboardWidget; label: string }[] = [
  { id: 'today-finance', label: 'Bilancio di oggi' },
  { id: 'month-finance', label: 'Bilancio del mese' },
  { id: 'agenda', label: 'Impegni di oggi e prossimi appuntamenti' },
  { id: 'tasks', label: 'Attività da completare' },
  { id: 'overdue', label: 'Attività urgenti o in ritardo' },
  { id: 'deadlines', label: 'Prossime scadenze' },
  { id: 'cashflow', label: 'Andamento del mese' },
  { id: 'budgets', label: 'Budget per categoria' },
  { id: 'insights', label: 'In sintesi' }
]

export interface Settings {
  userName: string
  currency: string
  theme: ThemePref
  closeBehavior: CloseBehavior
  autoStart: boolean
  startHidden: boolean
  notificationsEnabled: boolean
  notifyEvents: boolean
  notifyTasks: boolean
  notifyDeadlines: boolean
  notifyGoals: boolean
  notifyBudgets: boolean
  defaultEventReminder: number | null
  goalsDigestTime: string // HH:mm
  backupFrequency: BackupFrequency
  backupDir: string | null // null = cartella predefinita
  backupRetention: number
  lastBackupAt: string | null
  monthlyIncomeGoalCents: number | null
  monthlySavingsGoalCents: number | null
  dashboardWidgets: DashboardWidget[]
  paymentMethods: string[]
  updateFeedUrl: string
  trayHintShown: boolean
  lockEnabled: boolean
  weekStartsOn: 0 | 1
}

export interface DaySummary {
  date: ISODate
  incomeCents: number
  expenseCents: number
  netCents: number
}

export interface CategoryTotal {
  categoryId: number | null
  name: string
  color: string
  totalCents: number
  count: number
}

export interface MonthSummary {
  year: number
  month: number // 1-12
  incomeCents: number
  expenseCents: number
  netCents: number
  prevIncomeCents: number
  prevExpenseCents: number
  prevNetCents: number
  days: DaySummary[] // tutti i giorni del mese
  expenseByCategory: CategoryTotal[]
  incomeByCategory: CategoryTotal[]
  topIncomeDay: DaySummary | null
  topExpenseDay: DaySummary | null
  avgDailyExpenseCents: number
}

export interface PeriodSummary {
  label: string
  key: string
  incomeCents: number
  expenseCents: number
  netCents: number
}

export interface TxFilter {
  from?: ISODate
  to?: ISODate
  kind?: TxKind
  categoryId?: number
  query?: string
}

export interface SearchHit {
  type: 'event' | 'task' | 'income' | 'expense' | 'note'
  id: number
  title: string
  subtitle: string
  date: ISODate | null
}

export interface BackupInfo {
  path: string
  name: string
  createdAt: string
  sizeBytes: number
  reason: string
  appVersion: string
  schemaVersion: number
}

export interface AppInfo {
  version: string
  schemaVersion: number
  dataDir: string
  dbPath: string
  defaultBackupDir: string
  platform: string
  isPackaged: boolean
}

export interface ProductivityPoint {
  key: string
  label: string
  completed: number
  created: number
}

export interface TaskStats {
  total: number
  done: number
  open: number
  overdue: number
  byPriority: Record<Priority, number>
  daily: ProductivityPoint[]
  weekly: ProductivityPoint[]
}

export type UpdateStatus =
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'not-configured' }
  | { state: 'none'; version: string }
  | { state: 'available'; version: string }
  | { state: 'downloading'; percent: number }
  | { state: 'downloaded'; version: string }
  | { state: 'error'; message: string }

export type NavCommand =
  | { type: 'navigate'; path: string }
  | { type: 'quick-add'; what: 'event' | 'task' | 'income' | 'expense' | 'note' }
