# Attendance Approval and Add Worker

## Attendance flow

1. Thekedar adds a worker from **Add Labor**. The worker receives an individual invite code/QR in **Team & Invite**.
2. The labour account enters/scans the invite. This creates a pending team connection request; it does not link accounts immediately.
3. Only the thekedar responsible for that worker record can approve/reject the connection. After approval, the worker account becomes linked to that exact row.
4. A linked worker may request only their own full-day attendance for today's India date. It remains pending until the linked thekedar approves it.
5. The thekedar can approve full/half day or reject with a reason. Reviewed entries leave the pending queue; they remain in attendance history and audit logs.
6. Payroll and wage totals count only approved attendance. The unique `(worker_id, date)` rule prevents duplicate daily entries.

## Kharchi flow

1. A linked worker sends a kharchi request.
2. The linked thekedar can approve or reject. The database transaction changes the request status and creates at most one advance row.
3. Once reviewed, the kharchi request leaves the pending queue immediately.
4. An approved advance remains `pending` until worker OTP verification succeeds; this prevents an unverified advance from being deducted in payroll. Real OTP delivery still requires an SMS provider.

## Team & Invite screen

- Thekedar sees pending join requests and can approve/reject each one.
- Thekedar sees individual worker invite codes and a standards-based QR code.
- Worker can scan on supported HTTPS browsers or enter the six-character code manually.
- A request is routed to the thekedar already assigned to the specific worker row; the worker cannot select an arbitrary contractor by phone number.
- Team requests are scoped using Supabase RLS and server-side RPC checks. A code alone is never enough to create an active connection.

## Floating Add Labor toggle

On the Workers screen, thekedar's floating **Add Labor** button expands shortcuts for **Add Mazdoor / Helper** and **Add Karigar / Mistri**. The selected trade is prefilled while existing validations and wage fields remain available.

## Required manual tests

- Correct thekedar can approve an invite; another thekedar cannot.
- Worker cannot mark attendance for another worker or a different date.
- Attendance request disappears from pending after approve/reject, and approved attendance counts in payroll exactly once.
- Advance request disappears from pending after approve/reject, and only one advance row is made when approved.
- OTP failure shows a warning but does not recreate the approved advance if the reviewer retries.
- Invite code by itself does not create a link before thekedar approval.
- Request lists show a fetch error instead of falsely saying there are zero requests.
- `attendance_audit_log` records attendance actions; app-side hard delete is disabled.

Apply `supabase/migrations/20261022130000_attendance_approval_workflow.sql` and the documented connection migration before testing. Build and database/RLS tests are mandatory before production deployment.


## Verified team connection (latest)

New labour registration saves the phone entered during registration to `user_profiles.phone` for comparison with the worker row. The thekedar screen shows both values; mismatches need a manual identity check before approval. A self-entered phone is not considered SMS-verified. Apply `20261023110000_verified_connections_and_safe_request_review.sql` after its documented prerequisites.
