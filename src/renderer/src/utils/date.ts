import type { Appointment } from '../types';

/** Local calendar date key, YYYY-MM-DD (never uses UTC). */
export const dateKey = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const startOfDay = (d: Date): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export const addDays = (d: Date, n: number): Date =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, d.getHours(), d.getMinutes());

/** Monday-based start of week. */
export const startOfWeek = (d: Date): Date => addDays(startOfDay(d), -((d.getDay() + 6) % 7));

export const addMonthsClamped = (d: Date, n: number): Date => {
  const target = new Date(d.getFullYear(), d.getMonth() + n, 1, d.getHours(), d.getMinutes());
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(d.getDate(), last));
  return target;
};

export const isSameDay = (a: Date, b: Date): boolean => dateKey(a) === dateKey(b);

export const formatTime = (d: Date): string =>
  d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

export const formatRange = (s: Date, e: Date): string => `${formatTime(s)} - ${formatTime(e)}`;

/** One concrete occurrence of an appointment (recurring series are expanded). */
export interface Occurrence extends Appointment {
  occurrenceStart: Date;
  occurrenceEnd: Date;
  /** Original stored appointment, used when editing. */
  source: Appointment;
}

const step = (d: Date, pattern: string, n: number): Date => {
  switch (pattern) {
    case 'daily':
      return addDays(d, n);
    case 'weekly':
      return addDays(d, 7 * n);
    case 'monthly':
      return addMonthsClamped(d, n);
    case 'yearly':
      return addMonthsClamped(d, 12 * n);
    default:
      return d;
  }
};

/** Expand appointments into occurrences overlapping [from, to). */
export const expandOccurrences = (appointments: Appointment[], from: Date, to: Date): Occurrence[] => {
  const out: Occurrence[] = [];
  for (const a of appointments) {
    const start = new Date(a.startDatetime);
    const end = new Date(a.endDatetime);
    const duration = end.getTime() - start.getTime();
    const push = (s: Date) => {
      const e = new Date(s.getTime() + duration);
      if (s < to && e > from) {
        out.push({ ...a, occurrenceStart: s, occurrenceEnd: e, source: a });
      }
    };
    if (!a.isRecurring || !a.recurrencePattern || a.recurrencePattern === 'none') {
      push(start);
      continue;
    }
    const until = a.recurrenceEnd ? new Date(a.recurrenceEnd) : null;
    for (let i = 0; i < 5000; i++) {
      const s = step(start, a.recurrencePattern, i);
      if (s >= to) break;
      if (until && s > until) break;
      push(s);
    }
  }
  return out.sort((x, y) => x.occurrenceStart.getTime() - y.occurrenceStart.getTime());
};

/** Occurrences that touch the given local day. */
export const occurrencesOnDay = (occ: Occurrence[], day: Date): Occurrence[] => {
  const from = startOfDay(day);
  const to = addDays(from, 1);
  return occ.filter((o) => o.occurrenceStart < to && o.occurrenceEnd > from);
};

export interface Lane {
  o: Occurrence;
  lane: number;
  lanes: number;
}

/** Side-by-side lanes so overlapping events do not cover each other. */
export const layoutLanes = (items: Occurrence[]): Lane[] => {
  const sorted = [...items].sort((a, b) => a.occurrenceStart.getTime() - b.occurrenceStart.getTime());
  const result: Lane[] = [];
  let cluster: Occurrence[] = [];
  let clusterEnd = 0;
  const flush = () => {
    const laneEnds: number[] = [];
    const placed = cluster.map((o) => {
      let lane = laneEnds.findIndex((end) => end <= o.occurrenceStart.getTime());
      if (lane === -1) {
        lane = laneEnds.length;
        laneEnds.push(0);
      }
      laneEnds[lane] = o.occurrenceEnd.getTime();
      return { o, lane };
    });
    placed.forEach((p) => result.push({ ...p, lanes: laneEnds.length }));
    cluster = [];
  };
  for (const o of sorted) {
    if (cluster.length && o.occurrenceStart.getTime() >= clusterEnd) flush();
    cluster.push(o);
    clusterEnd = cluster.length === 1 ? o.occurrenceEnd.getTime() : Math.max(clusterEnd, o.occurrenceEnd.getTime());
  }
  if (cluster.length) flush();
  return result;
};

export const CATEGORY_COLORS: Record<string, string> = {
  meeting: '#3b82f6',
  work: '#ff6f1a',
  call: '#a78bfa',
  personal: '#14b8a6',
  other: '#94a3b8',
};

export const CATEGORY_LABELS: Record<string, string> = {
  meeting: 'Riunione',
  work: 'Lavoro',
  call: 'Chiamata',
  personal: 'Personale',
  other: 'Altro',
};
