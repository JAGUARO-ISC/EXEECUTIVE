/**
 * Rule-based money guidance. Pure functions: no network, no AI, fully testable.
 * All amounts are minor units of one currency (cents).
 * This is educational guidance, never a personalised recommendation to buy a product.
 */

export type Horizon = 'short' | 'mid' | 'long';
export type Risk = 'low' | 'mid' | 'high';

export interface AdvisorParams {
  balance: number;
  monthlySpend: number; // 0 = unknown
  monthlyIncome: number; // 0 = unknown
  debt: number;
  horizon: Horizon;
  risk: Risk;
  /** Net result of the current month (income - expense), if known. */
  monthNet: number | null;
}

export type StepKey = 'debt' | 'fund' | 'short' | 'mid' | 'long' | 'auto' | 'costs' | 'idle' | 'negative' | 'diversify';

export interface Step {
  key: StepKey;
  /** Amount this step is about, when relevant (minor units). */
  amount?: number;
  months?: number;
  target?: number;
  tone: 'urgent' | 'do' | 'info';
}

export interface Allocation {
  key: 'emergency' | 'debt' | 'safe' | 'bonds' | 'stocks' | 'spend';
  amount: number;
  pct: number;
}

export const EMERGENCY_MONTHS = 6;

export const monthsCovered = (balance: number, monthlySpend: number): number | null => (monthlySpend > 0 ? balance / monthlySpend : null);

/** Target mix of the investable part, by horizon and risk. Always sums to 100. */
export function investMix(horizon: Horizon, risk: Risk): { safe: number; bonds: number; stocks: number } {
  if (horizon === 'short') return { safe: 100, bonds: 0, stocks: 0 };
  const table: Record<'mid' | 'long', Record<Risk, [number, number, number]>> = {
    mid: { low: [50, 40, 10], mid: [30, 45, 25], high: [15, 40, 45] },
    long: { low: [30, 40, 30], mid: [10, 30, 60], high: [5, 15, 80] },
  };
  const [safe, bonds, stocks] = table[horizon][risk];
  return { safe, bonds, stocks };
}

export function buildPlan(p: AdvisorParams): { steps: Step[]; allocation: Allocation[]; months: number | null; fundTarget: number } {
  const steps: Step[] = [];
  const months = monthsCovered(p.balance, p.monthlySpend);
  const fundTarget = p.monthlySpend > 0 ? p.monthlySpend * EMERGENCY_MONTHS : 0;

  if (p.monthNet !== null && p.monthNet < 0) steps.push({ key: 'negative', tone: 'urgent' });
  if (p.debt > 0) steps.push({ key: 'debt', amount: Math.min(p.debt, p.balance), tone: 'urgent' });

  let afterDebt = Math.max(0, p.balance - Math.min(p.debt, p.balance));
  let fundAmount = 0;
  if (fundTarget > 0) {
    fundAmount = Math.min(afterDebt, fundTarget);
    steps.push({ key: 'fund', amount: fundAmount, months: months ?? undefined, target: fundTarget, tone: afterDebt >= fundTarget ? 'info' : 'do' });
  }
  const investable = Math.max(0, afterDebt - fundAmount);

  if (investable > 0) {
    steps.push({ key: p.horizon, amount: investable, tone: 'do' });
    steps.push({ key: 'auto', tone: 'do' });
    if (p.horizon !== 'short') steps.push({ key: 'costs', tone: 'info' });
    if (p.risk !== 'low' && p.horizon !== 'short') steps.push({ key: 'diversify', tone: 'info' });
  }
  if (fundTarget > 0 && p.balance > fundTarget * 2) steps.push({ key: 'idle', tone: 'info' });

  // Allocation of the whole balance, in priority order. Rounded so the parts sum exactly.
  const parts: { key: Allocation['key']; amount: number }[] = [];
  const debtPaid = Math.min(p.debt, p.balance);
  if (debtPaid > 0) parts.push({ key: 'debt', amount: debtPaid });
  if (fundAmount > 0) parts.push({ key: 'emergency', amount: fundAmount });
  if (investable > 0) {
    const mix = investMix(p.horizon, p.risk);
    const safe = Math.round((investable * mix.safe) / 100);
    const bonds = Math.round((investable * mix.bonds) / 100);
    const stocks = investable - safe - bonds;
    if (safe > 0) parts.push({ key: 'safe', amount: safe });
    if (bonds > 0) parts.push({ key: 'bonds', amount: bonds });
    if (stocks > 0) parts.push({ key: 'stocks', amount: stocks });
  }
  const total = parts.reduce((s, x) => s + x.amount, 0) || 1;
  const allocation = parts.map((x) => ({ ...x, pct: (x.amount / total) * 100 }));
  return { steps, allocation, months, fundTarget };
}

/** Future value with a fixed monthly contribution and monthly compounding. */
export function projectGrowth(initial: number, monthly: number, annualRatePct: number, years: number): { year: number; value: number; contributed: number }[] {
  const r = annualRatePct / 100 / 12;
  const out: { year: number; value: number; contributed: number }[] = [];
  let v = initial;
  for (let m = 1; m <= years * 12; m++) {
    v = v * (1 + r) + monthly;
    if (m % 12 === 0) out.push({ year: m / 12, value: Math.round(v), contributed: initial + monthly * m });
  }
  return out;
}

/** Suggested hypothetical yearly return range label for the chosen mix, percent. */
export const assumedRate = (horizon: Horizon, risk: Risk): number => {
  const m = investMix(horizon, risk);
  return Math.round((m.safe * 2.0 + m.bonds * 3.5 + m.stocks * 6.0) / 100 * 10) / 10;
};

export interface CutTip {
  category: string;
  total: number;
  pct: number;
  cutPct: number;
  save: number;
}

/** Which categories to trim, using spending over the given transactions (already converted). */
export function spendingCuts(expenseByCategory: { category: string; total: number; pct: number }[], months: number): CutTip[] {
  const essential = new Set(['Bollette', 'Alimentari', 'Trasporti', 'Carburante']);
  const flexible = new Set(['Ristoranti', 'Shopping', 'Abbonamenti', 'Viaggi', 'Personale', 'Altro', 'Business', 'Ufficio']);
  const m = Math.max(1, months);
  return expenseByCategory
    .filter((c) => c.category !== 'Investimenti')
    .slice(0, 4)
    .map((c) => {
      const cutPct = flexible.has(c.category) ? 20 : essential.has(c.category) ? 10 : 15;
      return { category: c.category, total: c.total, pct: c.pct, cutPct, save: Math.round((c.total / m) * (cutPct / 100)) };
    })
    .filter((t) => t.save > 0);
}

/** Share of income saved, as a whole percent. Null when income is zero. */
export const savingsRate = (income: number, expense: number): number | null => (income > 0 ? Math.round(((income - expense) / income) * 100) : null);
