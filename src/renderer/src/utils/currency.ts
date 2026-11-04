export interface CurrencyInfo {
  code: string;
  symbol: string;
  /** Digits after the decimal point; amounts are stored in the minor unit. */
  decimals: number;
  name: string;
}

export const CURRENCIES: CurrencyInfo[] = [
  { code: 'EUR', symbol: '€', decimals: 2, name: 'Euro' },
  { code: 'USD', symbol: '$', decimals: 2, name: 'US Dollar' },
  { code: 'GBP', symbol: '£', decimals: 2, name: 'British Pound' },
  { code: 'CHF', symbol: 'CHF', decimals: 2, name: 'Swiss Franc' },
  { code: 'JPY', symbol: '¥', decimals: 0, name: 'Japanese Yen' },
  { code: 'CNY', symbol: '¥', decimals: 2, name: 'Chinese Yuan' },
  { code: 'CAD', symbol: 'CA$', decimals: 2, name: 'Canadian Dollar' },
  { code: 'AUD', symbol: 'A$', decimals: 2, name: 'Australian Dollar' },
  { code: 'NZD', symbol: 'NZ$', decimals: 2, name: 'New Zealand Dollar' },
  { code: 'SEK', symbol: 'kr', decimals: 2, name: 'Swedish Krona' },
  { code: 'NOK', symbol: 'kr', decimals: 2, name: 'Norwegian Krone' },
  { code: 'DKK', symbol: 'kr', decimals: 2, name: 'Danish Krone' },
  { code: 'PLN', symbol: 'zł', decimals: 2, name: 'Polish Zloty' },
  { code: 'CZK', symbol: 'Kč', decimals: 2, name: 'Czech Koruna' },
  { code: 'HUF', symbol: 'Ft', decimals: 2, name: 'Hungarian Forint' },
  { code: 'RON', symbol: 'lei', decimals: 2, name: 'Romanian Leu' },
  { code: 'TRY', symbol: '₺', decimals: 2, name: 'Turkish Lira' },
  { code: 'INR', symbol: '₹', decimals: 2, name: 'Indian Rupee' },
  { code: 'BRL', symbol: 'R$', decimals: 2, name: 'Brazilian Real' },
  { code: 'MXN', symbol: 'MX$', decimals: 2, name: 'Mexican Peso' },
  { code: 'ZAR', symbol: 'R', decimals: 2, name: 'South African Rand' },
  { code: 'SGD', symbol: 'S$', decimals: 2, name: 'Singapore Dollar' },
  { code: 'HKD', symbol: 'HK$', decimals: 2, name: 'Hong Kong Dollar' },
  { code: 'KRW', symbol: '₩', decimals: 0, name: 'South Korean Won' },
  { code: 'ILS', symbol: '₪', decimals: 2, name: 'Israeli Shekel' },
  { code: 'THB', symbol: '฿', decimals: 2, name: 'Thai Baht' },
  { code: 'IDR', symbol: 'Rp', decimals: 2, name: 'Indonesian Rupiah' },
  { code: 'MYR', symbol: 'RM', decimals: 2, name: 'Malaysian Ringgit' },
  { code: 'PHP', symbol: '₱', decimals: 2, name: 'Philippine Peso' },
  { code: 'ISK', symbol: 'kr', decimals: 0, name: 'Icelandic Krona' },
];

export const currencyInfo = (code: string): CurrencyInfo =>
  CURRENCIES.find((c) => c.code === code) ?? { code, symbol: code, decimals: 2, name: code };

/** 10^decimals: how many minor units make one whole unit. */
export const minorFactor = (code: string): number => 10 ** currencyInfo(code).decimals;

const cache = new Map<string, Intl.NumberFormat>();
const formatter = (locale: string, code: string, whole: boolean): Intl.NumberFormat => {
  const key = `${locale}|${code}|${whole}`;
  let f = cache.get(key);
  if (!f) {
    const d = currencyInfo(code).decimals;
    f = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: code,
      useGrouping: true,
      minimumFractionDigits: whole ? 0 : d,
      maximumFractionDigits: whole ? 0 : d,
    });
    cache.set(key, f);
  }
  return f;
};

/** Minor units -> "1.234,56 €" in the given locale and currency. */
export const formatMoney = (minor: number, code: string, locale: string, whole = false): string =>
  formatter(locale, code, whole).format(minor / minorFactor(code));

/**
 * "12,50", "12.50", "1.234,56", "1,234.56", "€ 8" -> minor units of `code`.
 * Returns null if invalid or <= 0. Rejects more decimals than the currency allows.
 */
export function parseMinor(input: string, code: string): number | null {
  const s = input.trim().replace(/[^\d.,]/g, '');
  if (!s) return null;
  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');
  const decimals = currencyInfo(code).decimals;
  let intPart = s;
  let frac = '';
  const sep = Math.max(lastDot, lastComma);
  if (sep !== -1) {
    const after = s.slice(sep + 1);
    const only = s.split(s[sep]).length - 1 === 1;
    // The last separator is a decimal mark when it is followed by 1-2 digits, or when it is the only one of its kind and not a thousands group of exactly 3.
    const isDecimal = decimals > 0 && only && after.length > 0 && after.length <= decimals;
    if (isDecimal) {
      intPart = s.slice(0, sep);
      frac = after;
    } else if (after.length === 3 && only) {
      intPart = s; // thousands group like 1.234 or 1,234
    } else if (!only || after.length !== 3) {
      return null;
    }
  }
  intPart = intPart.replace(/[.,]/g, '');
  if (!/^\d+$/.test(intPart) || (frac && !/^\d+$/.test(frac))) return null;
  const whole = Number(intPart) * 10 ** decimals;
  const minor = whole + (frac ? Number(frac.padEnd(decimals, '0')) : 0);
  return Number.isSafeInteger(minor) && minor > 0 ? minor : null;
}

/** Minor units -> editable text such as "1234,56" (comma decimal like the Italian default). */
export const minorToInput = (minor: number, code: string, locale: string): string => {
  const d = currencyInfo(code).decimals;
  const text = (minor / 10 ** d).toFixed(d);
  return locale.startsWith('en') ? text : text.replace('.', ',');
};

export type Rates = Record<string, number>;

/**
 * Converts minor units between currencies. `rates[X]` = how many X per 1 EUR.
 * Returns null when a needed rate is missing.
 */
export function convertMinor(minor: number, from: string, to: string, rates: Rates): number | null {
  if (from === to) return minor;
  const rf = from === 'EUR' ? 1 : rates[from];
  const rt = to === 'EUR' ? 1 : rates[to];
  if (!rf || !rt) return null;
  const whole = minor / minorFactor(from);
  const eur = whole / rf;
  return Math.round(eur * rt * minorFactor(to));
}
