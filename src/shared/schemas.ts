import { z } from 'zod'
import { isValidDateTime, isValidISODate, isValidTime } from './dates'

const isoDate = z.string().refine(isValidISODate, 'Data non valida')
const isoDateTime = z.string().refine(isValidDateTime, 'Data e ora non valide')
const time = z.string().refine(isValidTime, 'Ora non valida')
const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Colore non valido')
const text = (max: number) => z.string().trim().max(max, `Massimo ${max} caratteri`)
const id = z.number().int().positive()

export const priorityS = z.enum(['low', 'medium', 'high', 'urgent'])

export const recurrenceS = z
  .object({
    freq: z.enum(['daily', 'weekly', 'monthly', 'yearly']),
    interval: z.number().int().min(1).max(365),
    until: isoDate.nullish(),
    count: z.number().int().min(1).max(1000).nullish(),
    byWeekday: z.array(z.number().int().min(0).max(6)).max(7).nullish()
  })
  .nullable()

export const categoryInputS = z.object({
  kind: z.enum(['event', 'task', 'income', 'expense', 'note']),
  name: text(40).min(1, 'Inserisci un nome'),
  color: hexColor
})
export const categoryUpdateS = z.object({
  id,
  name: text(40).min(1, 'Inserisci un nome').optional(),
  color: hexColor.optional(),
  archived: z.boolean().optional()
})

export const eventInputS = z
  .object({
    title: text(160).min(1, 'Inserisci un titolo'),
    description: text(5000).default(''),
    location: text(200).default(''),
    categoryId: id.nullable(),
    priority: priorityS,
    startAt: isoDateTime,
    endAt: isoDateTime,
    allDay: z.boolean(),
    reminderMinutes: z.number().int().min(0).max(60 * 24 * 30).nullable(),
    recurrence: recurrenceS
  })
  .refine((e) => e.endAt >= e.startAt, { message: "La fine deve essere successiva all'inizio", path: ['endAt'] })

export const eventUpdateS = z.object({ id, data: eventInputS })

export const occurrenceRefS = z.object({ eventId: id, occurrenceDate: isoDate })

export const taskInputS = z.object({
  title: text(160).min(1, 'Inserisci un titolo'),
  description: text(5000).default(''),
  type: z.enum(['task', 'meeting', 'call', 'errand', 'deadline', 'goal', 'reminder']),
  scope: z.enum(['work', 'personal']),
  date: isoDate.nullable(),
  time: time.nullable(),
  dueDate: isoDate.nullable(),
  priority: priorityS,
  status: z.enum(['todo', 'in_progress', 'done']),
  categoryId: id.nullable(),
  reminderAt: isoDateTime.nullable(),
  recurrence: recurrenceS
})
export const taskUpdateS = z.object({ id, data: taskInputS })

export const txInputS = z.object({
  kind: z.enum(['income', 'expense']),
  amountCents: z
    .number()
    .int('Importo non valido')
    .positive("L'importo deve essere maggiore di zero")
    .max(100_000_000_000, 'Importo troppo grande'),
  description: text(200).min(1, 'Inserisci una descrizione'),
  categoryId: id.nullable(),
  date: isoDate,
  time,
  paymentMethod: text(40),
  notes: text(5000).default('')
})
export const txUpdateS = z.object({ id, data: txInputS })

export const txFilterS = z
  .object({
    from: isoDate.optional(),
    to: isoDate.optional(),
    kind: z.enum(['income', 'expense']).optional(),
    categoryId: id.optional(),
    query: text(200).optional()
  })
  .default({})

export const recurringInputS = z.object({
  kind: z.enum(['income', 'expense']),
  amountCents: z.number().int().positive().max(100_000_000_000),
  description: text(200).min(1, 'Inserisci una descrizione'),
  categoryId: id.nullable(),
  paymentMethod: text(40),
  freq: z.enum(['weekly', 'monthly', 'yearly']),
  nextDate: isoDate,
  active: z.boolean()
})
export const recurringUpdateS = z.object({ id, data: recurringInputS })

export const budgetSetS = z.object({
  categoryId: id,
  amountCents: z.number().int().min(0).max(100_000_000_000)
})

export const noteInputS = z.object({
  title: text(200).min(1, 'Inserisci un titolo'),
  body: text(100_000).default(''),
  categoryId: id.nullable(),
  linkedDate: isoDate.nullable(),
  important: z.boolean()
})
export const noteUpdateS = z.object({ id, data: noteInputS })

const widgetS = z.enum([
  'today-finance',
  'month-finance',
  'agenda',
  'tasks',
  'overdue',
  'deadlines',
  'cashflow',
  'budgets',
  'insights'
])

export const settingsPatchS = z
  .object({
    userName: text(60),
    currency: z.string().regex(/^[A-Z]{3}$/),
    theme: z.enum(['system', 'light', 'dark']),
    closeBehavior: z.enum(['tray', 'quit']),
    autoStart: z.boolean(),
    startHidden: z.boolean(),
    notificationsEnabled: z.boolean(),
    notifyEvents: z.boolean(),
    notifyTasks: z.boolean(),
    notifyDeadlines: z.boolean(),
    notifyGoals: z.boolean(),
    notifyBudgets: z.boolean(),
    defaultEventReminder: z.number().int().min(0).max(10080).nullable(),
    goalsDigestTime: time,
    backupFrequency: z.enum(['off', 'daily', 'weekly']),
    backupDir: z.string().max(1000).nullable(),
    backupRetention: z.number().int().min(1).max(365),
    monthlyIncomeGoalCents: z.number().int().min(0).nullable(),
    monthlySavingsGoalCents: z.number().int().min(0).nullable(),
    dashboardWidgets: z.array(widgetS).max(20),
    paymentMethods: z.array(text(40).min(1)).max(30),
    updateFeedUrl: z.string().max(500),
    trayHintShown: z.boolean(),
    weekStartsOn: z.union([z.literal(0), z.literal(1)])
  })
  .partial()
  .strict()

export const monthRefS = z.object({ year: z.number().int().min(1970).max(2200), month: z.number().int().min(1).max(12) })
export const rangeS = z.object({ from: isoDate, to: isoDate })
export const dateS = isoDate
export const idS = id
export const searchS = text(200)

export type EventInput = z.infer<typeof eventInputS>
export type TaskInput = z.infer<typeof taskInputS>
export type TxInput = z.infer<typeof txInputS>
export type NoteInput = z.infer<typeof noteInputS>
export type RecurringInput = z.infer<typeof recurringInputS>
export type CategoryInput = z.infer<typeof categoryInputS>
export type SettingsPatch = z.infer<typeof settingsPatchS>
