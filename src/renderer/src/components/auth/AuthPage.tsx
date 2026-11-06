import React, { useEffect, useState } from 'react';
import { IconEye, IconEyeOff, IconSun, IconMoon } from '@tabler/icons-react';
import { useAuth } from '../../stores/auth';
import { useSettings } from '../../stores/settings';
import { useTheme } from '../../hooks/useTheme';
import { useT, LANGS } from '../../i18n';
import type { Lang } from '../../i18n';

type Mode = 'login' | 'register' | 'recovery' | 'confirm';

export const AuthPage: React.FC = () => {
  const { t } = useT();
  const { setLang } = useSettings.getState();
  const { lang } = useSettings((s) => ({ lang: s.lang }));
  const { login, register, requestRecovery, resendConfirmation } = useAuth.getState();
  const resendAvailableAt = useAuth((state) => state.resendAvailableAt);
  const { theme, toggleTheme } = useTheme();

  const [mode, setMode] = useState<Mode>('login');
  const [slideDir, setSlideDir] = useState<'fwd' | 'back'>('fwd');
  const [slideKey, setSlideKey] = useState(0);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [recoverySent, setRecoverySent] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (Date.now() >= resendAvailableAt) return;
    const interval = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(interval);
  }, [resendAvailableAt]);

  const switchMode = (next: Mode) => {
    setSlideDir(next === 'register' ? 'fwd' : 'back');
    setErr('');
    setRecoverySent(false);
    setConfirmationSent(false);
    setSlideKey((k) => k + 1);
    setMode(next);
  };

  const validate = (): string | null => {
    if (!email.includes('@')) return t('auth.invalidEmail');
    if (mode === 'recovery' || mode === 'confirm') return null;
    if (password.length < 6) return t('auth.shortPassword');
    if (mode === 'register' && (!firstName.trim() || !lastName.trim())) return t('auth.nameRequired');
    return null;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const valErr = validate();
    if (valErr) { setErr(valErr); return; }
    setBusy(true);
    setErr('');
    const result = mode === 'login'
      ? await login(email, password, rememberMe)
      : mode === 'register'
        ? await register(email, password, firstName, lastName, rememberMe)
        : await requestRecovery(email);
    setBusy(false);
    if (result) setErr(result);
    else if (mode === 'recovery') setRecoverySent(true);
    else if (mode === 'register') { setConfirmationSent(true); setMode('confirm'); }
  };

  const slideClass = slideDir === 'fwd' ? 'auth-slide-fwd' : 'auth-slide-back';
  const resendSeconds = Math.max(0, Math.ceil((resendAvailableAt - now) / 1_000));
  const resend = async () => {
    setBusy(true);
    const result = await resendConfirmation(email);
    setBusy(false);
    setNow(Date.now());
    if (result) setErr(result);
  };

  return (
    <div className="auth-root">
      {/* Left brand panel */}
      <div className="auth-brand">
        <div className="auth-brand-logo">E</div>
        <h1 className="auth-brand-title">EXEECUTIVE</h1>
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
            {mode === 'login' ? t('auth.welcome') : mode === 'register' ? t('auth.createAccount') : mode === 'confirm' ? 'Conferma la tua email' : t('auth.recoveryTitle')}
          </h2>
          <p className="auth-sub">
            {mode === 'login' ? t('auth.loginSub') : mode === 'register' ? t('auth.registerSub') : mode === 'confirm' ? 'Apri il link ricevuto via email per attivare l’account.' : t('auth.recoverySub')}
          </p>

          <form onSubmit={(e) => void submit(e)} noValidate>
            {mode === 'register' && (
              <>
                <div className="auth-field">
                  <label htmlFor="auth-first-name">{t('auth.firstName')}</label>
                  <input id="auth-first-name" className="input" type="text" autoComplete="given-name" value={firstName} onChange={(e) => setFirstName(e.currentTarget.value)} />
                </div>
                <div className="auth-field">
                  <label htmlFor="auth-last-name">{t('auth.lastName')}</label>
                  <input id="auth-last-name" className="input" type="text" autoComplete="family-name" value={lastName} onChange={(e) => setLastName(e.currentTarget.value)} />
                </div>
              </>
            )}

            <div className="auth-field">
              <label htmlFor="auth-email">{t('auth.email')}</label>
              <input
                id="auth-email" className="input" type="email" autoComplete="email"
                placeholder="mario@esempio.it"
                value={email} onChange={(e) => setEmail(e.currentTarget.value)}
              />
            </div>

            {mode !== 'recovery' && mode !== 'confirm' && (
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
            )}

            {recoverySent && <p className="auth-success">{t('auth.recoverySent')}</p>}
            {confirmationSent && mode === 'confirm' && (
              <>
                <p className="auth-success">{t('auth.confirmationSent', { email })}</p>
                <button type="button" className="ghost-btn" disabled={busy || resendSeconds > 0} onClick={() => void resend()}>
                  {resendSeconds > 0 ? `${t('auth.resend')} (${resendSeconds}s)` : t('auth.resend')}
                </button>
              </>
            )}
            {err && <p className="auth-err">{err}</p>}

            {mode !== 'confirm' && <>
              {mode === 'login' && <label className="auth-check"><input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.currentTarget.checked)} /> {t('auth.rememberMe')}</label>}
              <button type="submit" className="auth-submit" disabled={busy}>
                {busy ? '…' : t(mode === 'login' ? 'auth.login' : mode === 'register' ? 'auth.register' : 'auth.sendRecovery')}
              </button>
            </>}
          </form>

          <div className="auth-switch">
            {mode === 'login' ? (
              <>
                <button type="button" onClick={() => switchMode('recovery')}>{t('auth.forgotPassword')}</button>
                <br />
                {t('auth.noAccount')}{' '}
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
