# Exclusive Sync and Windows Distribution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the existing Exclusive Tauri app with verified features, Supabase device-gated synchronization, Windows notifications, tray background behavior, startup, and an unsigned Windows installer.

**Architecture:** Keep Rust/Tauri as the local privileged layer. Keep SQLite as the offline cache. Add a typed Supabase client in the React renderer for Auth and cloud sync, with Rust commands for device identity, local persistence, tray, startup, and notifications. Use an outbox plus tombstones for retryable sync and RLS-protected Supabase tables.

**Tech Stack:** Tauri 2, Rust, SQLite/rusqlite, React 18, TypeScript, Zustand, Supabase JS, Vite, Tauri notification and autostart plugins, NSIS bundle.

**Spec:** `docs/superpowers/specs/2026-11-05-exclusive-sync-windows-design.md`

## Global Constraints

- Installer remains unsigned. SmartScreen warnings are expected.
- Supabase uses only public URL and anon/publishable key in the client. Never ship service-role keys.
- SQLite data lives in Tauri app data, not the install directory.
- Passwords are handled by Supabase Auth. Never store passwords locally.
- RLS must enforce `auth.uid()` ownership on cloud data.
- First approved device is primary. New devices remain pending until primary approval.
- Local writes must work offline and sync after reconnect.
- Window close hides to tray. Tray Exit completely terminates the process.
- Do not claim recovery works unless Supabase email recovery is configured.
- Preserve existing Italian, English, Spanish, French, and German translations.

## Review Focus

- Fresh install with missing or invalid Supabase configuration must show a usable offline/auth state, not crash. Test in Task 1.
- Duplicate startup or second launch must not create two processes. Test in Task 5.
- Clock changes, restart, and offline reconnect must not duplicate reminders or sync records. Test in Tasks 4 and 6.
- A pending device must not read or write another account's cloud data. Test in Task 3.
- Revoked device tokens and stale local sessions must stop cloud access and return the user to login. Test in Task 3.

---

### Task 1: Baseline audit and build wiring

**Files:**
- Modify: `package.json`
- Modify: `src/renderer/package.json`
- Modify: `src-tauri/tauri.conf.json`
- Modify: `src-tauri/Cargo.toml`
- Modify: `.env.example` or create it at repository root
- Test: `src/renderer/src/**/*.test.ts` or existing test location

**Interfaces:**
- Consumes: current Tauri commands, renderer stores, existing tray and notification modules.
- Produces: one documented package entry point, build scripts that use `src/renderer`, and dependency versions needed by later tasks.

- [ ] **Step 1: Inspect current scripts and run baseline checks.**

Run:

```text
pnpm --dir src/renderer typecheck
cargo check --manifest-path src-tauri/Cargo.toml
pnpm --dir src/renderer build
```

Record each existing failure before editing.

- [ ] **Step 2: Align root and renderer scripts.**

Make `pnpm tauri dev`, `pnpm tauri build`, renderer typecheck, and renderer build use the actual `src/renderer` package. Add `dev`, `typecheck`, `build`, and `bundle` commands with no duplicate contradictory paths.

- [ ] **Step 3: Add configuration template.**

Create `.env.example` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Add runtime validation that reports missing configuration without printing keys.

- [ ] **Step 4: Fix only baseline compile errors.**

Do not redesign features in this task. Keep changes limited to build wiring and errors proven by Step 1.

- [ ] **Step 5: Run baseline checks again.**

Expected: renderer typecheck, renderer build, and `cargo check` pass.

- [ ] **Step 6: Commit.**

```text
git add package.json src/renderer/package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml .env.example
 git commit -m "build: align tauri and renderer commands"
```

---

### Task 2: Finish local auth, session, recovery, and app boot

**Files:**
- Modify: `src-tauri/src/auth.rs`
- Modify: `src-tauri/src/db.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src/renderer/src/stores/auth.ts`
- Modify: `src/renderer/src/components/auth/AuthPage.tsx`
- Modify: `src/renderer/src/i18n/*.ts`
- Create: `src/renderer/src/lib/supabase.ts`
- Test: `src/renderer/src/stores/auth.test.ts`

**Interfaces:**
- Consumes: existing `AuthPage`, `useAuth`, and settings language store.
- Produces: `supabase` client, `AuthState` with `session`, `user`, `loaded`, `pendingError`, `login`, `register`, `requestRecovery`, `logout`, and `refreshSession`.

- [ ] **Step 1: Write failing auth-state tests.**

Cover login success, logout clearing session, malformed stored session, recovery error, and missing Supabase configuration.

- [ ] **Step 2: Run tests and verify failure.**

Run `pnpm --dir src/renderer vitest run src/stores/auth.test.ts`. Expected: missing client/store behavior.

- [ ] **Step 3: Implement Supabase client and auth store.**

Use `createClient` with public environment variables. Subscribe to `onAuthStateChange`. Keep only Supabase session metadata needed by the app. Remove numeric local-user ID as the cloud identity source.

- [ ] **Step 4: Add recovery UI.**

Add email recovery mode to `AuthPage`. Show success and failure states. Keep language selector and theme toggle available.

- [ ] **Step 5: Add session cleanup commands.**

Clear local session, device sync state, and pending outbox on explicit logout. Do not delete user data without a separate destructive action.

- [ ] **Step 6: Run tests and typecheck.**

Expected: auth tests pass and `pnpm --dir src/renderer typecheck` passes.

- [ ] **Step 7: Commit.**

```text
git add src-tauri/src/auth.rs src-tauri/src/db.rs src-tauri/src/lib.rs src/renderer/src/lib/supabase.ts src/renderer/src/stores/auth.ts src/renderer/src/components/auth/AuthPage.tsx src/renderer/src/i18n src/renderer/src/stores/auth.test.ts
 git commit -m "feat: add cloud auth and account recovery"
```

---

### Task 3: Device registration, primary approval, and revocation

**Files:**
- Create: `supabase/migrations/001_devices.sql`
- Create: `src/renderer/src/stores/devices.ts`
- Create: `src/renderer/src/components/settings/DeviceManager.tsx`
- Modify: `src/renderer/src/components/settings/SettingsPage.tsx`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/src/db.rs`
- Modify: `src/renderer/src/i18n/*.ts`
- Test: `src/renderer/src/stores/devices.test.ts`

**Interfaces:**
- Consumes: authenticated Supabase session and Rust local app-data commands.
- Produces: `useDeviceStore` with `current`, `devices`, `load`, `register`, `approve`, `revoke`, `isApproved`, and `resetLocalDevice`.

- [ ] **Step 1: Write RLS migration.**

Create `devices` with `id`, `user_id`, `device_name`, `device_key`, `status`, `is_primary`, timestamps, and revocation timestamp. Add unique `(user_id, device_key)`. Add policies so users can read their own rows, primary devices can approve/revoke non-primary rows, and pending devices cannot access sync tables.

- [ ] **Step 2: Write failing device-store tests.**

Cover first device becoming primary, second device becoming pending, approval transition, revocation, and rejection of cloud access while pending.

- [ ] **Step 3: Add stable local device identity.**

Create Tauri commands `get_device_identity`, `get_device_name`, and `set_device_name`. Generate a random identifier once under app data. Never derive it from hardware identifiers.

- [ ] **Step 4: Implement device store.**

Register current device after auth. Poll or refresh pending status. Block sync until status is `approved`. Allow primary device to approve and revoke. On revocation, sign out and clear cloud session.

- [ ] **Step 5: Build Settings device manager.**

Show current device, primary marker, pending devices, approved devices, last seen time, approve action, revoke action, and clear confirmation copy.

- [ ] **Step 6: Run tests and typecheck.**

Expected: device tests pass. Pending device has no sync calls. Typecheck passes.

- [ ] **Step 7: Commit.**

```text
git add supabase/migrations/001_devices.sql src/renderer/src/stores/devices.ts src/renderer/src/components/settings/DeviceManager.tsx src/renderer/src/components/settings/SettingsPage.tsx src-tauri/src/lib.rs src-tauri/src/db.rs src/renderer/src/i18n
 git commit -m "feat: gate account access by approved devices"
```

---

### Task 4: Sync schema, local outbox, and conflict-safe application

**Files:**
- Create: `supabase/migrations/002_sync.sql`
- Create: `src/renderer/src/lib/sync.ts`
- Create: `src/renderer/src/stores/sync.ts`
- Modify: `src-tauri/src/db.rs`
- Modify: `src-tauri/src/data.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: existing entity stores under `src/renderer/src/stores/`
- Test: `src/renderer/src/lib/sync.test.ts`

**Interfaces:**
- Consumes: approved device state and existing Tauri CRUD commands.
- Produces: `syncNow(): Promise<SyncResult>`, `enqueueChange(change): Promise<void>`, `startSyncLoop()`, and `stopSyncLoop()`.

- [ ] **Step 1: Add local sync metadata tables.**

Add `sync_outbox`, `sync_tombstones`, and per-entity `updated_at` metadata. Add indexes for pending rows and account/device scope. Keep writes transactional with entity updates.

- [ ] **Step 2: Add cloud sync tables and RLS.**

Create account-scoped tables for existing synchronized entities. Include `user_id`, `entity_id`, `updated_at`, `deleted_at`, `updated_by_device`, and JSON payload where matching typed columns would duplicate unstable local schema. Add RLS requiring an approved device membership.

- [ ] **Step 3: Write failing sync tests.**

Cover upload, download, retry after network failure, tombstone propagation, same-ID last-write-wins, malformed payload rejection, and idempotent repeated sync.

- [ ] **Step 4: Implement sync engine.**

Upload pending outbox rows in batches. Pull rows newer than the last cursor. Validate entity kind and payload before local application. Mark uploaded rows only after server success. Keep failed rows for retry with bounded backoff.

- [ ] **Step 5: Wire existing stores.**

After local create/update/delete succeeds, enqueue one change. Start the sync loop after auth and device approval. Stop it on logout, revoke, and app shutdown. Refresh UI after remote changes.

- [ ] **Step 6: Run sync tests and checks.**

Expected: sync tests pass. Offline writes remain available. Typecheck and `cargo check` pass.

- [ ] **Step 7: Commit.**

```text
git add supabase/migrations/002_sync.sql src/renderer/src/lib/sync.ts src/renderer/src/stores/sync.ts src-tauri/src/db.rs src-tauri/src/data.rs src-tauri/src/lib.rs src/renderer/src/stores
 git commit -m "feat: synchronize local data through approved devices"
```

---

### Task 5: Windows tray, close behavior, single instance, and startup

**Files:**
- Modify: `src-tauri/src/tray.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/src/db.rs`
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/tauri.conf.json`
- Modify: `src/renderer/src/components/settings/SettingsPage.tsx`
- Modify: `src/renderer/src/i18n/*.ts`
- Test: `src-tauri/src/tray.rs` or manual Windows verification checklist

**Interfaces:**
- Consumes: existing tray menu and renderer event listeners.
- Produces: close-to-tray behavior, `set_startup_enabled`, `get_startup_enabled`, single-instance focus, and tray exit.

- [ ] **Step 1: Add required Tauri plugins and capabilities.**

Add autostart and process/window APIs needed by the installed target. Register plugins and permissions. Keep notification plugin registration intact.

- [ ] **Step 2: Implement single-instance handling.**

Acquire a single-instance lock before creating the main window. On second launch, emit a focus event and show the existing window.

- [ ] **Step 3: Implement close-to-tray.**

Intercept main-window close. Hide instead of exit unless an internal `quit` flag is set. Preserve tray and reminder thread. Handle `--hidden` startup without showing the window.

- [ ] **Step 4: Implement startup settings.**

Persist startup choice and synchronize it with Windows startup registration. Add Settings toggle. Ensure disabling startup removes the entry.

- [ ] **Step 5: Complete tray actions.**

Add Settings and explicit Exit completely. Keep existing quick-add and navigation events. Ensure tray click toggles visibility.

- [ ] **Step 6: Run Rust checks.**

Expected: `cargo check --manifest-path src-tauri/Cargo.toml` passes. Manual Windows test confirms close hides, tray opens, Exit terminates, second launch focuses, and `--hidden` starts invisible.

- [ ] **Step 7: Commit.**

```text
git add src-tauri/src/tray.rs src-tauri/src/lib.rs src-tauri/src/db.rs src-tauri/Cargo.toml src-tauri/tauri.conf.json src/renderer/src/components/settings/SettingsPage.tsx src/renderer/src/i18n
 git commit -m "feat: keep exclusive active in windows tray"
```

---

### Task 6: Windows reminders and notification reliability

**Files:**
- Modify: `src-tauri/src/notify.rs`
- Modify: `src-tauri/src/db.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src/renderer/src/components/settings/SettingsPage.tsx`
- Modify: `src/renderer/src/i18n/*.ts`
- Test: `src-tauri/src/notify.rs` and manual Windows notification checklist

**Interfaces:**
- Consumes: appointments/tasks local data, tray app handle, and persisted notification settings.
- Produces: one-shot reminder scheduler with idempotent delivery and notification click routing.

- [ ] **Step 1: Add notification delivery metadata.**

Use a durable notification log keyed by entity, trigger time, and reminder type. Do not rely only on mutable `notified` flags.

- [ ] **Step 2: Fix scheduler edge cases.**

Handle restart after trigger, recurring appointments, local timezone conversion, overdue tasks, and clock rollback without duplicate delivery. Keep scheduler non-blocking.

- [ ] **Step 3: Add settings toggles.**

Expose master notification toggle and per-type toggles for appointments, tasks, and summaries. Keep test notification button.

- [ ] **Step 4: Add click routing.**

Attach an internal notification identifier. On click, show app and emit navigation to calendar, tasks, or finance where supported.

- [ ] **Step 5: Verify.**

Run `cargo check`. On Windows, create a test appointment and task, hide app, wait for trigger, confirm one notification each, restart, and confirm no duplicate.

- [ ] **Step 6: Commit.**

```text
git add src-tauri/src/notify.rs src-tauri/src/db.rs src-tauri/src/lib.rs src/renderer/src/components/settings/SettingsPage.tsx src/renderer/src/i18n
 git commit -m "feat: deliver reliable windows reminders"
```

---

### Task 7: Finish and verify existing frontend feature set

**Files:**
- Modify: `src/renderer/src/components/common/ui.tsx`
- Modify: `src/renderer/src/hooks/useCountUp.ts`
- Modify: `src/renderer/src/components/dashboard/DashboardPage.tsx`
- Modify: chart components under `src/renderer/src/components/`
- Modify: `src/renderer/src/components/settings/SettingsPage.tsx`
- Modify: `src/renderer/src/styles/*.css`
- Modify: `src/renderer/src/i18n/*.ts`
- Test: `src/renderer/src/hooks/useCountUp.test.ts`

**Interfaces:**
- Consumes: existing stores and pages.
- Produces: type-safe count-up and chart animation behavior with reduced-motion support and complete “Altro” specificity behavior.

- [ ] **Step 1: Run typecheck and inspect unfinished changes.**

Find syntax errors, truncated edits, unused imports, broken CSS declarations, and all generic fields that do not support optional specificity.

- [ ] **Step 2: Write count-up tests.**

Cover zero, positive, negative, decimal, target changes, unmount cancellation, and `prefers-reduced-motion`.

- [ ] **Step 3: Fix count-up and stat formatting.**

Keep currency formatting and separators intact. Animate numeric part only. Do not turn `€ 3.200,00` into invalid text.

- [ ] **Step 4: Animate charts.**

Animate line/area/bar drawing on page entry. Respect reduced motion. Do not restart animation on every render.

- [ ] **Step 5: Complete generic “Altro” fields.**

Use one reusable field and encode only a user-provided detail. Empty detail displays “Altro” but is not stored as a specific custom value. Cover every generic selector in forms.

- [ ] **Step 6: Verify all language files and settings controls.**

Check accent colors, light/dark mode, converter, calendar layout, notification controls, and translations.

- [ ] **Step 7: Run checks.**

Expected: tests, typecheck, and renderer build pass.

- [ ] **Step 8: Commit.**

```text
git add src/renderer/src/components src/renderer/src/hooks src/renderer/src/styles src/renderer/src/i18n
 git commit -m "fix: finish frontend animations and generic fields"
```

---

### Task 8: Installer, icons, shortcuts, and release documentation

**Files:**
- Modify: `src-tauri/tauri.conf.json`
- Modify: `src-tauri/icons/*`
- Create: `.github/workflows/windows-release.yml` if CI is desired
- Modify: `README.md` or create it at repository root
- Create: `docs/windows-release.md`
- Test: installer artifact and clean Windows VM/manual checklist

**Interfaces:**
- Consumes: completed tray/startup behavior and aligned build scripts.
- Produces: unsigned Windows NSIS installer with desktop shortcut option, Start Menu shortcut, app icon, and exact developer launch instructions.

- [ ] **Step 1: Validate icon set.**

Provide valid PNG and ICO assets at required Tauri sizes. Remove references to missing files.

- [ ] **Step 2: Configure NSIS bundle.**

Set product name `EXCLUSIVE`, identifier, version, NSIS target, install scope, Start Menu shortcut, desktop shortcut option, and uninstall behavior. Keep user data outside install directory.

- [ ] **Step 3: Add Windows build command.**

Document prerequisites: Node 20+, pnpm 8+, Rust stable, WebView2, and Windows build target. Add one command producing the installer under `src-tauri/target/release/bundle/nsis/`.

- [ ] **Step 4: Build installer.**

Run:

```text
pnpm --dir src/renderer typecheck
pnpm --dir src/renderer build
cargo check --manifest-path src-tauri/Cargo.toml
pnpm tauri build
```

Expected: installer exists and no missing icon/bundle error appears.

- [ ] **Step 5: Test clean install.**

Install on Windows. Select desktop shortcut. Launch from desktop. Close with `X`. Reopen from tray. Exit completely. Uninstall and confirm user-data choice.

- [ ] **Step 6: Document user and developer launch.**

Document normal user flow: download installer, install, desktop shortcut, tray behavior. Document developer flow: `pnpm install`, environment file, `pnpm tauri dev`, and `pnpm tauri build`.

- [ ] **Step 7: Commit.**

```text
git add src-tauri/tauri.conf.json src-tauri/icons README.md docs/windows-release.md .github/workflows/windows-release.yml
 git commit -m "build: package exclusive for unsigned windows release"
```

---

### Task 9: Whole-app verification and release gate

**Files:**
- Modify: any files required by verified failures only
- Test: unit tests, typecheck, Rust checks, renderer build, Windows installer

**Interfaces:**
- Consumes: all previous task outputs.
- Produces: release evidence and a clean setup guide.

- [ ] **Step 1: Run frontend tests.**

Run `pnpm --dir src/renderer vitest run`.

- [ ] **Step 2: Run frontend typecheck and build.**

Run `pnpm --dir src/renderer typecheck` and `pnpm --dir src/renderer build`.

- [ ] **Step 3: Run Rust verification.**

Run `cargo check --manifest-path src-tauri/Cargo.toml`.

- [ ] **Step 4: Build release bundle.**

Run `pnpm tauri build`. Record exact installer path.

- [ ] **Step 5: Execute Windows acceptance checklist.**

Verify fresh install, desktop shortcut, login, recovery request, first-device primary state, second-device pending state, approval, revocation, offline CRUD, reconnect sync, close-to-tray, startup, reminder notification, single instance, and full exit.

- [ ] **Step 6: Fix only verified release blockers.**

Repeat the smallest relevant check after each fix. Do not expand product scope.

- [ ] **Step 7: Produce final release notes.**

Include installer path, unsigned warning, required Supabase setup, known free-tier limits, and developer commands.

- [ ] **Step 8: Commit verification documentation.**

```text
git add docs/windows-release.md README.md
 git commit -m "docs: add exclusive release verification steps"
```
