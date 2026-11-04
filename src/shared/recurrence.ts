import { addDays, addMonthsStrict, diffDays, startOfWeek } from './dates'
import type { ISODate, RecurrenceRule } from './types'

const MAX_STEPS = 20_000

/**
 * Restituisce le date (YYYY-MM-DD) in cui cade un evento che inizia il giorno `start`
 * con la regola `rule`, limitate all'intervallo [from, to] incluso.
 * Il conteggio `count` si riferisce alle occorrenze dall'inizio della serie.
 */
export function expandDates(start: ISODate, rule: RecurrenceRule | null, from: ISODate, to: ISODate): ISODate[] {
  if (!rule) return start >= from && start <= to ? [start] : []

  const interval = Math.max(1, Math.floor(rule.interval || 1))
  const until = rule.until && rule.until < to ? rule.until : to
  const maxCount = rule.count && rule.count > 0 ? rule.count : Infinity
  const out: ISODate[] = []
  let produced = 0

  const emit = (d: ISODate): boolean => {
    if (d < start) return true
    if (d > until || produced >= maxCount) return false
    produced++
    if (d >= from) out.push(d)
    return true
  }

  switch (rule.freq) {
    case 'daily': {
      let d = start
      // salto diretto fino a vicino a `from` quando non c'è un limite di conteggio
      if (maxCount === Infinity && from > start) {
        const skip = Math.floor(diffDays(from, start) / interval) * interval
        d = addDays(start, skip)
      }
      for (let i = 0; i < MAX_STEPS; i++) {
        if (!emit(d)) break
        d = addDays(d, interval)
      }
      break
    }
    case 'weekly': {
      const days = rule.byWeekday && rule.byWeekday.length > 0 ? [...new Set(rule.byWeekday)].sort() : null
      if (!days) {
        let d = start
        if (maxCount === Infinity && from > start) {
          const skip = Math.floor(diffDays(from, start) / (7 * interval)) * 7 * interval
          d = addDays(start, skip)
        }
        for (let i = 0; i < MAX_STEPS; i++) {
          if (!emit(d)) break
          d = addDays(d, 7 * interval)
        }
      } else {
        let weekStart = startOfWeek(start, 0)
        outer: for (let i = 0; i < MAX_STEPS; i++) {
          for (const wd of days) {
            const d = addDays(weekStart, wd)
            if (d < start) continue
            if (!emit(d)) break outer
          }
          weekStart = addDays(weekStart, 7 * interval)
          if (weekStart > until) break
        }
      }
      break
    }
    case 'monthly':
    case 'yearly': {
      const stepMonths = rule.freq === 'monthly' ? interval : 12 * interval
      for (let i = 0; i < MAX_STEPS; i++) {
        const d = addMonthsStrict(start, i * stepMonths)
        if (d === null) continue // es. 31 in un mese di 30 giorni: occorrenza saltata
        if (!emit(d)) break
      }
      break
    }
  }
  return out
}

/** Prima occorrenza strettamente successiva a `after`, o null se la serie è terminata. */
export function nextOccurrence(start: ISODate, rule: RecurrenceRule, after: ISODate): ISODate | null {
  const horizon = addDays(after, 366 * 5 * Math.max(1, rule.interval))
  const list = expandDates(start, rule, addDays(after, 1), horizon)
  return list[0] ?? null
}

const WEEKDAY_NAMES = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato']

export function describeRule(rule: RecurrenceRule | null): string {
  if (!rule) return 'Non si ripete'
  const n = Math.max(1, rule.interval)
  let base: string
  switch (rule.freq) {
    case 'daily':
      base = n === 1 ? 'Ogni giorno' : `Ogni ${n} giorni`
      break
    case 'weekly': {
      base = n === 1 ? 'Ogni settimana' : `Ogni ${n} settimane`
      if (rule.byWeekday?.length) {
        base += ` di ${[...rule.byWeekday]
          .sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))
          .map((d) => WEEKDAY_NAMES[d])
          .join(', ')}`
      }
      break
    }
    case 'monthly':
      base = n === 1 ? 'Ogni mese' : `Ogni ${n} mesi`
      break
    case 'yearly':
      base = n === 1 ? 'Ogni anno' : `Ogni ${n} anni`
      break
  }
  if (rule.count) base += `, ${rule.count} volte`
  else if (rule.until) base += `, fino al ${rule.until.split('-').reverse().join('/')}`
  return base
}
