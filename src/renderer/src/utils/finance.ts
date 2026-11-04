import type { Transaction, TxKind } from '../types';

export interface Totals {
  income: number;
  expense: number;
  net: number;
}

export const totals = (tx: Transaction[]): Totals => {
  let income = 0;
  let expense = 0;
  for (const t of tx) {
    if (t.kind === 'income') income += t.amountCents;
    else expense += t.amountCents;
  }
  return { income, expense, net: income - expense };
};

/** "YYYY-MM" for a local date. */
export const ymOf = (d: Date): string => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

export const inMonth = (tx: Transaction[], ym: string): Transaction[] => tx.filter((t) => t.date.startsWith(ym));
export const inYear = (tx: Transaction[], year: number): Transaction[] => tx.filter((t) => t.date.startsWith(`${year}-`));

export const shiftMonth = (ym: string, n: number): string => {
  const [y, m] = ym.split('-').map(Number);
  return ymOf(new Date(y, m - 1 + n, 1));
};

export interface CategoryTotal {
  category: string;
  total: number;
  pct: number;
}

export const byCategory = (tx: Transaction[], kind: TxKind): CategoryTotal[] => {
  const map = new Map<string, number>();
  let sum = 0;
  for (const t of tx) {
    if (t.kind !== kind) continue;
    map.set(t.category, (map.get(t.category) ?? 0) + t.amountCents);
    sum += t.amountCents;
  }
  return [...map.entries()]
    .map(([category, total]) => ({ category, total, pct: sum ? (total / sum) * 100 : 0 }))
    .sort((a, b) => b.total - a.total);
};

export interface DayPoint {
  day: number;
  date: string;
  income: number;
  expense: number;
  balance: number; // running net for the month
}

export const dailySeries = (tx: Transaction[], ym: string): DayPoint[] => {
  const [y, m] = ym.split('-').map(Number);
  const days = new Date(y, m, 0).getDate();
  const inc = new Array(days).fill(0);
  const exp = new Array(days).fill(0);
  for (const t of tx) {
    if (!t.date.startsWith(ym)) continue;
    const i = Number(t.date.slice(8, 10)) - 1;
    if (t.kind === 'income') inc[i] += t.amountCents;
    else exp[i] += t.amountCents;
  }
  let run = 0;
  return inc.map((income, i) => {
    run += income - exp[i];
    return { day: i + 1, date: `${ym}-${String(i + 1).padStart(2, '0')}`, income, expense: exp[i], balance: run };
  });
};

export interface MonthPoint {
  month: number; // 0-11
  income: number;
  expense: number;
  net: number;
}

export const monthlySeries = (tx: Transaction[], year: number): MonthPoint[] => {
  const out: MonthPoint[] = Array.from({ length: 12 }, (_, month) => ({ month, income: 0, expense: 0, net: 0 }));
  for (const t of tx) {
    if (!t.date.startsWith(`${year}-`)) continue;
    const p = out[Number(t.date.slice(5, 7)) - 1];
    if (t.kind === 'income') p.income += t.amountCents;
    else p.expense += t.amountCents;
  }
  out.forEach((p) => (p.net = p.income - p.expense));
  return out;
};

/** Percent change from previous to current. null when there is no baseline. */
export const pctChange = (current: number, previous: number): number | null =>
  previous === 0 ? null : ((current - previous) / previous) * 100;
