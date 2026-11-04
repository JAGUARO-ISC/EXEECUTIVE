# Mega Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Login/Registration, currency converter, Windows notifications, calendar templates (Kalendo-style), accent color picker, number count-up animations, animated charts, "altro specifica" UX everywhere, and dark/light mode toggle.

**Architecture:** All features are frontend-only except Login (new Rust `auth.rs` + `users` table in SQLite). Auth uses a local account stored in the same SQLite DB — no network, no JWT, bcrypt-hashed password. The app shows a full-screen Login/Register screen before mounting the main layout when no session exists; session stored in `localStorage`. Accent color, theme mode, and calendar template are stored in settings (SQLite via `set_setting`). Count-up animations use a shared `useCountUp` hook with `requestAnimationFrame`. Charts already have `isAnimationActive` from Recharts — extend the `useChartAnim` hook.

**Tech Stack:** Rust + rusqlite + bcrypt crate (backend auth), React 18, Zustand, Mantine v7, Recharts, Tauri v2, TypeScript, existing CSS custom property system.

**Spec:** This document is the spec.

## Global Constraints

- Accent color CSS variable: `--accent` on `:root`. All buttons/highlights already use it. Changing the accent means updating `--accent` and `--accent-soft` only.
- Dark/light mode: add `data-theme` attribute on `<html>`. CSS already guards with `:root:not([data-theme="light"])` pattern — extend it.
- All text user-visible Italian stays in `src/renderer/src/i18n/it.ts` (and parallel files for other langs).
- No new npm packages except `bcrypt` on Rust side (already common in Tauri projects). Frontend uses only packages already in `package.json`.
- Login screen language selector uses existing `LANGS` array from `i18n/index.ts`.
- "Altro specifica" pattern: when category/field value is `'Altro'` or ends with `' - '`, show inline `<input>` for detail; store as `"Altro: <detail>"` if filled, `"Altro"` if empty.
- Calendar template selector: 3 templates — `'default'` (current month grid), `'week-focus'` (week view default), `'agenda'` (list-style). Stored in settings key `'calendar_template'`.
- Accent palette: `orange` (#ff6f1a, default), `lime` (#84cc16), `blue` (#3b82f6), `violet` (#8b5cf6), `red` (#ef4444). Stored as settings key `'accent'`.

## Review Focus

- Login with wrong password must not reveal whether the email exists.
- Session must be cleared on logout; navigating back must not re-enter the app.
- Count-up must not run on hidden/off-screen elements (use IntersectionObserver).
- Accent color change must apply immediately to all open modals and panels without reload.
- Calendar template change must persist across hard refresh (read from settings on boot).

---

## Task 1: Auth — Rust backend (users table + hash)

**Files:**
- Create: `src-tauri/src/auth.rs`
- Modify: `src-tauri/src/db.rs` (add `users` table to SCHEMA, add `migrate` call)
- Modify: `src-tauri/src/lib.rs` (register auth commands)
- Modify: `src-tauri/Cargo.toml` (add `bcrypt = "0.15"`)

**Interfaces:**
- Produces:
  - `auth::register(db, email: String, password: String, display_name: String) -> Result<i64, String>` (returns user id)
  - `auth::login(db, email: String, password: String) -> Result<AuthUser, String>`
  - `AuthUser { id: i64, email: String, display_name: String }`

- [ ] **Step 1: Add `bcrypt` to Cargo.toml**

In `src-tauri/Cargo.toml` under `[dependencies]`:
```toml
bcrypt = "0.15"
```

- [ ] **Step 2: Add `users` table to SCHEMA in `db.rs`**

Add after the `goals` table block:
```sql
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    display_name TEXT NOT NULL DEFAULT '',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

- [ ] **Step 3: Create `auth.rs`**

```rust
use crate::db::Db;
use bcrypt::{hash, verify, DEFAULT_COST};
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AuthUser {
    pub id: i64,
    pub email: String,
    pub display_name: String,
}

#[tauri::command]
pub fn register(db: State<Db>, email: String, password: String, display_name: String) -> Result<AuthUser, String> {
    // hash then insert; return AuthUser on success
    let hash = hash(&password, DEFAULT_COST).map_err(|e| e.to_string())?;
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO users (email, password_hash, display_name) VALUES (?1, ?2, ?3)",
        rusqlite::params![email.trim().to_lowercase(), hash, display_name.trim()],
    ).map_err(|e| if e.to_string().contains("UNIQUE") { "Email già registrata".to_string() } else { e.to_string() })?;
    let id = conn.last_insert_rowid();
    Ok(AuthUser { id, email: email.trim().to_lowercase(), display_name: display_name.trim().to_string() })
}

#[tauri::command]
pub fn login(db: State<Db>, email: String, password: String) -> Result<AuthUser, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let result: Result<(i64, String, String), _> = conn.query_row(
        "SELECT id, password_hash, display_name FROM users WHERE email = ?1 COLLATE NOCASE",
        rusqlite::params![email.trim().to_lowercase()],
        |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
    );
    match result {
        Ok((id, hash, display_name)) => {
            if verify(&password, &hash).unwrap_or(false) {
                Ok(AuthUser { id, email: email.trim().to_lowercase(), display_name })
            } else {
                Err("Credenziali non valide".to_string())
            }
        }
        Err(_) => Err("Credenziali non valide".to_string()), // don't reveal email existence
    }
}

#[tauri::command]
pub fn get_current_user(db: State<Db>, user_id: i64) -> Result<AuthUser, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.query_row(
        "SELECT id, email, display_name FROM users WHERE id = ?1",
        rusqlite::params![user_id],
        |r| Ok(AuthUser { id: r.get(0)?, email: r.get(1)?, display_name: r.get(2)? }),
    ).map_err(|e| e.to_string())
}
```

- [ ] **Step 4: Register commands in `lib.rs`**

Add `mod auth;` at top. Add to `invoke_handler!`:
```rust
auth::register,
auth::login,
auth::get_current_user,
```

- [ ] **Step 5: `cargo check` passes**

Run: `cd executive && cargo check --manifest-path src-tauri/Cargo.toml`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/auth.rs src-tauri/src/lib.rs src-tauri/src/db.rs src-tauri/Cargo.toml
git commit -m "feat(auth): add users table and register/login Rust commands"
```

---

## Task 2: Auth store + session (frontend)

**Files:**
- Create: `src/renderer/src/stores/auth.ts`
- Modify: `src/renderer/src/i18n/it.ts` (add `auth.*` keys)
- Modify: other lang files `en.ts`, `es.ts`, `fr.ts`, `de.ts`

**Interfaces:**
- Produces:
  - `useAuth` Zustand store: `{ user: AuthUser|null, loaded: boolean, login, register, logout }`
  - `AuthUser = { id: number, email: string, displayName: string }`
  - Session key: `localStorage` key `'exec_user_id'` stores `string(user.id)`

- [ ] **Step 1: Create `stores/auth.ts`**

```typescript
import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';

export interface AuthUser { id: number; email: string; displayName: string; }

interface AuthStore {
  user: AuthUser | null;
  loaded: boolean;
  load: () => Promise<void>;
  login: (email: string, password: string) => Promise<string | null>;
  register: (email: string, password: string, displayName: string) => Promise<string | null>;
  logout: () => void;
}

const SESSION_KEY = 'exec_user_id';

export const useAuth = create<AuthStore>((set) => ({
  user: null,
  loaded: false,
  load: async () => {
    try {
      const id = localStorage.getItem(SESSION_KEY);
      if (!id) { set({ loaded: true }); return; }
      const user = await invoke<AuthUser>('get_current_user', { userId: Number(id) });
      set({ user, loaded: true });
    } catch {
      localStorage.removeItem(SESSION_KEY);
      set({ loaded: true });
    }
  },
  login: async (email, password) => {
    try {
      const user = await invoke<AuthUser>('login', { email, password });
      localStorage.setItem(SESSION_KEY, String(user.id));
      set({ user });
      return null;
    } catch (e) { return String(e); }
  },
  register: async (email, password, displayName) => {
    try {
      const user = await invoke<AuthUser>('register', { email, password, displayName });
      localStorage.setItem(SESSION_KEY, String(user.id));
      set({ user });
      return null;
    } catch (e) { return String(e); }
  },
  logout: () => {
    localStorage.removeItem(SESSION_KEY);
    set({ user: null });
  },
}));
```

- [ ] **Step 2: Add i18n keys**

Add to `it.ts` (and equivalent translations to other lang files):
```typescript
'auth.login': 'Accedi',
'auth.register': 'Crea account',
'auth.email': 'Email',
'auth.password': 'Password',
'auth.displayName': 'Il tuo nome',
'auth.alreadyHave': 'Hai già un account?',
'auth.noAccount': 'Non hai un account?',
'auth.logout': 'Esci dall\'account',
'auth.welcome': 'Bentornato',
'auth.createAccount': 'Crea il tuo account',
'auth.loginSub': 'Accedi per continuare',
'auth.registerSub': 'Registrati per iniziare',
'auth.invalidEmail': 'Email non valida',
'auth.shortPassword': 'Minimo 6 caratteri',
'auth.nameRequired': 'Inserisci il tuo nome',
```

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/stores/auth.ts src/renderer/src/i18n/
git commit -m "feat(auth): add auth store with session persistence"
```

---

## Task 3: Login/Register screen UI

**Files:**
- Create: `src/renderer/src/components/auth/AuthPage.tsx`
- Create: `src/renderer/src/components/auth/auth.css`
- Modify: `src/renderer/src/main.tsx` (import auth.css)
- Modify: `src/renderer/src/App.tsx` (gate main layout behind auth)

**Interfaces:**
- Consumes: `useAuth` from Task 2
- Consumes: `useSettings` for language, `useT` for translations
- Produces: Full-screen animated login/register component

**Design:**
- Split-screen: left = brand panel (dark, accent logo, tagline), right = form panel
- Form animates in with `m-rise` keyframe (already in motion.css)
- Language dropdown bottom-right of form panel (uses existing `LANGS`)
- Dark/light toggle button top-right of entire screen
- Toggle between login and register with `transform: translateX` slide animation
- Password field has show/hide eye icon
- Error shows as inline red text under submit button

- [ ] **Step 1: Create `auth.css`**

```css
.auth-root {
  display: grid; grid-template-columns: 1fr 1fr; height: 100vh;
  background: var(--bg);
}
@media (max-width: 800px) { .auth-root { grid-template-columns: 1fr; } }

.auth-brand {
  background:
    radial-gradient(600px 400px at 20% 50%, color-mix(in srgb, var(--accent) 25%, transparent), transparent 70%),
    var(--panel);
  display: flex; flex-direction: column; justify-content: center; padding: 60px 48px;
  border-right: 1px solid var(--line);
}
@media (max-width: 800px) { .auth-brand { display: none; } }

.auth-brand-logo {
  width: 56px; height: 56px; border-radius: 18px; background: var(--accent);
  color: #1a0d03; display: grid; place-items: center; font-weight: 800; font-size: 26px;
  margin-bottom: 32px;
}
.auth-brand-title { font-size: 36px; font-weight: 800; margin: 0 0 12px; letter-spacing: -0.03em; }
.auth-brand-sub { font-size: 16px; color: var(--muted); line-height: 1.6; max-width: 36ch; margin: 0; }

.auth-form-panel {
  display: flex; flex-direction: column; justify-content: center; align-items: center;
  padding: 48px 40px; position: relative; overflow: hidden;
}

.auth-form-wrap {
  width: 100%; max-width: 380px;
  animation: m-rise 320ms var(--ease-out) backwards;
}

.auth-top-bar {
  position: absolute; top: 20px; right: 20px; display: flex; gap: 10px;
}

.auth-lang-select {
  position: absolute; bottom: 20px; right: 20px;
  height: 32px; padding: 0 10px; border-radius: 8px;
  background: var(--panel); border: 1px solid var(--line); color: var(--text); font-size: 12px; cursor: pointer;
}

.auth-title { font-size: 26px; font-weight: 700; margin: 0 0 6px; }
.auth-sub { font-size: 14px; color: var(--muted); margin: 0 0 28px; }

.auth-field { display: flex; flex-direction: column; gap: 4px; margin-bottom: 14px; }
.auth-field label { font-size: 13px; font-weight: 600; color: var(--muted); }
.auth-field-wrap { position: relative; }
.auth-field-wrap .input { padding-right: 36px; }
.auth-eye { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: none; border: none; color: var(--muted); cursor: pointer; }

.auth-submit {
  width: 100%; height: 42px; border: none; border-radius: 11px;
  background: var(--accent); color: #1a0d03; font-weight: 700; font-size: 15px; cursor: pointer;
  margin-top: 8px;
  transition: filter 160ms var(--ease-out), transform 160ms var(--ease-out);
}
.auth-submit:hover { filter: brightness(1.08); }
.auth-submit:active { transform: scale(0.98); }
.auth-submit:disabled { opacity: 0.6; cursor: default; }

.auth-err { color: #fb7185; font-size: 13px; margin-top: 8px; min-height: 18px; text-align: center; }

.auth-switch { text-align: center; margin-top: 20px; font-size: 13px; color: var(--muted); }
.auth-switch button { background: none; border: none; color: var(--accent); font-weight: 600; cursor: pointer; }

/* slide transition between login and register */
.auth-slide-enter { animation: m-next 220ms var(--ease-out) backwards; }
.auth-slide-enter-back { animation: m-prev 220ms var(--ease-out) backwards; }
```

- [ ] **Step 2: Create `AuthPage.tsx`**

Component signature: `export const AuthPage: React.FC = ()`

Logic:
- State: `mode: 'login'|'register'`, `email`, `password`, `displayName`, `showPw`, `busy`, `err`, `slideDir: 'fwd'|'back'`
- On mode switch: set `slideDir`, then set `mode` after 10ms timeout so animation key changes
- Validation before submit: email must include `@`, password >= 6 chars, displayName required for register
- On submit: call `useAuth().login()` or `useAuth().register()`, set `busy` while pending
- Language selector: calls `setLang(value)` from `useSettings`
- Theme toggle: calls `toggleTheme()` from a new `useTheme()` hook (Task 5)
- Animation class on `auth-form-wrap`: use `key={mode}` to remount and re-animate

- [ ] **Step 3: Gate App.tsx behind auth**

In `App.tsx`, add:
```typescript
const { user, loaded: authLoaded } = useAuth();
useEffect(() => { void useAuth.getState().load(); }, []);
```

Before the `!ready` check, add:
```tsx
if (!authLoaded) return <main className="content"><div className="boot"><div className="boot-mark display">E</div></div></main>;
if (!user) return <AuthPage />;
```

- [ ] **Step 4: Import auth.css in main.tsx**

Add: `import './components/auth/auth.css';`

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/components/auth/ src/renderer/src/App.tsx src/renderer/src/main.tsx
git commit -m "feat(auth): add animated login/register screen"
```

---

## Task 4: Logout button in sidebar

**Files:**
- Modify: `src/renderer/src/components/layout/Sidebar.tsx`

- [ ] **Step 1: Add logout to Sidebar**

Import `useAuth`. In the `.side-foot` section at the bottom, add:
```tsx
<button className="ghost-btn" style={{ fontSize: 12, height: 28 }} onClick={() => useAuth.getState().logout()}>
  <IconLogout size={14} /> {t('auth.logout')}
</button>
```

Import `IconLogout` from `@tabler/icons-react`.

- [ ] **Step 2: Commit**

```bash
git add src/renderer/src/components/layout/Sidebar.tsx
git commit -m "feat(auth): add logout button to sidebar"
```

---

## Task 5: Dark/light mode toggle

**Files:**
- Create: `src/renderer/src/hooks/useTheme.ts`
- Modify: `src/renderer/src/styles/global.css` (add light mode overrides)
- Modify: `src/renderer/src/components/layout/Sidebar.tsx` (add toggle button)

**Interfaces:**
- Produces: `useTheme(): { theme: 'dark'|'light', toggleTheme: () => void }`
- Mechanism: sets `document.documentElement.setAttribute('data-theme', value)` and stores in `localStorage` key `'exec_theme'`

- [ ] **Step 1: Create `hooks/useTheme.ts`**

```typescript
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
    try { localStorage.setItem(KEY, next); } catch {}
    setTheme(next);
  };
  return { theme, toggleTheme };
};
```

- [ ] **Step 2: Add light mode CSS variables**

In `global.css`, add after the `:root` block:
```css
:root[data-theme="light"] {
  --bg: #f4f5f8;
  --panel: #ffffff;
  --panel-2: #eef0f5;
  --line: #d8dae3;
  --line-soft: #e4e6ef;
  --text: #1a1b22;
  --muted: #6b6f7e;
}
```

- [ ] **Step 3: Add toggle to Sidebar**

Import `useTheme`. Add `IconSun`/`IconMoon` from tabler. In `.side-foot`:
```tsx
<button className="icon-btn flat" aria-label="Tema" onClick={toggleTheme} title={theme === 'dark' ? 'Passa al chiaro' : 'Passa al scuro'}>
  {theme === 'dark' ? <IconSun size={16} /> : <IconMoon size={16} />}
</button>
```

- [ ] **Step 4: Persist theme on boot**

In `main.tsx`, before `ReactDOM.createRoot`, add:
```typescript
try {
  const t = localStorage.getItem('exec_theme');
  if (t) document.documentElement.setAttribute('data-theme', t);
} catch {}
```

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/hooks/useTheme.ts src/renderer/src/styles/global.css src/renderer/src/components/layout/Sidebar.tsx src/renderer/src/main.tsx
git commit -m "feat(theme): add dark/light mode toggle with persistence"
```

---

## Task 6: Accent color picker in Settings

**Files:**
- Modify: `src/renderer/src/components/settings/SettingsPage.tsx`
- Modify: `src/renderer/src/stores/settings.ts` (add `accent` field + `setAccent`)
- Modify: `src/renderer/src/styles/pages.css` (add accent picker styles)
- Modify: `src/renderer/src/i18n/it.ts` (add `set.accent*` keys)

**Interfaces:**
- Produces: `useSettings` gains `accent: string`, `setAccent: (a: string) => Promise<void>`
- Accent palette (exact hex values, name, CSS variable):
  - `orange`: `#ff6f1a` (default)
  - `lime`: `#84cc16`
  - `blue`: `#3b82f6`
  - `violet`: `#8b5cf6`
  - `red`: `#ef4444`

- [ ] **Step 1: Add `accent` to settings store**

In `stores/settings.ts`:
- Add `accent: string` to interface (default `'orange'`)
- Add `setAccent: (a: string) => Promise<void>` to interface
- In `load()`, read `m.accent || 'orange'` and set
- Implement `setAccent`: set state + `save('accent', a)` + call `applyAccent(a)`
- Create `applyAccent(name: string)`:
```typescript
const ACCENTS: Record<string, { accent: string; soft: string }> = {
  orange: { accent: '#ff6f1a', soft: 'rgba(255,111,26,0.14)' },
  lime:   { accent: '#84cc16', soft: 'rgba(132,204,22,0.14)' },
  blue:   { accent: '#3b82f6', soft: 'rgba(59,130,246,0.14)' },
  violet: { accent: '#8b5cf6', soft: 'rgba(139,92,246,0.14)' },
  red:    { accent: '#ef4444', soft: 'rgba(239,68,68,0.14)' },
};
export const applyAccent = (name: string) => {
  const a = ACCENTS[name] ?? ACCENTS.orange;
  document.documentElement.style.setProperty('--accent', a.accent);
  document.documentElement.style.setProperty('--accent-soft', a.soft);
};
```
- Call `applyAccent(m.accent || 'orange')` at the end of `load()`

- [ ] **Step 2: Apply accent on boot**

In `main.tsx`, before `ReactDOM.createRoot`, add:
```typescript
try {
  const a = /* read from settings store after load */ 'orange'; // placeholder, actual apply happens in load()
} catch {}
```
Actually: no-op here since `load()` calls `applyAccent`. Nothing needed in main.tsx.

- [ ] **Step 3: Add accent panel to SettingsPage**

After the language panel, add:
```tsx
<Panel title={t('set.accent')} sub={t('set.accentSub')}>
  <div className="accent-grid">
    {(['orange','lime','blue','violet','red'] as const).map((name) => (
      <button key={name} className={`accent-swatch${accent === name ? ' on' : ''}`}
        style={{ '--swatch': ACCENT_COLORS[name] } as React.CSSProperties}
        aria-pressed={accent === name} onClick={() => void setAccent(name)}>
        <span className="accent-dot" />
        <span>{t(`set.accent.${name}`)}</span>
        {accent === name && <IconCheck size={14} style={{ marginLeft: 'auto' }} />}
      </button>
    ))}
  </div>
</Panel>
```

Where `ACCENT_COLORS = { orange: '#ff6f1a', lime: '#84cc16', blue: '#3b82f6', violet: '#8b5cf6', red: '#ef4444' }`.

- [ ] **Step 4: Add accent picker CSS**

```css
.accent-grid { display: flex; flex-direction: column; gap: 6px; }
.accent-swatch {
  display: flex; align-items: center; gap: 10px; height: 38px; padding: 0 14px;
  border: 1px solid var(--line); border-radius: 10px; background: var(--panel-2);
  color: var(--muted); font-size: 13px; font-weight: 600; cursor: pointer; width: 100%;
  transition: border-color 160ms var(--ease-out), color 160ms var(--ease-out);
}
.accent-swatch:hover { border-color: #3a3d49; color: var(--text); }
.accent-swatch.on { border-color: var(--swatch); color: var(--text); }
.accent-dot { width: 14px; height: 14px; border-radius: 50%; background: var(--swatch); flex: none; }
```

- [ ] **Step 5: Add i18n keys**

```typescript
'set.accent': 'Colore principale',
'set.accentSub': 'Colore dei pulsanti e degli accenti',
'set.accent.orange': 'Arancione (default)',
'set.accent.lime': 'Verde lime',
'set.accent.blue': 'Blu',
'set.accent.violet': 'Viola',
'set.accent.red': 'Rosso',
```

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/stores/settings.ts src/renderer/src/components/settings/SettingsPage.tsx src/renderer/src/styles/pages.css src/renderer/src/i18n/
git commit -m "feat(settings): add accent color picker with 5 palette options"
```

---

## Task 7: Count-up animation hook + dashboard wiring

**Files:**
- Create: `src/renderer/src/hooks/useCountUp.ts`
- Modify: `src/renderer/src/components/common/ui.tsx` (use in `Stat`)
- Modify: `src/renderer/src/styles/global.css` (extend `--ease-out` already present — no changes needed)

**Interfaces:**
- Produces: `useCountUp(target: number, duration?: number): number` — returns current animated value

- [ ] **Step 1: Create `hooks/useCountUp.ts`**

```typescript
import { useEffect, useRef, useState } from 'react';

export const useCountUp = (target: number, duration = 800): number => {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number>(0);
  const startRef = useRef<number>(0);
  const startValRef = useRef<number>(0);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setValue(target);
      return;
    }
    const start = performance.now();
    startRef.current = start;
    startValRef.current = value;
    const diff = target - value;

    const tick = (now: number) => {
      const elapsed = now - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(startValRef.current + diff * eased));
      if (progress < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration]);

  return value;
};
```

- [ ] **Step 2: Wire count-up into `Stat` in `ui.tsx`**

The `Stat` component receives `value: string`. Count-up works on numeric values before formatting. Change `Stat` to accept `rawValue?: number` for animation:

```tsx
export const Stat: React.FC<{ label: string; value: string; rawValue?: number; hint?: React.ReactNode; tone?: 'plain'|'accent'|'good'|'bad' }>
```

Inside `Stat`:
```tsx
const animated = useCountUp(rawValue ?? 0, 900);
const display = rawValue !== undefined ? value.replace(/[\d.,]+/, fmt_replace(animated, value)) : value;
```

This is complex to implement generically. Simpler approach: `Stat` receives `countUp?: boolean`. When true, extract digits from `value`, animate them, re-insert. Implementation: use a regex `value.replace(/\d[\d.,]*/,` with the animated integer formatted with the same separator style.

Exact signature:
```tsx
export const Stat: React.FC<{
  label: string; value: string; rawValue?: number;
  hint?: React.ReactNode; tone?: 'plain'|'accent'|'good'|'bad';
}>
```

Inside, before return:
```tsx
const animVal = useCountUp(rawValue ?? 0);
const displayValue = rawValue !== undefined
  ? value.replace(/[-\d][\d\s.,]*/, String(animVal))
  : value;
```

Pass `rawValue={t0.net}` (cents integer, pre-formatting) from DashboardPage and FinancePage callers that already have the raw number. Builder decides which stats get `rawValue` — at minimum the 4 top-level stat cards in Dashboard.

- [ ] **Step 3: Update DashboardPage callers**

In `DashboardPage.tsx`, pass `rawValue` to the 4 `<Stat>` cards:
```tsx
<Stat tone="accent" label={t('dash.balance')} value={fmt(month.net)} rawValue={month.net} hint={...} />
<Stat label={t('dash.income')} value={fmt(month.income)} rawValue={month.income} hint={...} />
<Stat label={t('dash.expense')} value={fmt(month.expense)} rawValue={month.expense} hint={...} />
<Stat label={t('dash.today')} value={fmt(day.net)} rawValue={day.net} hint={...} />
```

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/hooks/useCountUp.ts src/renderer/src/components/common/ui.tsx src/renderer/src/components/dashboard/DashboardPage.tsx
git commit -m "feat(animation): add count-up hook and wire to dashboard stats"
```

---

## Task 8: Animated charts (draw from zero)

**Files:**
- Modify: `src/renderer/src/components/common/ui.tsx` (`useChartAnim`)

Recharts already has `isAnimationActive` and `animationDuration`. The existing `useChartAnim` returns `{ isAnimationActive, animationDuration: 500, animationEasing: 'ease-out' }`. Charts animate on first render automatically. The issue is they may not re-animate on page revisit.

- [ ] **Step 1: Extend `useChartAnim` with page-visit key**

```typescript
export const useChartAnim = () => {
  const reduced = useReducedMotion();
  const [key, setKey] = useState(0);
  useEffect(() => { setKey((k) => k + 1); }, []);
  return {
    key,
    isAnimationActive: !reduced,
    animationDuration: 700,
    animationEasing: 'ease-out' as const,
  };
};
```

Callers spread `{...anim}` onto `<Bar>`, `<Area>`, etc. The `key` prop on the chart container forces remount and re-animation on page entry. Pass it as `key={anim.key}` on the `<ResponsiveContainer>` or `<BarChart>` wrapper.

- [ ] **Step 2: Update all chart callers**

In `FinancePage.tsx` and `DashboardPage.tsx` and `StatsPage.tsx`: add `key={anim.key}` to the outermost Recharts component (e.g. `<BarChart key={anim.key} ...>`).

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/components/common/ui.tsx src/renderer/src/components/finance/FinancePage.tsx src/renderer/src/components/dashboard/DashboardPage.tsx src/renderer/src/components/stats/StatsPage.tsx
git commit -m "feat(animation): charts animate from zero on each page visit"
```

---

## Task 9: "Altro specifica" UX everywhere

**Files:**
- Create: `src/renderer/src/components/common/AltroField.tsx`
- Modify: `src/renderer/src/components/common/modals.tsx` (TransactionModal, TaskModal, NoteModal, GoalModal)
- Modify: `src/renderer/src/i18n/it.ts` (add `common.altroSpecifica`)

**Design:** When a Select has value `'Altro'` (or any category ending with recognized "generic" marker), show a small inline `<input>` below labeled "Specifica (opzionale)". On save: if the input has text, store `"Altro: <text>"`; if empty, store `"Altro"`. On load: if stored value starts with `"Altro: "`, split and pre-fill the input. Display in lists: show just the detail part after `"Altro: "` or `"Altro"` if no detail.

- [ ] **Step 1: Create `AltroField.tsx`**

```tsx
export const AltroField: React.FC<{
  value: string; onChange: (v: string) => void; label?: string;
}> = ({ value, onChange, label }) => (
  <div className="field" style={{ marginTop: -6 }}>
    <span>{label ?? 'Specifica (opzionale)'}</span>
    <input className="input" placeholder="Es. Regalo, Abbonamento..." value={value} onChange={(e) => onChange(e.currentTarget.value)} />
  </div>
);

/** Encode: "Altro: detail" or "Altro" */
export const encodeAltro = (detail: string) => detail.trim() ? `Altro: ${detail.trim()}` : 'Altro';

/** Decode: returns { isAltro: boolean, detail: string } */
export const decodeAltro = (stored: string) => {
  if (stored === 'Altro') return { isAltro: true, detail: '' };
  if (stored.startsWith('Altro: ')) return { isAltro: true, detail: stored.slice(7) };
  return { isAltro: false, detail: '' };
};
```

- [ ] **Step 2: Wire into TransactionModal**

In `modals.tsx`, `TransactionModal`:
- Add state: `const [altroDetail, setAltroDetail] = useState(() => decodeAltro(transaction?.category ?? '').detail);`
- After the category Select, render: `{(category === 'Altro' || category === 'Altre entrate') && <AltroField value={altroDetail} onChange={setAltroDetail} />}`
- On submit, replace `finalCategory = category === OTHER ? custom.trim() : category!` with:
  `const finalCategory = category === OTHER ? custom.trim() : (category === 'Altro' || category === 'Altre entrate') ? encodeAltro(altroDetail) : category!;`
- In transaction list display (`FinancePage.tsx`), show `decodeAltro(x.category).isAltro ? (decodeAltro(x.category).detail || 'Altro') : cat(x.category)`

- [ ] **Step 3: Wire into TaskModal and NoteModal**

Same pattern: when category === 'Altro', show `<AltroField>`, encode on save.

- [ ] **Step 4: Add i18n**

```typescript
'common.altroSpecifica': 'Specifica (opzionale)',
'common.altroPh': 'Es. Regalo, Abbonamento...',
```

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/components/common/AltroField.tsx src/renderer/src/components/common/modals.tsx src/renderer/src/components/finance/FinancePage.tsx src/renderer/src/i18n/
git commit -m "feat(ux): 'Altro specifica' inline detail field everywhere"
```

---

## Task 10: Real-time currency converter

**Files:**
- Create: `src/renderer/src/components/finance/CurrencyConverter.tsx`
- Modify: `src/renderer/src/components/settings/SettingsPage.tsx` (add converter panel)
- Modify: `src/renderer/src/i18n/it.ts` (add `conv.*` keys)

**Design:** Panel in Settings (or accessible from Finance toolbar). Two rows: `amount input` + `from currency Select` → `converted amount display` + `to currency Select`. Conversion uses existing `rates` from `useSettings` (already fetched from ECB). Updates live on any input change. If rate not available, show "Tasso non disponibile".

- [ ] **Step 1: Create `CurrencyConverter.tsx`**

```tsx
export const CurrencyConverter: React.FC = () => {
  const { t } = useT();
  const { rates, currency: defaultCurrency } = useSettings();
  const [amount, setAmount] = useState('');
  const [from, setFrom] = useState(defaultCurrency);
  const [to, setTo] = useState('USD');

  const result = useMemo(() => {
    const n = parseFloat(amount.replace(',', '.'));
    if (isNaN(n)) return null;
    // All rates are vs EUR. Convert: amount → EUR → target
    const toEur = from === 'EUR' ? n : n / (rates[from] ?? NaN);
    const toTarget = to === 'EUR' ? toEur : toEur * (rates[to] ?? NaN);
    return isFinite(toTarget) ? toTarget : null;
  }, [amount, from, to, rates]);

  const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 });

  return (
    <div className="conv-wrap">
      <div className="conv-row">
        <input className="input conv-amount" placeholder="0,00" value={amount} onChange={(e) => setAmount(e.currentTarget.value)} />
        <select className="select" value={from} onChange={(e) => setFrom(e.currentTarget.value)}>
          {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
        </select>
      </div>
      <div className="conv-eq">
        {result !== null
          ? <><b className="conv-result">{fmt(result)}</b> <span className="muted">{to}</span></>
          : <span className="muted">{t('conv.noRate')}</span>}
      </div>
      <div className="conv-row">
        <select className="select" value={to} onChange={(e) => setTo(e.currentTarget.value)}>
          {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
        </select>
      </div>
    </div>
  );
};
```

Add CSS:
```css
.conv-wrap { display: flex; flex-direction: column; gap: 10px; }
.conv-row { display: flex; gap: 10px; align-items: center; }
.conv-amount { flex: 1; }
.conv-eq { text-align: center; padding: 8px 0; font-size: 20px; }
.conv-result { font-size: 28px; font-weight: 700; }
```

- [ ] **Step 2: Add panel to SettingsPage**

After the rates panel, add:
```tsx
<Panel title={t('conv.title')} sub={t('conv.sub')}>
  <div style={{ padding: '0 20px 20px' }}>
    <CurrencyConverter />
  </div>
</Panel>
```

- [ ] **Step 3: Add i18n**

```typescript
'conv.title': 'Convertitore valute',
'conv.sub': 'Conversione in tempo reale con i tassi caricati',
'conv.noRate': 'Tasso non disponibile — aggiorna i tassi',
```

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/components/finance/CurrencyConverter.tsx src/renderer/src/components/settings/SettingsPage.tsx src/renderer/src/i18n/
git commit -m "feat(finance): add real-time currency converter in Settings"
```

---

## Task 11: Calendar template picker (Kalendo-style)

**Files:**
- Create: `src/renderer/src/components/calendar/CalendarAgendaView.tsx`
- Modify: `src/renderer/src/components/calendar/CalendarPage.tsx` (add template switcher)
- Modify: `src/renderer/src/stores/settings.ts` (add `calendarTemplate` field)
- Modify: `src/renderer/src/i18n/it.ts`

**Templates:**
- `'month'` — current month grid (default, existing `CalendarMonthView`)
- `'week'` — week view (existing `CalendarWeekView`)
- `'agenda'` — new list view, days as headers, events listed below, Kalendo-style

**Kalendo-style design for agenda view:** Days as sticky section headers (`Wed 11 ● 3 events`), events as cards with time range, colored left border, title, location. No grid — pure vertical scroll.

- [ ] **Step 1: Add `calendarTemplate` to settings store**

Same pattern as `accent`: add `calendarTemplate: 'month'|'week'|'agenda'` defaulting to `'month'`. Add `setCalendarTemplate` action. Persist via `set_setting('calendar_template', value)`.

- [ ] **Step 2: Create `CalendarAgendaView.tsx`**

Props: `{ appointments: OccurrenceItem[], onOpen: (appt, date) => void }`

Groups occurrences by date (next 60 days from today). For each day with events: render a sticky day header, then each event as a card:
```tsx
<div className="agenda-day-head">
  <b>{dayLabel}</b>
  <span className="muted">{count} appuntamenti</span>
</div>
<button className="agenda-event" style={{ '--c': color }} onClick={onOpen}>
  <div className="agenda-bar" />
  <div className="agenda-event-body">
    <div className="agenda-time">{start} - {end}</div>
    <div className="agenda-title">{title}</div>
    {location && <div className="agenda-loc muted">{location}</div>}
  </div>
</button>
```

CSS for agenda: `.agenda-day-head` with `position: sticky; top: 0; background: var(--bg)`. `.agenda-event` with `display: flex; border-radius: 10px; overflow: hidden; border: 1px solid var(--line)`. `.agenda-bar` with `width: 4px; background: var(--c)`.

- [ ] **Step 3: Add template switcher to CalendarPage**

In the toolbar, replace or extend the existing view segmented control with a second segmented control or dropdown for template. When template is `'agenda'`, render `<CalendarAgendaView>` instead of the view-based component. Persist selection via `setCalendarTemplate`.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/components/calendar/ src/renderer/src/stores/settings.ts src/renderer/src/i18n/
git commit -m "feat(calendar): add agenda template + Kalendo-style template picker"
```

---

## Task 12: Windows notifications wiring (already functional — verify + improve)

The notification system already works (see `notify.rs`). This task verifies it and adds a "test notification" button in Settings for user confirmation.

**Files:**
- Modify: `src/renderer/src/components/settings/SettingsPage.tsx`
- Modify: `src/renderer/src/i18n/it.ts`

- [ ] **Step 1: Add test notification button to SettingsPage**

In the reminders panel, replace the static text with:
```tsx
<div className="backup">
  <p className="muted" style={{ margin: 0, fontSize: 14 }}>{t('set.remindersText')}</p>
  <button className="ghost-btn" onClick={() => void invoke('show_notification', { title: 'EXECUTIVE', body: t('set.notifTestBody') })}>
    <IconBell size={15} /> {t('set.notifTest')}
  </button>
</div>
```

- [ ] **Step 2: Add i18n**

```typescript
'set.notifTest': 'Invia notifica di prova',
'set.notifTestBody': 'Le notifiche funzionano correttamente.',
```

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/components/settings/SettingsPage.tsx src/renderer/src/i18n/
git commit -m "feat(notifications): add test notification button in Settings"
```
