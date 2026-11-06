# Dark Glass Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a coherent dark opaque glass interface with a complete first-run experience and corrected profile, devices, authentication, dashboard, and appointment flows.

**Architecture:** Keep React, Zustand, Mantine, and Recharts. Centralize visual changes in existing CSS tokens and reusable UI primitives. Add a dedicated profile page to the existing Zustand page router. Derive appointment previews from validated link metadata without storing external images.

**Tech Stack:** React 18, TypeScript, Zustand, Mantine, Tabler Icons, Recharts, Vitest, Tauri.

**Spec:** `docs/superpowers/specs/2026-11-06-dark-glass-experience-design.md`

## Global Constraints

- Keep the current React/Tauri stack and existing public routes.
- Use opaque dark surfaces with lime as the single data accent.
- Respect `prefers-reduced-motion` for all new movement.
- Do not expose raw device-service errors.
- Do not add a second password visibility control.
- Do not use unsafe appointment links.

## Review Focus

- A missing `public.devices` table renders an unavailable device state without the database message. Test in Task 5.
- Invalid `javascript:` and malformed appointment links do not produce links or preview images. Test in Task 6.
- The profile destination survives page-store persistence and opens from the account row. Test in Task 3.
- Reduced motion disables counter travel and chart entry animation. Test in Task 4.
- Login and registration show exactly one password visibility button. Test in Task 7.

---

### Task 1: Establish dark opaque glass tokens and component states

**Files:**
- Modify: `src/renderer/src/styles/global.css`
- Modify: `src/renderer/src/styles/pages.css`
- Modify: `src/renderer/src/styles/motion.css`

**Interfaces:**
- Produces: `--bg`, `--surface`, `--surface-raised`, `--line`, `--text`, `--muted`, `--accent`, and motion tokens used by all renderer components.

- [ ] **Step 1: Add a visual regression checklist**

Document expected shell, panel, input, button, empty-state, and focus colors beside the root tokens.

- [ ] **Step 2: Replace translucent panel and background gradients with opaque neutral surface tokens**

Use `#0a0c10` as ground. Use charcoal tone steps for panel hierarchy. Retain blur only for modal and tutorial overlays.

- [ ] **Step 3: Restyle shell, sidebar, panels, list rows, forms, and stat containers**

Use one radius scale. Use accent only for selected state, current data, and primary actions. Remove resting shadows and red panel treatments.

- [ ] **Step 4: Add reduced-motion overrides for new keyframes and transitions**

Keep opacity changes where they explain state. Remove transform travel when reduced motion is requested.

- [ ] **Step 5: Run typecheck and inspect the production renderer manually**

Run: `pnpm --dir src/renderer typecheck`

Expected: exit code 0.

### Task 2: Rebuild the first-run intro and tutorial

**Files:**
- Modify: `src/renderer/src/components/onboarding/WelcomeIntro.tsx`
- Modify: `src/renderer/src/components/onboarding/ProductTour.tsx`
- Modify: `src/renderer/src/components/onboarding/onboarding.css`
- Test: `src/renderer/src/stores/tutorial.test.ts`

**Interfaces:**
- Consumes: existing `WelcomeIntro` callbacks and tutorial store methods.
- Produces: a staged first-run introduction and opaque contextual tutorial.

- [ ] **Step 1: Extend tutorial tests for start, back, skip, and complete transitions**

Run: `pnpm --dir src/renderer test -- tutorial.test.ts`

Expected: PASS before visual work if store behavior is unchanged.

- [ ] **Step 2: Replace the static welcome card with a three-part product preview**

Keep `onStart` and `onSkip`. Add semantic preview items for calendar, tasks, and finance. Use staggered entry classes.

- [ ] **Step 3: Rewrite tutorial copy and targets around first actions**

Use dashboard, quick add, calendar, finance, profile, and notifications. Replace the settings-profile tutorial step with the sidebar profile target.

- [ ] **Step 4: Make the tour overlay and card opaque**

Use a near-black overlay and a charcoal card. Keep spotlight geometry. Remove visual glow and nonessential connector decoration.

- [ ] **Step 5: Run tutorial tests and renderer typecheck**

Run: `pnpm --dir src/renderer test -- tutorial.test.ts && pnpm --dir src/renderer typecheck`

Expected: exit code 0.

### Task 3: Move profile editing to sidebar navigation

**Files:**
- Modify: `src/renderer/src/stores/ui.ts`
- Modify: `src/renderer/src/App.tsx`
- Modify: `src/renderer/src/components/layout/Sidebar.tsx`
- Modify: `src/renderer/src/components/profile/ProfileSettings.tsx`
- Modify: `src/renderer/src/components/settings/SettingsPage.tsx`
- Test: `src/renderer/src/stores/profile.test.ts`

**Interfaces:**
- Produces: `Page = ... | 'profile'` and profile navigation through `setPage('profile')`.
- Consumes: existing `useProfileStore.update`.

- [ ] **Step 1: Add `profile` to page-store valid values**

Add a test that stored `profile` restores as the current page.

- [ ] **Step 2: Render `ProfileSettings` as a dedicated page**

Give the page a `PageHead`, focused identity panel, and quiet save confirmation.

- [ ] **Step 3: Make the lower-left account row open `profile`**

Use the whole identity row as a labelled button. Keep theme and logout as separate controls.

- [ ] **Step 4: Remove profile editor from settings**

Keep settings focused on application behavior, updates, data, and device management.

- [ ] **Step 5: Run profile tests and typecheck**

Run: `pnpm --dir src/renderer test -- profile.test.ts && pnpm --dir src/renderer typecheck`

Expected: exit code 0.

### Task 4: Improve dashboard information hierarchy and motion

**Files:**
- Modify: `src/renderer/src/components/dashboard/DashboardPage.tsx`
- Modify: `src/renderer/src/components/common/ui.tsx`
- Modify: `src/renderer/src/hooks/useCountUp.ts`
- Modify: `src/renderer/src/hooks/useCountUp.test.ts`
- Modify: `src/renderer/src/styles/pages.css`

**Interfaces:**
- Consumes: `useCountUp(target, duration)` and `useChartAnim()`.
- Produces: counted statistics, motion-safe deltas, and appointment summary rows with rich metadata.

- [ ] **Step 1: Add reduced-motion behavior tests for `useCountUp`**

Verify the hook returns target values without timed interpolation when reduced motion is active or motion is disabled.

- [ ] **Step 2: Update `Stat`, `Delta`, and chart animation contracts**

Use 500ms custom ease-out chart animation. Limit delta entrance animation to first data render. Keep values tabular.

- [ ] **Step 3: Replace accent-filled KPI card treatment with divided or quiet surface treatment**

Make month balance the lead value. Keep color on current series and one action only.

- [ ] **Step 4: Render rich appointment previews in today and upcoming lists**

Use Task 6 helpers to show optional image, description, and a valid link affordance.

- [ ] **Step 5: Run hook tests, dashboard typecheck, and production build**

Run: `pnpm --dir src/renderer test -- useCountUp.test.ts && pnpm --dir src/renderer typecheck && pnpm --dir src/renderer build`

Expected: exit code 0.

### Task 5: Make device integration failure silent and useful

**Files:**
- Modify: `src/renderer/src/stores/devices.ts`
- Modify: `src/renderer/src/components/settings/DeviceManager.tsx`
- Modify: `src/renderer/src/stores/devices.test.ts`
- Modify: `src/renderer/src/styles/pages.css`

**Interfaces:**
- Produces: `availability: 'available' | 'unavailable'` on the device store.
- Consumes: Supabase errors from table queries and upserts.

- [ ] **Step 1: Add failing device-store tests for schema-cache failures**

Simulate `Could not find the table 'public.devices' in the schema cache`. Assert `availability === 'unavailable'`, `error === null`, and no raw error copy.

- [ ] **Step 2: Classify missing-table errors in the device store**

Add a pure internal classifier. Preserve normal device behavior for available tables.

- [ ] **Step 3: Replace the error panel with neutral unavailable content**

Show a calm unavailable explanation and a retry action. Do not render red classes or database messages.

- [ ] **Step 4: Run device tests and typecheck**

Run: `pnpm --dir src/renderer test -- devices.test.ts && pnpm --dir src/renderer typecheck`

Expected: exit code 0.

### Task 6: Add safe appointment link, bio, and preview metadata

**Files:**
- Modify: `src/renderer/src/utils/linkMetadata.ts`
- Modify: `src/renderer/src/utils/linkMetadata.test.ts`
- Modify: `src/renderer/src/components/dashboard/DashboardPage.tsx`
- Modify: `src/renderer/src/components/calendar/AppointmentModal.tsx`
- Modify: `src/renderer/src/styles/pages.css`

**Interfaces:**
- Produces: `getLinkPreview(url: string): { label: string; hostname: string; imageUrl: string } | null`.
- Consumes: `detectLinkMetadata(url)` and existing `Appointment.description` and `Appointment.link` fields.

- [ ] **Step 1: Add failing tests for valid and invalid preview links**

Assert `https`, `http`, and `mailto` rules. Assert `javascript:`, malformed URLs, and blank strings return `null`.

- [ ] **Step 2: Implement `getLinkPreview` in `linkMetadata.ts`**

Use a deterministic favicon URL from `https://www.google.com/s2/favicons?domain=<hostname>&sz=64` only for `http` or `https` links. Do not create previews for email links.

- [ ] **Step 3: Improve appointment editor labels and summary help**

Make description explicitly useful as notes or attendee context. Show link host context only after a valid URL is entered.

- [ ] **Step 4: Add reusable rich appointment row markup to the dashboard**

Show preview image when available. Show truncated description below the title. Show an accessible external link button only when a valid link exists.

- [ ] **Step 5: Run link tests and typecheck**

Run: `pnpm --dir src/renderer test -- linkMetadata.test.ts && pnpm --dir src/renderer typecheck`

Expected: exit code 0.

### Task 7: Verify authentication password visibility behavior

**Files:**
- Modify: `src/renderer/src/components/auth/AuthPage.tsx`
- Modify: `src/renderer/src/components/auth/auth.css`
- Modify: `src/renderer/src/stores/auth.test.ts`

**Interfaces:**
- Consumes: existing `showPw` state.
- Produces: one labelled password visibility control per visible password input.

- [ ] **Step 1: Add component-level coverage or DOM assertions for visibility controls**

Assert login and register each expose one button named show or hide password.

- [ ] **Step 2: Keep one button in the password input frame**

Remove any duplicate CSS pseudo-element or alternate control. Use a 44px interactive hit area with the existing accessible label.

- [ ] **Step 3: Run authentication tests and typecheck**

Run: `pnpm --dir src/renderer test -- auth.test.ts && pnpm --dir src/renderer typecheck`

Expected: exit code 0.

### Task 8: Validate end-to-end visual and production output

**Files:**
- Modify only if verification finds defects.

**Interfaces:**
- Consumes: Tasks 1-7.
- Produces: verified renderer output ready for a release build.

- [ ] **Step 1: Start the renderer and inspect dashboard, onboarding, tutorial, profile, devices, login, and appointment views**

Run: `pnpm --dir src/renderer dev`

Expected: all states render without console errors.

- [ ] **Step 2: Check reduced-motion and narrow-width layouts**

Verify no hidden tutorial content, duplicated password controls, profile routing failures, or red device errors.

- [ ] **Step 3: Run the complete verification suite**

Run: `pnpm --dir src/renderer typecheck && pnpm --dir src/renderer test && pnpm --dir src/renderer build`

Expected: exit code 0.

- [ ] **Step 4: Commit implementation**

```bash
git add src/renderer docs/superpowers
git commit -m "feat(ui): redesign dark glass experience"
```

## Self-Review

- Coverage: Tasks 1-2 cover the dark theme, intro, and tutorial. Task 3 covers profile navigation. Task 4 covers dashboard motion. Task 5 covers silent device failures. Task 6 covers links, bios, and images. Task 7 covers password visibility. Task 8 validates all requirements.
- Interfaces: `profile` is added before its consumers. Link preview metadata is defined before dashboard use. Device availability is produced before the device manager consumes it.
- Review Focus: Each listed failure mode is assigned to a task test.
- Proportion: Eight independently reviewable tasks separate shared styling, onboarding, navigation, motion, failure handling, appointment metadata, authentication, and final verification.
