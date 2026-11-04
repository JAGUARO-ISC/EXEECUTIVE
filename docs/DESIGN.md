# EXECUTIVE — Design & Implementation Plan

Personal/business command center for Windows 10/11: calendar, agenda, tasks,
daily income/expense tracking, monthly finance, reports, notes, global search.
Desktop-first (Electron), always available from the system tray.

## Stack (decided by builder; user had no stack constraints beyond preferences)

| Layer | Choice | Why |
|---|---|---|
| Shell | Electron (latest stable) | Rust toolchain not installed (Tauri impossible); mature tray/notifications/login-item/updater APIs |
| Build | electron-vite + Vite | Fast HMR, separate main/preload/renderer builds |
| UI | React 18 + TypeScript + Tailwind CSS | Requested; typed; design tokens via CSS variables |
| Charts | Recharts | Interactive SVG charts, React-native |
| Icons | lucide-react | Coherent stroke icon set |
| Dates | date-fns + `it` locale | Tree-shakable, Italian formatting |
| DB | SQLite via better-sqlite3 (WAL, synchronous=NORMAL→FULL for durability) | Synchronous, transactional, fast, single-file, local |
| Validation | zod (shared schemas main+renderer) | Client and "server" (main process) validation |
| Excel | exceljs | Real .xlsx export |
| PDF | `webContents.printToPDF` on an offscreen report window | No extra dependency |
| Installer | electron-builder NSIS (assisted, per-user) | Real .exe, shortcuts, custom pages |
| Updates | electron-updater (generic/GitHub provider, configurable) | Safe staged updates; pre-update backup |
| Tests | vitest (pure domain logic) + Playwright `_electron` (E2E on real app) | Playwright already installed globally |

## Process architecture

- **Main process** = the "local secure backend". Owns the DB, file system,
  backups, scheduler (notifications, auto-backup), tray, login item, updater.
- **Preload** exposes a narrow typed API via `contextBridge` (`window.api`).
  `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`.
  Renderer never touches SQL or the file system.
- **IPC**: `ipcMain.handle(channel)` per operation; every payload validated
  with zod in main before touching the DB. Errors returned as
  `{ ok: false, error }` envelopes, surfaced as toasts.
- **Change events**: main broadcasts `data:changed { entity }` after every
  write so every open screen (and tray actions) refreshes → all screens stay
  consistent.
- CSP: `default-src 'self'`; no remote content loaded.

## Data location & safety

- DB: `%APPDATA%\Executive\data\executive.db` (`app.getPath('userData')`).
  Never in install dir or temp. Installer/updates never touch `userData`.
- Attachments (receipts): `%APPDATA%\Executive\attachments\<uuid>.<ext>`.
- Backups default: `%APPDATA%\Executive\backups\`, user-selectable folder.
- Pragmas: `journal_mode=WAL`, `synchronous=FULL`, `foreign_keys=ON`.
- Every multi-statement write inside `db.transaction()`.
- Writes are immediate (autosave = every action commits). No unsaved state.
- Backup = SQLite online backup API (`db.backup()`), consistent while running,
  zipped with attachments? → keep simple: `.db` snapshot + attachments folder
  copy into `executive-backup-YYYYMMDD-HHmmss/` directory + `manifest.json`.
  Integrity check (`PRAGMA integrity_check`) on the snapshot.
- Auto-backup: scheduler daily (configurable: off/daily/weekly), retention N
  (default 14). Also backup before migrations and before installing updates.
- Restore: validate file (open read-only, integrity check, schema version ≤
  current), make safety backup of current DB, close DB, replace, reopen,
  run migrations, relaunch renderer.
- Migrations: `schema_migrations` table; ordered migrations run in one
  transaction each; automatic backup before any pending migration.
- Full export: JSON (all tables) + CSV/XLSX per dataset.
- Crash safety: WAL + FULL sync; `process.on('uncaughtException')` logs to
  `%APPDATA%\Executive\logs\main.log`.

## Schema (v1)

- `settings(key TEXT PK, value TEXT JSON)`
- `profile(id=1, name, currency, locale)` → stored in settings
- `categories(id, kind CHECK(kind IN ('event','task','income','expense','note')), name, color, icon, sort, archived)`
- `events(id, title, description, location, category_id FK, priority, start_at, end_at, all_day, color, completed, reminder_minutes, recurrence_rule JSON, recurrence_until, created_at, updated_at)`
- `event_exceptions(event_id FK, occurrence_date, kind('skip'|'done'))` (per-occurrence completion/skip for recurring events)
- `tasks(id, title, description, type ('task','meeting','call','errand','deadline','goal','reminder'), scope('work','personal'), date, time, due_at, priority('low','medium','high','urgent'), status('todo','in_progress','done'), category_id FK, reminder_at, recurrence_rule, completed_at, created_at, updated_at)`
- `transactions(id, kind('income','expense'), amount_cents INTEGER CHECK>0, currency, description, category_id FK, occurred_at, payment_method, notes, attachment_path, recurring_id FK NULL, created_at, updated_at)`
- `recurring_payments(id, kind, amount_cents, description, category_id, payment_method, interval('monthly','yearly','weekly'), day, next_date, active)` — subscriptions; materialized into transactions on due date by scheduler (idempotent).
- `budgets(id, category_id FK UNIQUE per month or default, amount_cents)` + monthly income goal in settings.
- `notes(id, title, body, category_id FK, linked_date, pinned/important, created_at, updated_at)`
- `notifications_log(key PK, fired_at)` — prevents duplicate notifications.
- FTS5 virtual table `search_index` (or LIKE queries) for global search.

Money stored as integer cents. All aggregates computed in SQL (`SUM`), then
verified by unit tests.

## Windows integration

- **Tray**: always present. Left click toggles window. Right click / menu:
  Apri, Nascondi, Calendario di oggi, Nuova attività, Nuova entrata,
  Nuova uscita, Impostazioni, Esci completamente.
- **Close (X)**: setting `closeBehavior: 'tray'|'quit'` (default tray). First
  hide shows a one-time notification "Executive è ancora attivo nell'area di
  notifica".
- **Autostart**: `app.setLoginItemSettings({ openAtLogin, args:['--hidden'] })`.
  Launch with `--hidden` → no window, tray only. Persisted in settings; state
  re-synced at startup.
- **Single instance**: `requestSingleInstanceLock`; second launch focuses window.
- **Notifications**: `new Notification()` from main; scheduler tick every 30s
  checks events (reminder_minutes before start), tasks (reminder_at, due soon),
  daily goals summary at configurable time, budget exceeded. Click → opens the
  relevant screen. Per-type toggles in settings. AppUserModelId set.
- **Installer** (NSIS assisted): choose dir, desktop + start menu shortcuts,
  custom page checkbox "Avvia automaticamente con Windows" (writes HKCU Run
  key with `--hidden`; app reads Run key at first start to sync setting).
  Uninstall: asks "Eliminare anche tutti i dati?" default No.
- **Updates**: Settings → "Verifica aggiornamenti"; shows installed version.
  Before `quitAndInstall` → backup. Feed URL configurable; if not configured,
  shows clear message. Rollback = install previous installer (data untouched;
  migrations are forward-only but backups pre-migration allow restore).

## UI

Sections (sidebar): Dashboard · Calendario · Attività · Finanze · Report ·
Note · Impostazioni. Global search (Ctrl+K). Quick-add button (+) with
Appuntamento / Attività / Entrata / Uscita / Nota (also keyboard N).
Day sheet (scheda giornaliera): events, tasks, transactions with daily
totals, linked notes.

Visual direction (from references Vault / Agency Book / Kalendo): deep
near-black navy surfaces, layered cards with hairline borders, one confident
accent (emerald for money-positive), coral for expense, refined type.
Light mode fully supported. Italian UI.

## Milestones

1. Scaffold, DB + migrations + repositories, IPC, preload API.
2. Shell UI: layout, design system, theming, routing, toasts, modals.
3. Calendar (day/week/month/year), events CRUD, recurrence.
4. Tasks/agenda, overdue/upcoming, move between days.
5. Finance: transactions CRUD, daily/monthly summaries, charts, filters, budgets, subscriptions.
6. Reports, exports (CSV/XLSX/PDF/JSON), notes, global search.
7. Desktop: tray, close-to-tray, autostart, notifications, backups/restore, updater.
8. Installer + tests (unit + E2E) + verification checklist.
