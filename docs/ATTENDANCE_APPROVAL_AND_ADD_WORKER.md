# Attendance Approval and Add Worker UI

## Attendance flow

1. The thekedar creates/links the worker record. The worker joins that existing record with the invite code; this keeps `workers.user_id` and `workers.thekedar_id` connected.
2. A worker may submit a request only for their own attendance and only for today's date. A worker cannot choose half-day/double-day, approve a request, or update a saved request.
3. The row has `approval_status = pending`, `marked_by` set to the requesting login, and no approver.
4. The linked thekedar reviews the request on the Home dashboard. They may approve full day, approve half day, or reject it with a reason. If an earlier rejection is reconsidered, the thekedar can approve it after re-checking.
5. Payroll, earnings, and balance calculations count only approved attendance. Pending/rejected requests remain visible in history for transparency.
6. Every insert/review creates an `attendance_audit_log` entry. A unique `(worker_id, date)` rule prevents double entries, and client hard-delete is disabled so review history is not erased through the app.

## Floating Add Labor toggle

On the Workers screen, only a thekedar sees the floating **Add Labor** button above bottom navigation. Tapping it expands two choices: **Add Mazdoor / Helper** and **Add Karigar / Mistri**. Selecting a choice opens the existing Add Worker form with the trade preselected; all existing validations and wage fields remain available. Gatekeepers do not see the add button.

## Required manual tests

- Thekedar account can mark an attached worker present; the record is approved and appears in payroll.
- Worker account submits their own request; it is pending and wages do not increase yet.
- Worker cannot submit attendance for another worker, a different date, or a half/double-day value.
- Contractor A cannot approve Contractor B's worker.
- Approving a request adds approved attendance to payroll exactly once; trying to submit a duplicate on the same date fails.
- Rejecting requires a reason, appears in both sides' history, does not count in payroll, and the linked thekedar can approve it after re-checking.
- RLS prevents worker updates to attendance and app-side deletion. Audit rows show the acting account and old/new approval state.
- In the Workers screen, tap Add Labor, tap each submenu choice, and confirm role is preselected and can still be changed.

Do not deploy before applying the new SQL migration and testing against separate test accounts.
