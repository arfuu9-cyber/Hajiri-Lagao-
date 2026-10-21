# Hajiri Lagao — Updated Project

Mobile-first construction workforce app for thekedar and mazdoor teams. The codebase remains React + TypeScript + Vite + Supabase + Capacitor; this update does not rebuild the project from scratch.

## What's updated in this package

- Refined the visual foundation to an accessible Hajiri Green, off-white, deep neutral text and restrained amber action palette. Existing `navy-*` Tailwind class names are preserved as a backwards-compatible green ramp.
- Added focus-visible states, larger tap affordances, safe-area CSS utility and reduced-motion support.
- Corrected dashboard totals: full/half/extra duty count as present, duty multiplier `0` counts as leave, and workers without a recorded attendance are labelled as attendance pending.
- Fixed the weekly wage summary query so it loads worker IDs along with wage rates. The weekly summary also includes the currently configured overtime rate.
- Fixed the “pending advance” number to sum only advances with `status = 'pending'`.
- Replaced the hand-drawn fake QR pattern with a standards-compliant QR encoder (bundled ESM conversion of the MIT-licensed Kazuhiko Arase QRCode JavaScript implementation; see `src/utils/qrcode-vendor/LICENSE.txt`).
- Added a camera QR detection path through the browser's `BarcodeDetector` API. Devices/browsers without it receive a clear manual-ID fallback.
- Restricted the gatekeeper's worker lookup to fields needed to verify a pass; Aadhaar data is no longer selected/displayed in this gate-pass lookup. Aadhaar number/photo capture has also been removed from new-user registration because it is not necessary for daily attendance.
- Hardened advance OTP edge function: checks whether the signed-in user is the worker or their thekedar, throttles repeated wrong OTP attempts, and disables test OTP exposure unless explicitly opted into for a non-production environment.

## Setup

1. Install Node.js 20+.
2. Copy `.env.example` to `.env.local`.
3. Fill `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` using your Supabase project settings. The frontend must only use the anon/publishable key; never expose the service-role key.
4. Install dependencies: `npm ci`.
5. Start locally: `npm run dev`.
6. Verify static types and production build: `npm run typecheck` and `npm run build`.
7. For Android, run `npm run cap:sync`, then open the Android folder in Android Studio.

## Important before production launch

- **Build not verified in this packaging environment:** npm dependencies were not available offline and package registry installation timed out, so `npm run typecheck`, `npm run build`, and device testing still need to be run in your development environment.
- **Supabase setup is still required:** deploy every migration in `supabase/migrations` to a test project first, verify RLS with at least two unrelated thekedar accounts plus a worker and a gatekeeper, then promote to production.
- **OTP SMS is not wired to a real SMS provider yet.** For local-only testing, you may explicitly set the Supabase Edge Function secret `ALLOW_DEV_OTP=true` and ensure `DENO_ENV` is not `production`. Do not enable this on a live project. Before launch, integrate MSG91, Twilio or another SMS gateway in `supabase/functions/advance-otp/index.ts` and remove development OTP exposure.
- **Camera QR support varies.** Built-in scanning requires a modern browser with `BarcodeDetector` support and camera permission over HTTPS; manual thekedar ID entry remains available as fallback.
- **Gate-pass authorization needs an end-to-end role test.** The current database RLS policy for `gate_passes` is thekedar-owner oriented. Do not assume a separate gatekeeper account can create/use every pass until its access model has been explicitly tested and authorized.
- **Offline attendance queue is not included yet.** At present, failed network calls still need a usable connection. Add an idempotent local queue and sync conflict handling in a future phase.
- **Overtime rate is currently fixed at ₹50/hour.** Make it configurable per thekedar/site before relying on it for real payroll.
- **Existing Aadhaar data is not automatically deleted.** The registration flow no longer collects Aadhaar numbers or ID photos. The legacy database columns and bucket may still contain previously saved data; review retention needs, back up first, then clear old values/files through an explicitly approved cleanup procedure. Keep the ID-photo bucket private.
- **This app records payments; it does not automatically transfer money to a worker's bank/UPI.**

## Repo map

- `src/screens/` — mobile screens
- `src/components/` — shared UI elements
- `src/services/` — Supabase/database service functions
- `src/context/` — authentication and language state
- `supabase/migrations/` — database migrations/RLS
- `supabase/functions/` — Edge Functions
- `design/design-preview.png` — supplied design preview

See `docs/PRODUCT_AND_DESIGN_DECISIONS.md` for which features to keep, simplify, defer or remove.


## Attendance request and anti-fraud approval workflow

The updated app supports linked contractor/worker attendance review:

- The contractor can directly mark their linked crew's final attendance.
- A linked worker can request only their own full-day attendance for the current India date. The request stays **pending** until the linked contractor approves it.
- The contractor can approve full-day or half-day attendance, or reject with a reason. Rejected requests remain visible and can be approved later after re-checking.
- Payroll and wage totals query only `approval_status = 'approved'`.
- `attendance_audit_log` records who created/reviewed attendance, the old/new approval state, and duty multiplier. Client-side hard deletion of attendance is disabled by the migration.
- The Workers screen has a floating, expandable **Add Labor** action with shortcuts for Helper and Mason/Karigar. The selected role can still be changed on the form.

### Required database migration

Before using these flows against Supabase, apply the new migration `supabase/migrations/20261022130000_attendance_approval_workflow.sql` after the existing migrations. It adds columns, approval policies, audit logging, and role/team checks. Apply it in a test Supabase project first, then test with two separate accounts (one thekedar and one worker linked by the invite code).

A worker request must not be treated as final pay until approved. The database migration is a required part of this feature; updating frontend code alone does not secure old backend policies.
