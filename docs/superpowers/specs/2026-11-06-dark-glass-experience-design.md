# EXEECUTIVE Dark Glass Experience Design

## Intent

Replace the current inconsistent dashboard and settings experience with a coherent, dark, opaque glass desktop interface. The product must feel calm, precise, and responsive without visual noise.

## Visual direction

- Use a near-black neutral base: `#0a0c10` ground, opaque charcoal surfaces, softened borders, and a single lime-green data accent.
- Use layered opaque surfaces instead of transparent cards. Blur is reserved for transient overlays only.
- Keep one 16px card radius and a 10px control radius.
- Use accent colour on current data, selected state, and the primary action. Do not use red error panels.
- Use system UI typography with tabular figures for values that update.
- Use visible focus rings and `prefers-reduced-motion` fallbacks.

## Screen rules

### App shell

The sidebar stays on the neutral dark ground. Navigation selection changes brightness and surface tone. The profile row is pinned at the lower-left edge. Selecting that row opens a dedicated profile page.

### Welcome intro and tutorial

The first-run intro is a full-screen sequence with a concise value statement, a three-item product preview, and a clear start or skip action. It uses staggered opacity and transform entrances only.

The tutorial uses an opaque charcoal overlay and an opaque contextual card. Each step has plain language, a progress indicator, back/next actions, and a single target. It must never depend on a glow or a translucent panel.

### Dashboard

The dashboard prioritizes the month balance and its explanation. KPI values count up once when their source value changes. Delta arrows animate only during initial entry. The chart draws with a 500ms ease-out animation. Appointment rows show a preview image, title, appointment time, description, and a valid external link when present.

### Profile

Profile editing belongs to the lower-left sidebar account row. Settings no longer contains profile fields. The profile page presents identity, avatar initials, first name, last name, and save status in one focused view.

### Authentication

Each password input has exactly one visibility button. The visibility button remains inside the input frame with an accessible label.

### Devices

A missing `public.devices` schema must not render a red error panel or expose Supabase internals. Device management instead shows a neutral unavailable state. Other device failures use the same neutral state with a retry action.

### Appointments

Appointment detail surfaces valid external links, description as contextual bio, and a preview image. Link metadata determines host label and an image source derived from the host favicon. Unsafe or invalid links have no preview or link action.

## Acceptance criteria

- The desktop app uses one coherent opaque dark-glass token system across shell, panels, forms, lists, onboarding, and profile.
- First launch has a visible animated intro and a tutorial with an opaque overlay.
- Profile editing is available from the lower-left sidebar and absent from settings.
- Dashboard number counters, delta arrows, and chart animate with reduced-motion fallbacks.
- No duplicate password-eye controls render in authentication.
- Device schema errors never show raw errors or a red UI state.
- Appointment dashboard rows show description, link action, and preview image when data is available.
- Existing unit tests, typecheck, and production build pass.
