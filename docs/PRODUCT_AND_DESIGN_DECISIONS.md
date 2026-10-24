# Hajiri Lagao — Product, Feature and Design Decisions

## Product promise

Make the thekedar's daily work faster: open the app, select the team/site, mark attendance, record advances, then view a correct wage balance. The labour-side screen should show only today's attendance, attendance history, earnings/advance details and requests.

## Keep as core features

1. **Worker/team management:** name, phone, work type, wage, active/inactive status, and team invitation/linking.
2. **Daily attendance:** full day, half day, 1.5 duty, double duty and leave. One record per worker/day. Edit/correction history should be added before production.
3. **Khata/advance:** advance request, approval/verification, paid amount, pending amount and a readable ledger.
4. **Weekly/monthly payroll:** wage × duty multiplier + approved overtime − verified advances; show the arithmetic line-by-line and allow report export.
5. **History and exports:** daily records and salary statement; CSV/PDF/WhatsApp sharing with consent.
6. **Role-based access:** thekedar sees their team; a worker sees their own information; a gatekeeper sees only the specific site/pass they are authorized to verify.
7. **Hindi/Hinglish UX:** simple labels and large touch targets for users who may not be comfortable with complex apps.

## Keep, but only after end-to-end validation

- NFC cards: useful when cards are physically used on site, but always preserve manual attendance fallback.
- QR gate pass: useful for entry verification. A QR should contain a minimum identifier or short-lived signed token, not full worker data. Test camera scanning over HTTPS and establish gatekeeper permissions.
- Advance OTP: keep only with real SMS delivery, ownership checks, expiration, attempt limits, audit logs and no OTP returned by a production API.
- Location/photo-based verification: optional and consent-based. Do not require GPS or worker photos for ordinary attendance unless the customer needs them.

## Simplify or remove from the main navigation

- Keep bottom navigation to **Home, Hajiri/History, Mazdoor, Hisaab**. Move settings, language, NFC setup, gate pass, export and help into **More/Settings**.
- Avoid a dashboard with six equally prominent colourful actions. One primary CTA should be **Aaj ki hajiri lagao**, with Add Worker, Kharchi and Hisaab as secondary actions.
- Do not show the same attendance action in multiple cards/menus. Keep a single consistent route.
- Remove decorative animations that slow down a work task; keep short transitions only. Reduced-motion preference is respected by the updated global CSS.
- Do not show Aadhaar details in gate-pass screens or share worker ID documents through WhatsApp.

## Visual design system

- Primary: Hajiri Green `#0A6B4B` (the legacy Tailwind `navy-*` tokens now resolve to this green ramp).
- Page background: off-white `#F7F9F7`.
- Text: Deep Navy `#14213D`.
- Primary-action accent: Amber/Orange `#F59E0B`.
- Danger/error only: red tones. Success only: green tones. Avoid using purple, sky blue and pink as arbitrary decoration.
- Cards: white surface, `1px` light-green border, ~`20px` corner radius and subtle shadow.
- Touch targets: aim for at least `44×44px`; attendance buttons should be big and one-tap.
- Type: clear sentence-case headings, values larger than labels, no dense all-caps body text.
- Navigation: bottom bar with four core sections plus More/Settings; mark the current active tab clearly.
- Accessibility: visible keyboard focus, high contrast, non-colour status labels, safe-area padding and reduced-motion support.

## Dashboard order

1. Greeting + active site/team.
2. Main attendance progress with present / leave / pending counts.
3. One large **Hajiri lagao** button.
4. Quick actions: Add worker, Kharchi, Hisaab, History.
5. Financial/administrative cards: pending advance amount and current payroll total.
6. Recent activity, with reliable timestamps and who made a change.

## Add next (priority order)

### P0 — before real customers
- Run full typecheck/build and smoke-test the real Supabase project.
- Verify RLS with independent accounts and role-specific data access.
- Add an immutable audit record for attendance/payroll edits and explicit correction reasons.
- Connect and test a real SMS provider before enabling OTP in production.
- Use a configurable overtime rate and make payroll calculations auditable.
- Fix the gatekeeper ↔ thekedar ↔ site access model and test all scenarios.

### P1 — high practical value
- Offline attendance queue with stable client-generated IDs, retries, duplicate prevention and a visible pending-sync status.
- Multiple construction sites/projects, each with its own team, dates, expenses and reports.
- End-of-day expense summary and payroll close/reopen controls.
- Download/share PDF salary slips and receipts.
- A back-up/export recovery flow that explains whether it saves locally or remotely.

### P2 — later, after reliable usage
- Hindi voice entry with confirmation before writing records.
- Optional GPS/photo verification only for teams that need it.
- Smart insights about late attendance, weekly labour spend and pending payouts.

## Important data rules

- A `duty_multiplier` of `0` is leave and must never be counted as present.
- A missing attendance record is **pending/unmarked**, not confirmed absence. If confirmed absence is needed, model it explicitly rather than inferring it.
- An advance request is not a verified advance. Make every financial number clearly label pending vs verified vs paid.
- An app status marked “Paid” is an internal ledger entry unless an actual bank/UPI payment provider integration is configured.
- Never trust client-side role checks alone; enforce ownership and site membership in Supabase RLS/Edge Functions.
