# EXEECUTIVE Onboarding and Profile Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a polished, skippable first-run experience, robust auth/profile flows, correct animated financial displays, richer calendar cards, and defensive input handling.

**Architecture:** Keep Supabase auth and SQLite local data boundaries. Add focused auth/profile/tutorial stores. Keep animation helpers shared. Normalize all errors before rendering. Keep links as validated metadata, never executable content. Use existing Tauri/React patterns.

**Tech Stack:** React 18, TypeScript, Zustand, Tauri 2, SQLite/rusqlite, Supabase REST client, Recharts, Tabler Icons, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-06-exeecutive-onboarding-profile-polish-design.md`

## Global Constraints

- Tutorial is skippable with `Salta tutorial`.
- Remember-me default is off.
- Monetary values remain minor units in storage and major display units in animation.
- Resend confirmation cooldown is exactly 60 seconds.
- Never render raw object stringification.
- Never fetch or execute arbitrary remote link content.
- No anti-debugging, anti-VM, anti-analysis, debugger detection, or process termination.
- No public release without explicit user confirmation.

## Review Focus

- Repeated resend clicks must not bypass the 60-second cooldown. Test in Task 1.
- Session state after close/restart must follow remember-me choice. Test in Task 2.
- Missing, malformed, and object-shaped errors must render safe text. Test in Task 2.
- Monetary values with EUR/USD separators and zero/negative balances must animate correctly. Test in Task 3.
- Malformed or dangerous link schemes must render as plain text without navigation. Test in Task 5.

---

### Task 1: Resend confirmation and signup continuation

**Files:**
- Modify: `src/renderer/src/stores/auth.ts`
- Modify: `src/renderer/src/lib/supabase.ts`
- Modify: `src/renderer/src/components/auth/AuthPage.tsx`
- Modify: `src/renderer/src/i18n/*.ts`
- Test: `src/renderer/src/stores/auth.test.ts`

**Interfaces:**
- Consumes: current Supabase auth client and AuthPage modes.
- Produces: `resendConfirmation(email): Promise<string | null>`, `resendAvailableAt`, and safe `errorMessage(error): string`.

- [ ] **Step 1: Add failing tests.**

Test resend success, resend failure, 60-second cooldown, and object-shaped error normalization.

- [ ] **Step 2: Run tests and verify expected failure.**

Run `pnpm test -- src/stores/auth.test.ts`. Expected: missing resend action or cooldown behavior.

- [ ] **Step 3: Implement resend action.**

Call Supabase signup resend endpoint with `type: 'signup'`. Store cooldown timestamp locally per email. Disable resend until `Date.now() >= resendAvailableAt`.

- [ ] **Step 4: Add AuthPage confirmation state.**

After signup returns no session, show confirmation message, email address, resend button, countdown, and back-to-login action. Keep password visibility control singular and accessible.

- [ ] **Step 5: Run tests and typecheck.**

Expected: auth tests pass and typecheck passes.

---

### Task 2: Remember-me, profile identity, and safe errors

**Files:**
- Modify: `src/renderer/src/stores/auth.ts`
- Modify: `src/renderer/src/components/auth/AuthPage.tsx`
- Modify: `src/renderer/src/components/layout/Sidebar.tsx`
- Modify: `src/renderer/src/components/settings/SettingsPage.tsx`
- Create: `src/renderer/src/stores/profile.ts`
- Create: `src/renderer/src/components/profile/ProfileSettings.tsx`
- Modify: `src/renderer/src/i18n/*.ts`
- Test: `src/renderer/src/stores/auth.test.ts`
- Test: `src/renderer/src/stores/profile.test.ts`

**Interfaces:**
- Consumes: Supabase session and Tauri settings commands.
- Produces: `useProfileStore`, `avatarInitials(firstName,lastName)`, `normalizeError(error)`, and remember-me session policy.

- [ ] **Step 1: Add failing tests.**

Test first/last-name validation, initials, default avatar, editable profile, remember-me off clearing session, and remember-me on restoring session.

- [ ] **Step 2: Implement auth session policy.**

Use `localStorage` only when remember-me is checked. Use `sessionStorage` otherwise. Add an unload/exit cleanup path that does not delete cloud data.

- [ ] **Step 3: Extend registration fields.**

Replace display name input with first name and last name. Send both in Supabase user metadata. Preserve existing accounts by falling back to display name/email.

- [ ] **Step 4: Implement profile store and settings panel.**

Store first name, last name, avatar initials, preset color, and optional local image reference. Reject unsupported image type and size above the defined limit. Keep image data out of cloud sync unless explicitly supported.

- [ ] **Step 5: Replace device `[object Object]` output.**

Use one shared normalizer for auth, device, sync, and settings errors. Render only safe messages.

- [ ] **Step 6: Run tests and typecheck.**

Expected: auth/profile tests pass. No `[object Object]` path remains in rendered UI.

---

### Task 3: Onboarding intro and guided tutorial

**Files:**
- Create: `src/renderer/src/stores/tutorial.ts`
- Create: `src/renderer/src/components/onboarding/WelcomeIntro.tsx`
- Create: `src/renderer/src/components/onboarding/ProductTour.tsx`
- Create: `src/renderer/src/components/onboarding/onboarding.css`
- Modify: `src/renderer/src/App.tsx`
- Modify: `src/renderer/src/components/layout/Sidebar.tsx`
- Modify: `src/renderer/src/components/settings/SettingsPage.tsx`
- Modify: `src/renderer/src/i18n/*.ts`
- Test: `src/renderer/src/stores/tutorial.test.ts`

**Interfaces:**
- Consumes: authenticated user/profile and UI page/navigation store.
- Produces: `useTutorialStore` with `status`, `start`, `next`, `back`, `skip`, `complete`, `restart`.

- [ ] **Step 1: Add failing tutorial-state tests.**

Test first-run state, skip, completion, persistence per user, restart, and step bounds.

- [ ] **Step 2: Implement tutorial state.**

Persist key by Supabase user ID. Keep skipped and completed states distinct for analytics-free local UX.

- [ ] **Step 3: Implement welcome intro.**

Show EXEECUTIVE name, product value, animated entrance, `Inizia tutorial`, and `Salta tutorial`.

- [ ] **Step 4: Implement spotlight tour.**

Use DOM selectors for dashboard KPI, sidebar, quick add, calendar, finance, settings, and notifications. Render overlay, spotlight ring, connector line, localized label, Back, Next, and Skip. Recalculate on resize and page change.

- [ ] **Step 5: Add restart control.**

Expose `Ripeti tutorial` in Settings.

- [ ] **Step 6: Run tests and typecheck.**

Expected: tutorial tests pass and responsive overlay does not create horizontal scroll.

---

### Task 4: KPI and chart animation correctness

**Files:**
- Modify: `src/renderer/src/hooks/useCountUp.ts`
- Modify: `src/renderer/src/components/common/ui.tsx`
- Modify: dashboard, finance, stats, and advisor pages
- Modify: chart components using Recharts
- Test: `src/renderer/src/hooks/useCountUp.test.ts`
- Test: `src/renderer/src/components/common/ui.test.tsx`

**Interfaces:**
- Consumes: minor-unit totals and formatted templates.
- Produces: `formatCountUpValue`, `useCountUp`, and `useChartAnim` that use display units, replay on page entry/data identity change, and respect reduced motion.

- [ ] **Step 1: Add failing tests.**

Test `20` cents/display scaling, `€ 20,00`, negative balances, percentages, decimal values, and reduced-motion immediate final state.

- [ ] **Step 2: Verify tests fail for current scaling.**

Run targeted Vitest. Expected: current raw-cent wiring produces `2000` display value.

- [ ] **Step 3: Fix display-unit wiring.**

Keep database values in cents. Pass cents divided by currency minor factor to animation. Preserve formatted template separators and currency symbols.

- [ ] **Step 4: Animate all supported charts.**

Use shared animation props. Ensure bars/areas/lines start at baseline and draw once on mount or data identity change. Disable animation under reduced motion.

- [ ] **Step 5: Run full tests/typecheck/build.**

Expected: all tests pass, typecheck passes, renderer build passes.

---

### Task 5: Appointment details, safe links, and calendar card polish

**Files:**
- Modify: appointment types and schemas under `src/renderer/src/types/` and `src/shared/`
- Modify: appointment modal and calendar card components
- Create: `src/renderer/src/utils/linkMetadata.ts`
- Create: `src/renderer/src/utils/linkMetadata.test.ts`
- Modify: Tauri DB schema/CRUD for description/link fields if missing
- Modify: `src/renderer/src/i18n/*.ts`

**Interfaces:**
- Consumes: appointment CRUD and calendar rendering.
- Produces: `detectLinkMetadata(url): { kind, label, icon } | null` and safe description/link card rendering.

- [ ] **Step 1: Add failing link tests.**

Cover Google Meet, Zoom, Teams, Webex, generic HTTPS, HTTP rejection policy, `javascript:` rejection, malformed URLs, and long descriptions.

- [ ] **Step 2: Add appointment fields.**

Add optional `description` and `link` with validation and migration. Preserve existing records.

- [ ] **Step 3: Implement link detection.**

Use URL parsing and host allowlist. Return static icon identifier only. Never execute or fetch link content.

- [ ] **Step 4: Update appointment modal.**

Show description for all appointments. Show link field for meeting/reminder types. Validate HTTPS and display safe external-link action.

- [ ] **Step 5: Update calendar cards.**

Show title, truncated description, provider icon, and link label within card bounds. Add keyboard and screen-reader labels.

- [ ] **Step 6: Run tests/typecheck.**

Expected: link tests pass. Existing CRUD tests and typecheck pass.

---

### Task 6: Legitimate application hardening

**Files:**
- Modify: `src-tauri/tauri.conf.json`
- Modify: `src/renderer/index.html`
- Modify: Rust command validation modules
- Modify: Supabase/RLS migrations
- Test: Rust validation tests and renderer security tests

**Interfaces:**
- Consumes: existing commands, auth, sync, and link validation.
- Produces: CSP, strict payload validation, parameterized SQL, least-privilege capabilities, safe logging, and RLS checks.

- [ ] **Step 1: Add failing validation tests.**

Test SQL metacharacters as data, oversized fields, malformed IDs, invalid URLs, unauthorized device IDs, and cross-user sync payloads.

- [ ] **Step 2: Apply defensive boundaries.**

Keep rusqlite parameters. Add length limits and schema validation. Reject unauthorized cloud rows with RLS. Never log tokens, passwords, or SMTP keys.

- [ ] **Step 3: Add CSP and capability minimization.**

Replace null CSP where compatible. Allow only required Tauri permissions and known Supabase origin. Do not add anti-debug or anti-VM behavior.

- [ ] **Step 4: Run security checks.**

Expected: Rust tests, renderer tests, typecheck, cargo check, and build pass.

---

### Task 7: Local release gate and publication approval

**Files:**
- Modify: version files only when release is approved
- Test: full suite and local NSIS build

- [ ] **Step 1: Run full checks.**

Run `pnpm test`, `pnpm typecheck`, `pnpm build`, `cargo check --manifest-path src-tauri/Cargo.toml`, and `pnpm tauri build --bundles nsis --no-sign`.

- [ ] **Step 2: Report local installer path.**

Do not push tags or publish GitHub release automatically.

- [ ] **Step 3: Ask explicit publication confirmation.**

Only after confirmation bump version, commit, push, tag, and monitor GitHub Actions.
