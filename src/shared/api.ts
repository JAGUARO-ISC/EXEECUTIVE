import type {
  AppInfo,
  BackupInfo,
  Budget,
  CalendarEvent,
  Category,
  CategoryKind,
  EventOccurrence,
  ISODate,
  MonthSummary,
  NavCommand,
  Note,
  PeriodSummary,
  RecurringPayment,
  SearchHit,
  Settings,
  Task,
  TaskStats,
  Transaction,
  TxFilter,
  UpdateStatus
} from './types'
import type { CategoryInput, EventInput, NoteInput, RecurringInput, SettingsPatch, TaskInput, TxInput } from './schemas'

export type Result<T> = { ok: true; data: T } | { ok: false; error: string }

export type DataEntity = 'events' | 'tasks' | 'transactions' | 'notes' | 'categories' | 'settings' | 'budgets' | 'recurring' | 'all'

/** Contratto fra renderer e processo principale. Ogni metodo corrisponde a un canale IPC. */
export interface ExecutiveApi {
  app: {
    info(): Promise<Result<AppInfo>>
    openDataFolder(): Promise<Result<void>>
    quit(): Promise<Result<void>>
    hideWindow(): Promise<Result<void>>
  }
  settings: {
    get(): Promise<Result<Settings>>
    update(patch: SettingsPatch): Promise<Result<Settings>>
  }
  categories: {
    list(kind?: CategoryKind): Promise<Result<Category[]>>
    create(input: CategoryInput): Promise<Result<Category>>
    update(input: { id: number; name?: string; color?: string; archived?: boolean }): Promise<Result<Category>>
    remove(id: number): Promise<Result<void>>
  }
  events: {
    occurrences(range: { from: ISODate; to: ISODate }): Promise<Result<EventOccurrence[]>>
    get(id: number): Promise<Result<CalendarEvent>>
    create(input: EventInput): Promise<Result<CalendarEvent>>
    update(id: number, input: EventInput): Promise<Result<CalendarEvent>>
    remove(id: number): Promise<Result<void>>
    removeOccurrence(eventId: number, occurrenceDate: ISODate): Promise<Result<void>>
    setOccurrenceCompleted(eventId: number, occurrenceDate: ISODate, completed: boolean): Promise<Result<void>>
  }
  tasks: {
    list(): Promise<Result<Task[]>>
    forDate(date: ISODate): Promise<Result<Task[]>>
    create(input: TaskInput): Promise<Result<Task>>
    update(id: number, input: TaskInput): Promise<Result<Task>>
    setStatus(id: number, status: Task['status']): Promise<Result<Task>>
    move(id: number, date: ISODate): Promise<Result<Task>>
    remove(id: number): Promise<Result<void>>
    stats(range: { from: ISODate; to: ISODate }): Promise<Result<TaskStats>>
  }
  transactions: {
    list(filter: TxFilter): Promise<Result<Transaction[]>>
    create(input: TxInput): Promise<Result<Transaction>>
    update(id: number, input: TxInput): Promise<Result<Transaction>>
    remove(id: number): Promise<Result<void>>
    attach(id: number): Promise<Result<Transaction | null>>
    detach(id: number): Promise<Result<Transaction>>
    openAttachment(id: number): Promise<Result<void>>
    month(year: number, month: number): Promise<Result<MonthSummary>>
    rangeSummary(range: { from: ISODate; to: ISODate }): Promise<Result<MonthSummary>>
    monthly(year: number): Promise<Result<PeriodSummary[]>>
    yearly(): Promise<Result<PeriodSummary[]>>
    categoryTotals(range: { from: ISODate; to: ISODate }): Promise<Result<{ income: MonthSummary['incomeByCategory']; expense: MonthSummary['expenseByCategory'] }>>
  }
  recurring: {
    list(): Promise<Result<RecurringPayment[]>>
    create(input: RecurringInput): Promise<Result<RecurringPayment>>
    update(id: number, input: RecurringInput): Promise<Result<RecurringPayment>>
    remove(id: number): Promise<Result<void>>
  }
  budgets: {
    list(): Promise<Result<Budget[]>>
    set(categoryId: number, amountCents: number): Promise<Result<void>>
  }
  notes: {
    list(): Promise<Result<Note[]>>
    create(input: NoteInput): Promise<Result<Note>>
    update(id: number, input: NoteInput): Promise<Result<Note>>
    remove(id: number): Promise<Result<void>>
  }
  search: {
    query(q: string): Promise<Result<SearchHit[]>>
  }
  backup: {
    list(): Promise<Result<BackupInfo[]>>
    create(): Promise<Result<BackupInfo>>
    chooseDir(): Promise<Result<string | null>>
    restore(path: string): Promise<Result<void>>
    restoreFromFile(): Promise<Result<boolean>>
    reveal(path: string): Promise<Result<void>>
  }
  exporter: {
    json(): Promise<Result<string | null>>
    csv(dataset: 'transactions' | 'events' | 'tasks' | 'notes', filter?: TxFilter): Promise<Result<string | null>>
    xlsx(filter?: TxFilter): Promise<Result<string | null>>
    pdf(html: string, suggestedName: string): Promise<Result<string | null>>
  }
  updates: {
    check(): Promise<Result<UpdateStatus>>
    install(): Promise<Result<void>>
    status(): Promise<Result<UpdateStatus>>
  }
  on: {
    dataChanged(cb: (entity: DataEntity) => void): () => void
    navigate(cb: (cmd: NavCommand) => void): () => void
    updateStatus(cb: (s: UpdateStatus) => void): () => void
  }
}
