import type { ISODate, ISODateTime } from './types'

const pad = (n: number): string => String(n).padStart(2, '0')

export function toISODate(d: Date): ISODate {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function toISODateTime(d: Date): ISODateTime {
  return `${toISODate(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function today(): ISODate {
  return toISODate(new Date())
}

export function nowDateTime(): ISODateTime {
  return toISODateTime(new Date())
}

/** Data locale a mezzanotte, senza conversioni di fuso orario. */
export function parseISODate(s: ISODate): Date {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function parseDateTime(s: ISODateTime): Date {
  const [datePart, timePart = '00:00'] = s.split('T')
  const [y, m, d] = datePart.split('-').map(Number)
  const [hh, mm] = timePart.split(':').map(Number)
  return new Date(y, m - 1, d, hh || 0, mm || 0)
}

export function addDays(s: ISODate, n: number): ISODate {
  const d = parseISODate(s)
  d.setDate(d.getDate() + n)
  return toISODate(d)
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

/** Aggiunge mesi mantenendo il giorno; se il giorno non esiste restituisce null. */
export function addMonthsStrict(s: ISODate, n: number): ISODate | null {
  const [y, m, d] = s.split('-').map(Number)
  const total = y * 12 + (m - 1) + n
  const ny = Math.floor(total / 12)
  const nm = (total % 12) + 1
  if (d > daysInMonth(ny, nm)) return null
  return `${ny}-${pad(nm)}-${pad(d)}`
}

/** Aggiunge mesi limitando il giorno all'ultimo giorno del mese (31 gen + 1 = 28/29 feb). */
export function addMonthsClamped(s: ISODate, n: number): ISODate {
  const [y, m, d] = s.split('-').map(Number)
  const total = y * 12 + (m - 1) + n
  const ny = Math.floor(total / 12)
  const nm = (total % 12) + 1
  return `${ny}-${pad(nm)}-${pad(Math.min(d, daysInMonth(ny, nm)))}`
}

export function weekday(s: ISODate): number {
  return parseISODate(s).getDay()
}

export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round((parseISODate(a).getTime() - parseISODate(b).getTime()) / 86_400_000)
}

export function diffMinutes(a: ISODateTime, b: ISODateTime): number {
  return Math.round((parseDateTime(a).getTime() - parseDateTime(b).getTime()) / 60_000)
}

export function addMinutes(s: ISODateTime, n: number): ISODateTime {
  const d = parseDateTime(s)
  d.setMinutes(d.getMinutes() + n)
  return toISODateTime(d)
}

export function monthBounds(year: number, month: number): { from: ISODate; to: ISODate } {
  return { from: `${year}-${pad(month)}-01`, to: `${year}-${pad(month)}-${pad(daysInMonth(year, month))}` }
}

export function prevMonth(year: number, month: number): { year: number; month: number } {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 }
}

export function datePart(s: ISODateTime): ISODate {
  return s.slice(0, 10)
}

export function timePart(s: ISODateTime): string {
  return s.slice(11, 16) || '00:00'
}

export function isValidISODate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const [y, m, d] = s.split('-').map(Number)
  return m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m)
}

export function isValidTime(s: string): boolean {
  if (!/^\d{2}:\d{2}$/.test(s)) return false
  const [h, m] = s.split(':').map(Number)
  return h >= 0 && h <= 23 && m >= 0 && m <= 59
}

export function isValidDateTime(s: string): boolean {
  const [d, t] = s.split('T')
  return !!d && !!t && isValidISODate(d) && isValidTime(t)
}

/** Inizio settimana (lunedì se weekStartsOn = 1). */
export function startOfWeek(s: ISODate, weekStartsOn: 0 | 1 = 1): ISODate {
  const wd = weekday(s)
  const delta = (wd - weekStartsOn + 7) % 7
  return addDays(s, -delta)
}

/** Settimana ISO-8601 per il raggruppamento dei report. */
export function isoWeekKey(s: ISODate): string {
  const d = parseISODate(s)
  const day = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - day + 3)
  const firstThursday = new Date(d.getFullYear(), 0, 4)
  const week =
    1 + Math.round(((d.getTime() - firstThursday.getTime()) / 86_400_000 - 3 + ((firstThursday.getDay() + 6) % 7)) / 7)
  return `${d.getFullYear()}-W${pad(week)}`
}
