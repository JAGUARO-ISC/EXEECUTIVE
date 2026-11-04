import React, { useState } from 'react';
import { IconEye, IconEyeOff, IconSun, IconMoon } from '@tabler/icons-react';
import { useAuth } from '../../stores/auth';
import { useSettings } from '../../stores/settings';
import { useTheme } from '../../hooks/useTheme';
import { useT, LANGS } from '../../i18n';
import type { Lang } from '../../i18n';

type Mode = 'login' | 'register';

export const AuthPage: React.FC = () => {
  const { t } = useT();
  const { setLang } = useSettings.getState();
  const { lang } = useSettings((s) => ({ lang: s.lang }));
  const { login, register } = useAuth.getState();
  const { theme, toggleTheme } = useTheme();

  const [mode, setMode] = useState<Mode>('login');
  const [slideDir, setSlideDir] = useState<'fwd' | 'back'>('fwd');
  const [slideKey, setSlideKey] = useState(0);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const switchMode = (next: Mode) => {
    setSlideDir(next === 'register' ? 'fwd' : 'back');
    setErr('');
    setSlideKey((k) => k + 1);
    setMode(next);
  };

  const validate = (): string | null => {
    if (!email.includes('@')) return t('auth.invalidEmail');
    if (password.length < 6) return t('auth.shortPassword');
    if (mode === 'register' && !displayName.trim()) return t('auth.nameRequired');
    return null;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const valErr = validate();
    if (valErr) { setErr(valErr); return; }
    setBusy(true);
    setErr('');
    const result = mode === 'login'
      ? await login(email, password)
      : await register(email, password, displayName);
    setBusy(false);
    if (result) setErr(result);
  };

  const slideClass = slideDir === 'fwd' ? 'auth-slide-fwd' : 'auth-slide-back';

  return (
    <div className="auth-root">
      {/* Left brand panel */}
      <div className="auth-brand">
        <div className="auth-brand-logo">E</div>
        <h1 className="auth-brand-title">EXECUTIVE</h1>
        <p className="auth-brand-sub">
          {t('nav.dashboard')} · {t('nav.calendar')} · {t('nav.finance')} · {t('nav.tasks')}
        </p>
      </div>

      {/* Right form panel */}
      <div className="auth-form-panel">
        {/* Top-right: theme toggle */}
        <div className="auth-top-bar">
          <button className="icon-btn flat" aria-label={t(theme === 'dark' ? 'theme.dark' : 'theme.light')} onClick={toggleTheme}>
            {theme === 'dark' ? <IconSun size={18} /> : <IconMoon size={18} />}
          </button>
        </div>

        {/* Form */}
        <div key={slideKey} className={`auth-form-wrap ${slideKey > 0 ? slideClass : ''}`}>
          <h2 className="auth-title">
            {mode === 'login' ? t('auth.welcome') : t('auth.createAccount')}
          </h2>
          <p className="auth-sub">
            {mode === 'login' ? t('auth.loginSub') : t('auth.registerSub')}
          </p>

          <form onSubmit={(e) => void submit(e)} noValidate>
            {mode === 'register' && (
              <div className="auth-field">
                <label htmlFor="auth-name">{t('auth.displayName')}</label>
                <input
                  id="auth-name" className="input" type="text" autoComplete="name"
                  placeholder="Mario Rossi"
                  value={displayName} onChange={(e) => setDisplayName(e.currentTarget.value)}
                />
              </div>
            )}

            <div className="auth-field">
              <label htmlFor="auth-email">{t('auth.email')}</label>
              <input
                id="auth-email" className="input" type="email" autoComplete="email"
                placeholder="mario@esempio.it"
                value={email} onChange={(e) => setEmail(e.currentTarget.value)}
              />
            </div>

            <div className="auth-field">
              <label htmlFor="auth-pw">{t('auth.password')}</label>
              <div className="auth-field-wrap">
                <input
                  id="auth-pw" className="input"
                  type={showPw ? 'text' : 'password'}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  placeholder="••••••••"
                  value={password} onChange={(e) => setPassword(e.currentTarget.value)}
                />
                <button type="button" className="auth-eye" aria-label={t(showPw ? 'auth.hidePassword' : 'auth.showPassword')} onClick={() => setShowPw((v) => !v)}>
                  {showPw ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                </button>
              </div>
            </div>

            {err && <p className="auth-err">{err}</p>}

            <button type="submit" className="auth-submit" disabled={busy}>
              {busy ? '…' : t(mode === 'login' ? 'auth.login' : 'auth.register')}
            </button>
          </form>

          <div className="auth-switch">
            {mode === 'login' ? (
              <>{t('auth.noAccount')}{' '}
                <button type="button" onClick={() => switchMode('register')}>{t('auth.register')}</button>
              </>
            ) : (
              <>{t('auth.alreadyHave')}{' '}
                <button type="button" onClick={() => switchMode('login')}>{t('auth.login')}</button>
              </>
            )}
          </div>
        </div>

        {/* Bottom-right: language selector */}
        <select
          className="auth-lang-select"
          value={lang}
          onChange={(e) => void setLang(e.currentTarget.value as Lang)}
          aria-label="Lingua / Language"
        >
          {LANGS.map((l) => (
            <option key={l.code} value={l.code}>{l.name}</option>
          ))}
        </select>
      </div>
    </div>
  );
};
