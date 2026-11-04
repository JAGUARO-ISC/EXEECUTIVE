import { useEffect, useState } from 'react';

type Theme = 'dark' | 'light';
const KEY = 'exec_theme';

const apply = (t: Theme) => document.documentElement.setAttribute('data-theme', t);

export const useTheme = () => {
  const [theme, setTheme] = useState<Theme>(() => {
    try { return (localStorage.getItem(KEY) as Theme) || 'dark'; } catch { return 'dark'; }
  });

  useEffect(() => { apply(theme); }, [theme]);

  const toggleTheme = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem(KEY, next); } catch { /* ignore */ }
    setTheme(next);
  };

  return { theme, toggleTheme };
};
