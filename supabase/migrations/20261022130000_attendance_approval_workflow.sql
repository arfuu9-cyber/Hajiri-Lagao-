/*
  Attendance approval workflow to reduce attendance and payroll disputes.
  - Contractors can directly create final, approved attendance for their own team.
  - A linked worker can request today's attendance only; it remains pending.
  - Only the linked contractor can approve/reject a pending request.
  - Approved attendance is audited; payroll queries must count only approved rows.
*/

ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS marked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.attendance
  DROP CONSTRAINT IF EXISTS attendance_approval_status_check;
ALTER TABLE public.attendance
  ADD CONSTRAINT attendance_approval_status_check
  CHECK (approval_status IN ('pending', 'approved', 'rejected'));

-- Historical records are treated as approved so existing payroll does not disappear.
UPDATE public.attendance
SET approval_status = 'approved',
    approved_at = COALESCE(approved_at, time_in),
    updated_at = COALESCE(updated_at, time_in)
WHERE approval_status = 'pending' AND marked_by IS NULL AND approved_by IS NULL;

CREATE INDEX IF NOT EXISTS idx_attendance_approval_date
  ON public.attendance (approval_status, date DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_worker_approval
  ON public.attendance (worker_id, approval_status, date DESC);

CREATE OR REPLACE FUNCTION public.is_thekedar()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles p
    WHERE p.id = auth.uid() AND p.role = 'thekedar'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_labour()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles p
    WHERE p.id = auth.uid() AND p.role = 'labour'
  );
$$;

REVOKE ALL ON FUNCTION public.is_thekedar(), public.is_labour() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_thekedar(), public.is_labour() TO authenticated;

-- Every change gets a small immutable audit entry (who, when, old state, new state).
CREATE TABLE IF NOT EXISTS public.attendance_audit_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  attendance_id uuid NOT NULL,
  worker_id uuid NOT NULL,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL CHECK (action IN ('created', 'approved', 'rejected')),
  old_approval_status text,
  new_approval_status text NOT NULL,
  old_duty_multiplier numeric(3,1),
  new_duty_multiplier numeric(3,1),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.attendance_audit_log ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.attendance_audit_log TO authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.attendance_audit_log FROM anon, authenticated;
DROP POLICY IF EXISTS attendance_audit_select ON public.attendance_audit_log;
CREATE POLICY attendance_audit_select ON public.attendance_audit_log
  FOR SELECT TO authenticated
  USING (public.can_access_worker(worker_id));
-- No client INSERT/UPDATE/DELETE policies: entries are written only by the trigger.

CREATE OR REPLACE FUNCTION public.guard_attendance_approval_transition()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  is_today date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF public.is_thekedar() AND public.is_my_team_member(NEW.worker_id) THEN
      IF NEW.approval_status <> 'approved'
        OR NEW.marked_by IS DISTINCT FROM auth.uid()
        OR NEW.approved_by IS DISTINCT FROM auth.uid()
        OR NEW.approved_at IS NULL
        OR NEW.rejection_reason IS NOT NULL THEN
        RAISE EXCEPTION 'Thekedar attendance must be recorded as approved by the signed-in thekedar.';
      END IF;
    ELSIF public.is_labour() AND NEW.worker_id IN (SELECT public.my_worker_ids()) THEN
      IF NEW.date <> is_today
        OR NEW.status <> 'present'
        OR COALESCE(NEW.duty_multiplier, 1) <> 1
        OR NEW.approval_status <> 'pending'
        OR NEW.marked_by IS DISTINCT FROM auth.uid()
        OR NEW.approved_by IS NOT NULL
        OR NEW.approved_at IS NOT NULL
        OR NEW.rejection_reason IS NOT NULL THEN
        RAISE EXCEPTION 'Workers can only request their own attendance for today. The thekedar must approve it.';
      END IF;
    ELSE
      RAISE EXCEPTION 'You are not allowed to record attendance for this worker.';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NOT public.is_thekedar() OR NOT public.is_my_team_member(OLD.worker_id) THEN
      RAISE EXCEPTION 'Only the linked thekedar can review attendance requests.';
    END IF;
    IF OLD.approval_status NOT IN ('pending', 'rejected') OR NEW.approval_status NOT IN ('approved', 'rejected') THEN
      RAISE EXCEPTION 'Only pending or rejected attendance requests can be reviewed.';
    END IF;
    IF OLD.approval_status = 'rejected' AND NEW.approval_status <> 'approved' THEN
      RAISE EXCEPTION 'A rejected request can only be approved after a re-check.';
    END IF;
    IF NEW.id IS DISTINCT FROM OLD.id
      OR NEW.worker_id IS DISTINCT FROM OLD.worker_id
      OR NEW.date IS DISTINCT FROM OLD.date
      OR NEW.time_in IS DISTINCT FROM OLD.time_in
      OR NEW.status IS DISTINCT FROM OLD.status
      OR NEW.marked_by IS DISTINCT FROM OLD.marked_by THEN
      RAISE EXCEPTION 'Attendance identity and requester details cannot be changed during review.';
    END IF;
    IF NEW.approved_by IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'The reviewer must be the signed-in linked thekedar.';
    END IF;
    NEW.updated_at := now();
    IF NEW.approval_status = 'approved' THEN
      NEW.approved_at := now();
      NEW.rejection_reason := NULL;
    ELSE
      NEW.approved_at := NULL;
      NEW.rejection_reason := COALESCE(NULLIF(trim(NEW.rejection_reason), ''), 'Not approved by thekedar');
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_attendance_approval_transition ON public.attendance;
CREATE TRIGGER guard_attendance_approval_transition
  BEFORE INSERT OR UPDATE ON public.attendance
  FOR EACH ROW EXECUTE FUNCTION public.guard_attendance_approval_transition();

CREATE OR REPLACE FUNCTION public.write_attendance_audit_log()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.attendance_audit_log (
      attendance_id, worker_id, actor_id, action, old_approval_status,
      new_approval_status, old_duty_multiplier, new_duty_multiplier
    ) VALUES (
      NEW.id, NEW.worker_id, auth.uid(), 'created', NULL,
      NEW.approval_status, NULL, NEW.duty_multiplier
    );
    RETURN NEW;
  END IF;

  INSERT INTO public.attendance_audit_log (
    attendance_id, worker_id, actor_id, action, old_approval_status,
    new_approval_status, old_duty_multiplier, new_duty_multiplier
  ) VALUES (
    NEW.id, NEW.worker_id, auth.uid(),
    CASE WHEN NEW.approval_status = 'approved' THEN 'approved' ELSE 'rejected' END,
    OLD.approval_status, NEW.approval_status, OLD.duty_multiplier, NEW.duty_multiplier
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS attendance_audit_trigger ON public.attendance;
CREATE TRIGGER attendance_audit_trigger
  AFTER INSERT OR UPDATE ON public.attendance
  FOR EACH ROW EXECUTE FUNCTION public.write_attendance_audit_log();

-- Replace the old permissive insert/update policies from previous migrations.
DROP POLICY IF EXISTS attendance_insert ON public.attendance;
DROP POLICY IF EXISTS attendance_update ON public.attendance;
DROP POLICY IF EXISTS attendance_insert_approval_flow ON public.attendance;
DROP POLICY IF EXISTS attendance_update_approval_flow ON public.attendance;
DROP POLICY IF EXISTS attendance_delete ON public.attendance;

CREATE POLICY attendance_insert_approval_flow ON public.attendance
  FOR INSERT TO authenticated
  WITH CHECK (
    (
      public.is_thekedar()
      AND public.is_my_team_member(worker_id)
      AND approval_status = 'approved'
      AND marked_by = auth.uid()
      AND approved_by = auth.uid()
      AND approved_at IS NOT NULL
      AND rejection_reason IS NULL
    )
    OR
    (
      public.is_labour()
      AND worker_id IN (SELECT public.my_worker_ids())
      AND date = (now() AT TIME ZONE 'Asia/Kolkata')::date
      AND status = 'present'
      AND COALESCE(duty_multiplier, 1) = 1
      AND approval_status = 'pending'
      AND marked_by = auth.uid()
      AND approved_by IS NULL
      AND approved_at IS NULL
      AND rejection_reason IS NULL
    )
  );

CREATE POLICY attendance_update_approval_flow ON public.attendance
  FOR UPDATE TO authenticated
  USING (
    public.is_thekedar()
    AND public.is_my_team_member(worker_id)
    AND approval_status IN ('pending', 'rejected')
  )
  WITH CHECK (
    public.is_thekedar()
    AND public.is_my_team_member(worker_id)
    AND approval_status IN ('approved', 'rejected')
    AND approved_by = auth.uid()
    AND ((approval_status = 'approved' AND approved_at IS NOT NULL AND rejection_reason IS NULL)
      OR (approval_status = 'rejected' AND approved_at IS NULL AND rejection_reason IS NOT NULL))
  );

NOTIFY pgrst, 'reload schema';
