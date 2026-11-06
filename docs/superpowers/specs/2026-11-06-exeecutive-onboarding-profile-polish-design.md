# EXEECUTIVE Onboarding and Profile Design

## Intent

Make first use clear and professional. Fix visible device errors. Make financial numbers animate in display units. Add resend confirmation, persistent-session choice, profile initials, guided onboarding, richer appointments, and safe link icons.

## Goals

- Show resend confirmation action with a 60-second local cooldown.
- Show signup success state and allow login after email confirmation.
- Add remember-me choice. Checked keeps session. Unchecked clears session on app exit.
- Ask first name and last name at registration.
- Show profile avatar with initials in sidebar.
- Allow editing profile name and avatar color or image choice stored locally/cloud-safe.
- Show first-run animated welcome and guided tutorial.
- Include `Salta tutorial`. Persist completion per account and allow restart from Settings.
- Highlight real controls with an overlay, spotlight, connector, label, Next, Back, and Skip.
- Animate KPI values using display units. Animate chart drawing. Respect reduced motion.
- Fix all object errors through structured error normalization.
- Add appointment description and optional meeting/link field.
- Detect supported URLs and display a safe local icon. Never fetch remote HTML or execute remote content.
- Add CSP, input validation, parameterized SQL, safe error rendering, and no secret logging.

## Non-goals and security boundary

- No anti-debugging, anti-VM, anti-analysis, debugger detection, or process termination. Those techniques harm legitimate users and resemble evasion.
- No credential scraping, remote code execution, or hidden persistence.
- No remote image fetching from arbitrary URLs. Avatar image upload is local and size/type constrained.
- No public release without explicit user confirmation.

## Decisions

- Tutorial is skippable. `Salta tutorial` exits immediately to the dashboard.
- Tutorial runs after first successful authenticated session, not before email confirmation.
- Remember-me default is off. Checked session uses local storage. Unchecked session uses session storage and clears on app exit.
- Initial avatar uses first letters of first and last name. User may choose a preset color and local image under a strict size limit.
- `other` errors normalize to a safe message. Never render raw object stringification.
- Store monetary values as minor units. Pass major display values to count-up animation.
- Link detection supports Google Meet, Zoom, Microsoft Teams, Webex, generic HTTP(S), and calendar mail links. Icons are static local assets or Tabler icons.
- Appointment description preview is truncated to available card width. Link appears below title when present.

## Acceptance criteria

1. Signup asks first name and last name.
2. Unconfirmed signup shows resend button. Button is disabled for 60 seconds after send and shows remaining seconds.
3. Confirmed signup can continue into app without duplicate registration.
4. Remember-me choice controls session persistence after app exit.
5. Sidebar shows initials and opens profile settings.
6. First authenticated entry shows animated intro with Skip.
7. Tutorial spotlight points at dashboard, navigation, quick add, settings, calendar, finance, and notifications.
8. Tutorial state persists per account and can restart from Settings.
9. `20` entered as an amount displays as `20`, not `2000`.
10. KPI and chart animations start at zero or baseline and respect reduced motion.
11. Device errors render readable text, never `[object Object]`.
12. Appointment link and description appear safely in calendar cards.
13. Malformed links cannot execute code or escape the app.
14. Typecheck, tests, Rust check, and local installer build pass.
