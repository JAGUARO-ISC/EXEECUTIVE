const fmt = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', useGrouping: true });
const fmtShort = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0, useGrouping: true });

/** Integer cents -> "1.234,56 €". Money is always stored as integer cents. */
export const eur = (cents: number): string => fmt.format(cents / 100);
export const eurShort = (cents: number): string => fmtShort.format(cents / 100);

/** "12,50", "12.50", "1.234,56", "€ 8" -> integer cents. Returns null if invalid or <= 0. */
export function parseAmount(input: string): number | null {
  let s = input.trim().replace(/[€\s]/g, '');
  if (!s) return null;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const cents = Math.round(parseFloat(s) * 100);
  return cents > 0 ? cents : null;
}

export const centsToInput = (cents: number): string => (cents / 100).toFixed(2).replace('.', ',');
