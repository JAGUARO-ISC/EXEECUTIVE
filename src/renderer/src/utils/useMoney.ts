import { useMemo } from 'react';
import { useSettings } from '../stores/settings';
import { useTxStore } from '../stores';
import { useT } from '../i18n';
import { convertMinor, formatMoney } from './currency';
import type { Transaction } from '../types';

/**
 * Everything money-related for components: formatting in the default currency, and the
 * transaction list with every amount converted into that currency.
 *
 * Converted amounts are only for totals and charts. Each transaction keeps its own
 * currency in the database and is shown in that currency in lists.
 */
export function useMoney() {
  const currency = useSettings((s) => s.currency);
  const rates = useSettings((s) => s.rates);
  const { locale } = useT();
  const raw = useTxStore((s) => s.items);

  const fmt = (minor: number, whole = false) => formatMoney(minor, currency, locale, whole);
  const fmtIn = (minor: number, code: string) => formatMoney(minor, code, locale);

  const { tx, skipped } = useMemo(() => {
    const out: Transaction[] = [];
    let skipped = 0;
    for (const t of raw) {
      const c = convertMinor(t.amountCents, t.currency, currency, rates);
      if (c === null || c <= 0) {
        skipped++;
        continue;
      }
      out.push({ ...t, amountCents: c, currency });
    }
    return { tx: out, skipped };
  }, [raw, currency, rates]);

  return { currency, rates, locale, fmt, fmtIn, tx, skipped, rawCount: raw.length };
}
