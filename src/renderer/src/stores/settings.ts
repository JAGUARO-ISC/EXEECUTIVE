import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import type { Lang } from '../i18n';
import type { Rates } from '../utils/currency';

const msg = (e: unknown): string => (typeof e === 'string' ? e : e instanceof Error ? e.message : String(e));

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

interface SettingsStore {
  lang: Lang;
  currency: string;
  rates: Rates;
  ratesDate: string | null;
  advisor: AdvisorInput;
  loaded: boolean;
  load: () => Promise<void>;
  setLang: (l: Lang) => Promise<void>;
  setCurrency: (c: string) => Promise<void>;
  setAdvisor: (a: AdvisorInput) => Promise<void>;
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

export const useSettings = create<SettingsStore>((set, get) => ({
  lang: detectLang(),
  currency: 'EUR',
  rates: {},
  ratesDate: null,
  advisor: DEFAULT_ADVISOR,
  loaded: false,
  load: async () => {
    try {
      const rows = await invoke<[string, string][]>('get_settings');
      const m = Object.fromEntries(rows);
      const lang = LANGS.includes(m.lang as Lang) ? (m.lang as Lang) : get().lang;
      set({
        lang,
        currency: m.currency || 'EUR',
        rates: parse<Rates>(m.rates, {}),
        ratesDate: m.rates_date || null,
        advisor: { ...DEFAULT_ADVISOR, ...parse<Partial<AdvisorInput>>(m.advisor, {}) },
        loaded: true,
      });
    } catch {
      set({ loaded: true }); // fall back to defaults; the data stores report their own errors
    }
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
      set({ rates: json.rates, ratesDate: json.date });
      await save('rates', JSON.stringify(json.rates));
      await save('rates_date', json.date);
      return null;
    } catch (e) {
      return msg(e);
    }
  },
}));
