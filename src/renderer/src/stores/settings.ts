import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import type { Lang } from '../i18n';
import type { Rates } from '../utils/currency';
import { errorMessage } from '../utils/errorMessage';
import { appendRatePoint, readRateHistory, writeRateHistory } from '../utils/ratesHistory';

const msg = errorMessage;

export interface AdvisorInput {
  balance: string; // kept as text so the field can be edited freely
  currency: string;
  monthlySpend: string; // empty = derive from transactions
  monthlyIncome: string;
  debt: string;
  horizon: 'short' | 'mid' | 'long';
  risk: 'low' | 'mid' | 'high';
}

export const DEFAULT_ADVISOR: AdvisorInput = { balance: '', currency: '', monthlySpend: '', monthlyIncome: '', debt: '', horizon: 'mid', risk: 'mid' };

export type AccentName = 'orange' | 'lime' | 'blue' | 'violet' | 'red';

export const ACCENT_COLORS: Record<AccentName, { accent: string; soft: string }> = {
  orange: { accent: '#ff6f1a', soft: 'rgba(255,111,26,0.14)' },
  lime:   { accent: '#84cc16', soft: 'rgba(132,204,22,0.14)' },
  blue:   { accent: '#3b82f6', soft: 'rgba(59,130,246,0.14)' },
  violet: { accent: '#8b5cf6', soft: 'rgba(139,92,246,0.14)' },
  red:    { accent: '#ef4444', soft: 'rgba(239,68,68,0.14)' },
};

export const ACCENT_HEX: Record<AccentName, string> = {
  orange: '#ff6f1a', lime: '#84cc16', blue: '#3b82f6', violet: '#8b5cf6', red: '#ef4444',
};

export const applyAccent = (name: AccentName) => {
  const a = ACCENT_COLORS[name] ?? ACCENT_COLORS.orange;
  document.documentElement.style.setProperty('--accent', a.accent);
  document.documentElement.style.setProperty('--accent-soft', a.soft);
};

interface SettingsStore {
  lang: Lang;
  currency: string;
  rates: Rates;
  ratesDate: string | null;
  ratesHistory: Record<string, { date: string; rate: number }[]>;
  advisor: AdvisorInput;
  accent: AccentName;
  loaded: boolean;
  load: () => Promise<void>;
  setLang: (l: Lang) => Promise<void>;
  setCurrency: (c: string) => Promise<void>;
  setAdvisor: (a: AdvisorInput) => Promise<void>;
  setAccent: (a: AccentName) => Promise<void>;
  refreshRates: () => Promise<string | null>;
}

const save = (key: string, value: string) => invoke('set_setting', { key, value });

const LANGS: Lang[] = ['it', 'en', 'es', 'fr', 'de'];

/** Picks a starting language from the OS, defaulting to Italian. */
const detectLang = (): Lang => {
  const n = (navigator.language || 'it').slice(0, 2).toLowerCase() as Lang;
  return LANGS.includes(n) ? n : 'it';
};

const parse = <T,>(s: string | undefined, fallback: T): T => {
  if (!s) return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
};

const ACCENT_NAMES: AccentName[] = ['orange', 'lime', 'blue', 'violet', 'red'];
const isAccentName = (s: string): s is AccentName => ACCENT_NAMES.includes(s as AccentName);

export const useSettings = create<SettingsStore>((set, get) => ({
  lang: detectLang(),
  currency: 'EUR',
  rates: {},
  ratesDate: null,
  ratesHistory: {},
  advisor: DEFAULT_ADVISOR,
  accent: 'orange',
  loaded: false,
  load: async () => {
    try {
      const rows = await invoke<[string, string][]>('get_settings');
      const m = Object.fromEntries(rows);
      const lang = LANGS.includes(m.lang as Lang) ? (m.lang as Lang) : get().lang;
      const accent = isAccentName(m.accent) ? m.accent : 'orange';
      applyAccent(accent);
      set({
        lang,
        currency: m.currency || 'EUR',
        rates: parse<Rates>(m.rates, {}),
        ratesDate: m.rates_date || null,
        ratesHistory: parse<Record<string, { date: string; rate: number }[]>>(m.rates_history, {}),
        advisor: { ...DEFAULT_ADVISOR, ...parse<Partial<AdvisorInput>>(m.advisor, {}) },
        accent,
        loaded: true,
      });
    } catch {
      set({ loaded: true }); // fall back to defaults; the data stores report their own errors
    }
  },
  setAccent: async (accent) => {
    applyAccent(accent);
    set({ accent });
    await save('accent', accent).catch(() => undefined);
  },
  setLang: async (lang) => {
    set({ lang });
    await save('lang', lang).catch(() => undefined);
  },
  setCurrency: async (currency) => {
    set({ currency });
    await save('currency', currency).catch(() => undefined);
  },
  setAdvisor: async (advisor) => {
    set({ advisor });
    await save('advisor', JSON.stringify(advisor)).catch(() => undefined);
  },
  /** Fetches ECB rates (per 1 EUR). Resolves to null on success or an error message. */
  refreshRates: async () => {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 10000);
      const res = await fetch('https://api.frankfurter.dev/v1/latest?base=EUR', { signal: ctrl.signal });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { date: string; rates: Rates };
      if (!json.rates || typeof json.rates !== 'object') throw new Error('risposta non valida');
      const previous = get().ratesHistory;
      const ratesHistory = Object.fromEntries(Object.entries(json.rates).map(([code, rate]) => [code, appendRatePoint(previous[code] ?? [], { date: json.date, rate })]));
      set({ rates: json.rates, ratesDate: json.date, ratesHistory });
      await save('rates', JSON.stringify(json.rates));
      await save('rates_date', json.date);
      await save('rates_history', JSON.stringify(ratesHistory));
      writeRateHistory('exec_rates_history', appendRatePoint(readRateHistory('exec_rates_history'), { date: json.date, rate: json.rates.USD ?? 0 }));
      return null;
    } catch (e) {
      return msg(e);
    }
  },
}));
