# Verified Team Connections and Request Queue

## What changed

- A new labour account is created as a user profile first. It is not automatically attached to a worker record.
- A thekedar opens **Team & Invite** and shares that worker's six-character invite code or QR. Every code points at one worker record already assigned to that thekedar.
- The worker enters/scans the code to create a **pending connection request**. Code entry alone never links the accounts.
- Only the thekedar who owns that exact worker record can approve or reject the request. The request card compares the saved worker phone with the registering account phone; mismatches trigger a confirmation warning. Phone entered during registration is self-reported unless a phone-auth/SMS verification provider is connected, so confirm identity in person when numbers do not match.
- On approval, the database sets `workers.user_id` to the requesting labour account. The link check is enforced in a SECURITY DEFINER RPC; table RLS blocks clients from writing connection decisions directly. A trigger also blocks direct browser updates to a worker row’s account link, and insert policy prevents attaching another user account when a thekedar creates a worker.
- A worker account is limited to one active worker profile by the server, preventing duplicate payroll records even under the same thekedar. Old unassigned legacy rows are not automatically deleted, but they cannot submit attendance or kharchi until the verified team connection is active.
- QR scanning uses the browser `BarcodeDetector` where available. Manual code entry stays available as fallback.
- Attendance decisions remove the request from the pending review queue immediately. Kharchi review is performed in one database transaction, then the pending card disappears. The linked worker can confirm or dispute the advance inside the app; it will not create the advance a second time on retry.
- Request-loading errors are now shown as errors rather than being falsely reported as “no requests”.

## Required Supabase SQL steps

**Back up/export important data first. Do not paste any service-role key into the browser app.**

For a project using the existing migration set, apply in this order if not already successfully applied:

1. `20261022130000_attendance_approval_workflow.sql` — this is required for `attendance.approval_status`, approval trigger/RLS rules and audit logging. It addresses the missing-column error visible in the user's screenshot.
2. `20261023100000_advance_requests.sql` — optional if the table and its existing policies are already present; the newer migration creates/updates the table too. If it is already installed, do not run it a second time because its policy names aren't all idempotent.
3. `20261023110000_verified_connections_and_safe_request_review.sql` — adds verified connection requests, the new RPCs and safer transactional kharchi review.

Use Supabase Dashboard → SQL Editor and execute the whole contents of the selected migration. If a migration returns an error, stop there, save the full error text, and do not assume the rest of the SQL succeeded. The migrations folder has earlier prerequisites (`user_profiles`, `workers`, `advances`, and `secure_data_access`) that must already exist.

If `attendance.approval_status` is still missing after step 1, compare the exact `VITE_SUPABASE_URL` in Vercel with the project URL shown at the top of the Supabase Dashboard. They must point to the same project. The new frontend code cannot alter a live database schema by itself.

## Manual test plan

1. Create a test thekedar account and a worker in that team's Workers screen.
2. Open Team & Invite and note that worker's code/QR.
3. Sign in with a separate labour account, open Connect Thekedar, scan the QR or type the code, and send the request.
4. Verify the labour account sees **Pending** but does not yet gain access to that team's attendance/payroll.
5. On the correct thekedar account, approve the request. Verify the item leaves the incoming queue and the worker shows as connected.
6. Sign in as the connected worker and request today's attendance. Confirm the thekedar sees one pending item. Approve it; confirm it disappears from the pending list and only one approved attendance row exists for that worker/date.
7. Submit a kharchi request. Approve it as thekedar; confirm the pending request disappears and exactly one `advances` row is created. The advance should appear in the linked worker account for in-app confirmation or dispute; no SMS provider is required.
8. Repeat with a second unrelated thekedar. They must not be able to view/approve the first thekedar's requests.

## Not a guarantee of fraud-free physical attendance

This system limits account linking and records every approval. It cannot prove that a person physically worked at the site. For higher assurance, add supervisor/site verification, time/location evidence with consent, and a dispute/correction workflow. Do not present QR codes or invite codes as identity proof by themselves.
