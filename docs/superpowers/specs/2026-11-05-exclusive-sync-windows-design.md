# Exclusive Sync and Windows Distribution Design

## Intent

Deliver a reliable Windows desktop release of Exclusive. A user downloads an unsigned installer, chooses a desktop shortcut, launches the app without a terminal, receives Windows reminders, and keeps the app active in the notification area when the window closes.

## Goals

- Complete and verify existing login, registration, theme, accent, animation, calendar, converter, and notification work.
- Add cloud account synchronization using Supabase Free.
- Keep SQLite as the offline local cache and support offline reads and writes.
- Treat the first approved device as the account's primary device.
- Require primary-device approval for every new device.
- Let the user revoke any approved device.
- Provide account recovery by email.
- Produce a Windows installer with desktop shortcut choice and optional Windows startup.
- Hide to tray on window close and keep reminder processing active.
- Send reminder notifications through Windows notification APIs.

## Non-goals

- Code signing in this release.
- Paid hosting or guaranteed availability of a free Supabase project.
- Full multi-user collaboration.
- Mobile clients.
- Automatic conflict-free merge of arbitrary concurrent edits.

## Decisions

- Use Supabase Auth for email/password and recovery email.
- Use Supabase Postgres tables and Row Level Security for synchronized app data and device authorization.
- Store Supabase URL and publishable/anon key in the renderer build configuration. Never ship service-role keys.
- Store local SQLite data under Tauri app data. Do not store mutable data in the install directory.
- Use a stable per-installation device identifier generated locally and stored in app data.
- First authenticated device becomes primary. A later device creates a pending device record.
- Primary device approves or revokes devices from Settings.
- Sync uses an outbox/inbox model. Local writes commit first. Sync retries after reconnect.
- Last-write-wins applies only to records with the same entity ID. Deletes use tombstones so they synchronize.
- Resetting or uninstalling local app data requires the user to authenticate again and request device approval.
- Recovery uses Supabase email reset. The app must not claim recovery works without configured SMTP.

## Windows behavior

- Bundle a Tauri Windows NSIS installer.
- Installer is unsigned. Windows SmartScreen may warn users.
- Installer offers desktop shortcut creation.
- Installer offers Start Menu shortcut.
- Settings exposes startup with Windows. Startup launches the app hidden with `--hidden`.
- Use a single-instance lock. A second launch focuses the existing window.
- Window close hides the main window and keeps tray icon alive.
- Tray menu contains Open, New appointment, New task, New income, New expense, New note, Calendar, Settings, and Exit completely.
- Exit completely stops scheduler and closes the process.
- Notification scheduler runs while the app is hidden and after startup.
- Notification clicks reopen the app and navigate to the related page when supported.

## Security and privacy

- Hashing remains delegated to Supabase Auth. Do not store passwords locally.
- Use RLS with `auth.uid()` on every cloud table.
- Validate sync payloads before applying them locally.
- Never log access tokens, recovery tokens, passwords, or service-role keys.
- Revoke device sessions server-side and clear local session state on logout.

## Acceptance criteria

1. `pnpm --dir src/renderer typecheck` passes.
2. `cargo check --manifest-path src-tauri/Cargo.toml` passes.
3. `pnpm --dir src/renderer build` passes.
4. `pnpm tauri build` produces a Windows installer configuration without missing icon or bundle errors.
5. Fresh install can create a desktop shortcut and launch the app.
6. Close button hides the window. Tray icon remains. Exit menu terminates the process.
7. Windows startup launches hidden when enabled and does not create duplicate processes.
8. A reminder created locally produces one Windows notification after its trigger.
9. First device can approve and revoke a second device.
10. A pending device cannot read cloud data before approval.
11. Offline local changes survive restart and sync after reconnect.
12. Account recovery opens the configured Supabase recovery flow.
