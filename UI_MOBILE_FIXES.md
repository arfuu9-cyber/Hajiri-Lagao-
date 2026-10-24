# Hajiri Lagao — Mobile UI refresh

This update focuses on a consistent mobile-first layout while keeping the existing app routes, Supabase calls, and feature logic intact.

## What changed
- Global layout prevents horizontal page overflow and handles narrow 320px Android screens.
- Viewport-aware `100dvh` sizing and safe-area spacing for modern mobile browsers.
- Responsive form controls use a mobile-safe 16px font to avoid browser zoom and fit the available width.
- Consistent soft card borders/shadows, more balanced spacing, and wrap-safe names/labels.
- Bottom navigation has compact labels and respects the device safe area; extra bottom space prevents content from hiding behind it.
- The floating Add Labour control stays above the bottom navigation on small screens.
- Reduced-motion support is preserved.

## What was not changed
- No data tables, Supabase queries, authentication behavior, or app feature routes were intentionally rewritten in this UI-only pass.
- This does not by itself solve database permissions, stale profiles, or the registration role conflict shown in previous screenshots.

## Verification
- Source CSS and JSX edits were manually reviewed.
- A full Vite build/typecheck could not be confirmed in this workspace because dependency installation did not complete. Run `npm ci`, then `npm run typecheck` and `npm run build` before deploying.
