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


## Verified team connection and review queues

- A new worker account is not linked by name or phone alone. The worker scans/enters their individual code from **Team & Invite**; this creates a pending request.
- Only the thekedar assigned to that exact worker record can approve/reject the connection. A code by itself never makes the connection active.
- Thekedar can share a standards-compliant QR or copy a six-character code for a worker. Camera scanning uses `BarcodeDetector` when supported; manual entry is the fallback.
- A linked worker can request today's attendance. It stays pending until the linked thekedar approves it; payroll counts only approved records.
- After attendance or kharchi is approved/rejected, the request is removed from the pending queue immediately. Kharchi review is a database transaction, avoiding duplicate advances on retry. The advance stays unverified until worker OTP confirmation.
- Queue-loading failures are shown as errors rather than an empty/zero-pending state.
- Attendance decisions are recorded in the audit log; client-side hard deletion remains disabled by the attendance workflow migration.
- The Workers screen keeps the floating **Add Labor** shortcut for Helper/Karigar. The **Team & Invite** screen is a separate route available from the home dashboard.

### Required Supabase database setup

Before using these flows in production:

1. Apply `supabase/migrations/20261022130000_attendance_approval_workflow.sql` if not already successfully applied. It creates `attendance.approval_status`, approval guard/RLS policies and audit logging.
2. Apply `supabase/migrations/20261023110000_verified_connections_and_safe_request_review.sql` after the existing base/security and invite-code migrations. It installs connection request RPCs and atomic kharchi review. It also ensures `advance_requests` exists/has the needed review fields.
3. Read `docs/TEAM_CONNECTIONS_AND_REQUEST_QUEUE.md` and carry out the multi-account test plan before deploying to the live app.

If the app continues reporting `approval_status does not exist`, verify that Vercel's `VITE_SUPABASE_URL` matches the exact Supabase project where SQL was run. Frontend code cannot add a live database column by itself.


## Add Labor and verified connection UX

- The thekedar home screen has a fixed bottom-right **Add Labor** toggle, with Helper, Mason, and custom-role shortcuts.
- `Team & Invite` shows a per-worker invite code and QR. The worker submits a request, and only the owner thekedar can approve it.
- The approval screen displays the worker phone saved on the contractor record and the requesting account phone. A mismatch prompts a manual-identity-check warning; self-entered numbers are not SMS-verified.
- Approved/rejected attendance and kharchi requests are removed immediately from pending review cards. Their database history remains available.


## Mazdoor registration invite code

Apply `supabase/migrations/20261023120000_atomic_labour_registration_with_invite.sql` only after the base/security, invite-code, attendance-approval and verified-connection migrations. Registration validates the worker-specific invite code and creates a pending request atomically; the Thekedar must approve it before account linking.

## Registration reliability repair (2026-10-23)

- Thekedar/Gatekeeper self-registration now calls `register_account_with_role`, which saves the profile and the person's own worker row in one transaction.
- The function is retry-safe for the same account and does not silently change an existing profile's role.
- The registration screen has bounded request timeouts, visible error messages, and a `finally`-based loading reset.
- The Mazdoor invite-code input remains visible for the Mazdoor role and normalizes to six uppercase letters/numbers.
- Apply `supabase/migrations/20261023130000_idempotent_account_registration.sql` in Supabase after the base profile/worker schema exists. Mazdoor registration also needs the preceding verified-connection migrations and `20261023120000_atomic_labour_registration_with_invite.sql`.
- See `SETUP_HINDI.md` for GitHub/Vercel/Supabase setup and a manual test checklist.

Do not interpret a successful SQL-editor response as proof of end-to-end registration. Verify using separate test accounts against the exact Supabase project configured in Vercel.
