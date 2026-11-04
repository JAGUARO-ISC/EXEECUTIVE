import { useSettings } from '../stores/settings';
import it from './it';
import en from './en';
import es from './es';
import fr from './fr';
import de from './de';

export type Lang = 'it' | 'en' | 'es' | 'fr' | 'de';
export type Dict = Record<string, string>;

export const LANGS: { code: Lang; name: string; locale: string }[] = [
  { code: 'it', name: 'Italiano', locale: 'it-IT' },
  { code: 'en', name: 'English', locale: 'en-GB' },
  { code: 'es', name: 'Español', locale: 'es-ES' },
  { code: 'fr', name: 'Français', locale: 'fr-FR' },
  { code: 'de', name: 'Deutsch', locale: 'de-DE' },
];

const DICTS: Record<Lang, Dict> = { it, en, es, fr, de };

export const localeOf = (l: Lang): string => LANGS.find((x) => x.code === l)?.locale ?? 'it-IT';

/** Looks up a key and fills {name} placeholders. Falls back to Italian, then to the key itself. */
export function translate(lang: Lang, key: string, vars?: Record<string, string | number>): string {
  let s = DICTS[lang][key] ?? it[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}

/** Non-hook access for code that runs outside React (store actions, tray labels). */
export const t = (key: string, vars?: Record<string, string | number>): string => translate(useSettings.getState().lang, key, vars);

/** Re-renders the component when the language changes. */
export function useT() {
  const lang = useSettings((s) => s.lang);
  return {
    lang,
    locale: localeOf(lang),
    t: (key: string, vars?: Record<string, string | number>) => translate(lang, key, vars),
  };
}

/** Stored category names are canonical Italian; this shows them in the current language. */
export function useCat() {
  const { t } = useT();
  return (name: string): string => {
    const k = `cat.${name}`;
    const v = t(k);
    return v === k ? name : v;
  };
}

export const missingKeys = (lang: Lang): string[] => Object.keys(it).filter((k) => !(k in DICTS[lang]));
