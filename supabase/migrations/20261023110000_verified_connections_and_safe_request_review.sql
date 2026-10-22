/*
  Hajiri Lagao: verified worker-to-thekedar linking and atomic advance review.
  Apply AFTER the base migrations, secure_data_access, invite_code and
  attendance_approval_workflow migrations. This migration also creates/updates
  advance_requests, so the earlier advance_requests migration is optional if
  that table is not already installed.
*/

-- Make the attendance approval schema resilient on projects where the column was missed.
ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS marked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.attendance DROP CONSTRAINT IF EXISTS attendance_approval_status_check;
ALTER TABLE public.attendance ADD CONSTRAINT attendance_approval_status_check
  CHECK (approval_status IN ('pending', 'approved', 'rejected'));
ALTER TABLE public.attendance ALTER COLUMN approval_status SET DEFAULT 'pending';

-- Existing legacy attendance should continue to count in old payroll reports.
UPDATE public.attendance
SET approval_status = 'approved',
    approved_at = COALESCE(approved_at, time_in),
    updated_at = COALESCE(updated_at, time_in)
WHERE approval_status IS NULL;
ALTER TABLE public.attendance ALTER COLUMN approval_status SET NOT NULL;

-- Invite code belongs to a specific worker record and is only a request token.
ALTER TABLE public.workers ADD COLUMN IF NOT EXISTS invite_code text;
UPDATE public.workers
SET invite_code = upper(substr(md5(random()::text || id::text || clock_timestamp()::text), 1, 6))
WHERE invite_code IS NULL OR trim(invite_code) = '';
CREATE UNIQUE INDEX IF NOT EXISTS workers_invite_code_unique_idx
  ON public.workers (invite_code) WHERE invite_code IS NOT NULL;
ALTER TABLE public.workers ALTER COLUMN invite_code
  SET DEFAULT upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));

-- Only the verified connection RPC may attach a login account to an existing worker row.
-- A direct browser insert must never let a thekedar attach an arbitrary auth user.
DROP POLICY IF EXISTS workers_insert ON public.workers;
CREATE POLICY workers_insert ON public.workers
  FOR INSERT TO authenticated
  WITH CHECK (
    (user_id = auth.uid() AND thekedar_id IS NULL)
    OR (user_id IS NULL AND thekedar_id IN (SELECT public.my_worker_ids()))
  );

CREATE OR REPLACE FUNCTION public.guard_worker_account_link_update()
RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id
     AND current_user NOT IN ('postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'Worker accounts can only be linked after the worker connection request is approved.';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS guard_worker_account_link_update ON public.workers;
CREATE TRIGGER guard_worker_account_link_update
  BEFORE UPDATE OF user_id ON public.workers
  FOR EACH ROW EXECUTE FUNCTION public.guard_worker_account_link_update();

-- A legacy/unassigned labour profile may sign in, but cannot submit attendance until it is linked.
CREATE OR REPLACE FUNCTION public.require_verified_worker_team_for_attendance()
RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.user_profiles p WHERE p.id = auth.uid() AND p.role = 'labour'
  ) AND NOT EXISTS (
    SELECT 1
    FROM public.workers w
    JOIN public.workers t ON t.id = w.thekedar_id
    JOIN public.user_profiles tp ON tp.id = t.user_id AND tp.role = 'thekedar'
    WHERE w.id = NEW.worker_id
      AND w.user_id = auth.uid()
      AND w.thekedar_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Pehle QR/invite code se sahi thekedar ke saath connection approve karwayein.';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS require_verified_worker_team_for_attendance ON public.attendance;
CREATE TRIGGER require_verified_worker_team_for_attendance
  BEFORE INSERT ON public.attendance
  FOR EACH ROW EXECUTE FUNCTION public.require_verified_worker_team_for_attendance();

-- Even if a legacy account has an unassigned worker row, an orphaned kharchi request is blocked.

CREATE TABLE IF NOT EXISTS public.team_connection_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id uuid NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
  thekedar_id uuid NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  review_note text
);

CREATE INDEX IF NOT EXISTS team_connection_requests_thekedar_status_idx
  ON public.team_connection_requests (thekedar_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS team_connection_requests_requester_idx
  ON public.team_connection_requests (requested_by, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS one_pending_connection_per_worker_idx
  ON public.team_connection_requests (worker_id) WHERE status = 'pending';

ALTER TABLE public.team_connection_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS team_connection_requests_select ON public.team_connection_requests;
CREATE POLICY team_connection_requests_select ON public.team_connection_requests
  FOR SELECT TO authenticated
  USING (
    requested_by = auth.uid()
    OR thekedar_id IN (SELECT id FROM public.workers WHERE user_id = auth.uid())
  );
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.team_connection_requests FROM anon, authenticated;
GRANT SELECT ON public.team_connection_requests TO authenticated;

-- Old invite-code function attached the worker immediately. Remove that shortcut.
DROP FUNCTION IF EXISTS public.claim_worker_by_code(text);

CREATE OR REPLACE FUNCTION public.request_team_connection(p_code text)
RETURNS TABLE(request_id uuid, worker_name text, thekedar_name text, status text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role text;
  v_worker record;
  v_existing record;
  v_request_id uuid;
  v_status text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in before requesting a team connection.'; END IF;
  SELECT p.role INTO v_role FROM public.user_profiles p WHERE p.id = auth.uid();
  IF v_role IS DISTINCT FROM 'labour' THEN
    RAISE EXCEPTION 'Only a registered mazdoor/karigar account can request a team connection.';
  END IF;
  IF p_code IS NULL OR upper(trim(p_code)) !~ '^[A-Z0-9]{6}$' THEN
    RAISE EXCEPTION 'Invite code must contain 6 letters or numbers.';
  END IF;

  SELECT w.id AS worker_id, w.name AS worker_name, w.user_id AS worker_user_id,
         w.thekedar_id, t.name AS thekedar_name, t.user_id AS thekedar_user_id
    INTO v_worker
  FROM public.workers w
  JOIN public.workers t ON t.id = w.thekedar_id
  JOIN public.user_profiles tp ON tp.id = t.user_id AND tp.role = 'thekedar'
  WHERE upper(w.invite_code) = upper(trim(p_code))
    AND COALESCE(w.active, true) = true
  LIMIT 1;

  IF NOT FOUND THEN RAISE EXCEPTION 'Invite code galat, expire, ya kisi active thekedar se linked nahi hai.'; END IF;
  IF v_worker.worker_user_id IS NOT NULL AND v_worker.worker_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Is worker profile se doosra account pehle hi linked hai. Thekedar se madad lo.';
  END IF;
  IF v_worker.worker_user_id = auth.uid() THEN
    RETURN QUERY SELECT NULL::uuid, v_worker.worker_name::text, v_worker.thekedar_name::text, 'approved'::text;
    RETURN;
  END IF;

  -- A worker may have one active thekedar link at a time; unassigned legacy profile rows are allowed.
  IF EXISTS (
    SELECT 1 FROM public.workers own_worker
    WHERE own_worker.user_id = auth.uid()
      AND own_worker.thekedar_id IS NOT NULL
      AND own_worker.id <> v_worker.worker_id
  ) THEN
    RAISE EXCEPTION 'Aapka account pehle se ek worker profile se linked hai. Duplicate hisaab se bachne ke liye usi profile ka use karein.';
  END IF;

  SELECT r.id, r.status, r.requested_by INTO v_existing
  FROM public.team_connection_requests r
  WHERE r.worker_id = v_worker.worker_id AND r.status = 'pending'
  LIMIT 1;
  IF FOUND THEN
    IF v_existing.requested_by = auth.uid() THEN
      RETURN QUERY SELECT v_existing.id, v_worker.worker_name::text, v_worker.thekedar_name::text, 'pending'::text;
      RETURN;
    END IF;
    RAISE EXCEPTION 'Is worker ke liye ek connection request pehle se pending hai.';
  END IF;

  INSERT INTO public.team_connection_requests (worker_id, thekedar_id, requested_by, status)
  VALUES (v_worker.worker_id, v_worker.thekedar_id, auth.uid(), 'pending')
  RETURNING id INTO v_request_id;
  RETURN QUERY SELECT v_request_id, v_worker.worker_name::text, v_worker.thekedar_name::text, 'pending'::text;
END;
$$;
REVOKE ALL ON FUNCTION public.request_team_connection(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_team_connection(text) TO authenticated;

DROP FUNCTION IF EXISTS public.list_my_team_connection_requests();
CREATE FUNCTION public.list_my_team_connection_requests()
RETURNS TABLE(
  request_id uuid,
  worker_id uuid,
  thekedar_id uuid,
  requested_by uuid,
  status text,
  created_at timestamptz,
  reviewed_at timestamptz,
  review_note text,
  worker_name text,
  worker_role text,
  thekedar_name text,
  requester_name text,
  worker_phone text,
  requester_phone text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.id, r.worker_id, r.thekedar_id, r.requested_by, r.status,
         r.created_at, r.reviewed_at, r.review_note,
         w.name, w.role, t.name, COALESCE(requester.display_name, w.name),
         w.phone, requester.phone
  FROM public.team_connection_requests r
  JOIN public.workers w ON w.id = r.worker_id
  JOIN public.workers t ON t.id = r.thekedar_id
  LEFT JOIN public.user_profiles requester ON requester.id = r.requested_by
  WHERE (
    EXISTS (SELECT 1 FROM public.user_profiles p WHERE p.id = auth.uid() AND p.role = 'thekedar')
    AND r.thekedar_id IN (SELECT id FROM public.workers WHERE user_id = auth.uid())
    AND r.status = 'pending'
  ) OR (
    EXISTS (SELECT 1 FROM public.user_profiles p WHERE p.id = auth.uid() AND p.role = 'labour')
    AND r.requested_by = auth.uid()
  )
  ORDER BY r.created_at DESC
  LIMIT 100;
$$;
REVOKE ALL ON FUNCTION public.list_my_team_connection_requests() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_my_team_connection_requests() TO authenticated;

CREATE OR REPLACE FUNCTION public.review_team_connection(p_request_id uuid, p_approve boolean, p_note text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role text;
  v_req record;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in again.'; END IF;
  SELECT p.role INTO v_role FROM public.user_profiles p WHERE p.id = auth.uid();
  IF v_role IS DISTINCT FROM 'thekedar' THEN RAISE EXCEPTION 'Only the thekedar can approve this connection.'; END IF;

  SELECT r.id, r.worker_id, r.thekedar_id, r.requested_by, r.status,
         w.user_id AS current_worker_user_id, w.thekedar_id AS current_thekedar_id,
         COALESCE(w.active, true) AS current_worker_active
    INTO v_req
  FROM public.team_connection_requests r
  JOIN public.workers w ON w.id = r.worker_id
  WHERE r.id = p_request_id
  FOR UPDATE OF r, w;
  IF NOT FOUND THEN RAISE EXCEPTION 'Connection request not found.'; END IF;
  IF v_req.status <> 'pending' THEN RAISE EXCEPTION 'Request pehle hi review ho chuki hai.'; END IF;
  IF v_req.current_thekedar_id IS DISTINCT FROM v_req.thekedar_id OR NOT v_req.current_worker_active THEN
    RAISE EXCEPTION 'Worker ab is thekedar se active nahi hai. Request refresh karein.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.workers t
    WHERE t.id = v_req.thekedar_id AND t.user_id = auth.uid()
  ) THEN RAISE EXCEPTION 'Yeh request aapki team ki nahi hai.'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles p WHERE p.id = v_req.requested_by AND p.role = 'labour'
  ) THEN RAISE EXCEPTION 'Requesting account mazdoor account nahi hai.'; END IF;
  IF v_req.current_worker_user_id IS NOT NULL AND v_req.current_worker_user_id <> v_req.requested_by THEN
    RAISE EXCEPTION 'Yeh worker profile already doosre account se linked hai.';
  END IF;

  IF p_approve THEN
    IF EXISTS (
      SELECT 1 FROM public.workers own_worker
      WHERE own_worker.user_id = v_req.requested_by
        AND own_worker.thekedar_id IS NOT NULL
        AND own_worker.id <> v_req.worker_id
    ) THEN
      RAISE EXCEPTION 'Mazdoor account pehle se doosre worker profile se linked hai. Duplicate hisaab se bachne ke liye pehle old connection resolve karein.';
    END IF;
    UPDATE public.workers SET user_id = v_req.requested_by WHERE id = v_req.worker_id;
    UPDATE public.team_connection_requests
      SET status = 'approved', reviewed_by = auth.uid(), reviewed_at = now(), review_note = NULL
      WHERE id = v_req.id;
  ELSE
    UPDATE public.team_connection_requests
      SET status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(),
          review_note = COALESCE(NULLIF(trim(p_note), ''), 'Thekedar ne request approve nahi ki')
      WHERE id = v_req.id;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.review_team_connection(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_team_connection(uuid, boolean, text) TO authenticated;

-- Kharchi-request decisions happen transactionally, so approving cannot create duplicate advances.
CREATE TABLE IF NOT EXISTS public.advance_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id uuid NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  note text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.advance_requests
  ADD COLUMN IF NOT EXISTS advance_id uuid REFERENCES public.advances(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS review_note text;
ALTER TABLE public.advance_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS adv_req_select ON public.advance_requests;
DROP POLICY IF EXISTS adv_req_insert ON public.advance_requests;
DROP POLICY IF EXISTS adv_req_update ON public.advance_requests;
DROP POLICY IF EXISTS advance_requests_select_scoped ON public.advance_requests;
DROP POLICY IF EXISTS advance_requests_insert_scoped ON public.advance_requests;
CREATE POLICY advance_requests_select_scoped ON public.advance_requests
  FOR SELECT TO authenticated USING (public.can_access_worker(worker_id));
CREATE POLICY advance_requests_insert_scoped ON public.advance_requests
  FOR INSERT TO authenticated WITH CHECK (
    worker_id IN (SELECT public.my_worker_ids()) AND status = 'pending'
    AND advance_id IS NULL AND reviewed_by IS NULL AND reviewed_at IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.workers w
      JOIN public.workers t ON t.id = w.thekedar_id
      JOIN public.user_profiles tp ON tp.id = t.user_id AND tp.role = 'thekedar'
      WHERE w.id = advance_requests.worker_id
        AND w.user_id = auth.uid()
        AND w.thekedar_id IS NOT NULL
    )
  );
REVOKE UPDATE, DELETE, TRUNCATE ON public.advance_requests FROM anon, authenticated;
GRANT SELECT, INSERT ON public.advance_requests TO authenticated;

CREATE OR REPLACE FUNCTION public.review_advance_request(p_request_id uuid, p_approve boolean, p_note text DEFAULT NULL)
RETURNS TABLE(result_request_id uuid, result_advance_id uuid, result_status text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role text;
  v_req record;
  v_advance_id uuid := NULL;
  v_new_status text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in again.'; END IF;
  SELECT p.role INTO v_role FROM public.user_profiles p WHERE p.id = auth.uid();
  IF v_role IS DISTINCT FROM 'thekedar' THEN RAISE EXCEPTION 'Only the thekedar can review kharchi requests.'; END IF;

  SELECT ar.id, ar.worker_id, ar.amount, ar.note, ar.status, ar.advance_id
    INTO v_req
  FROM public.advance_requests ar
  WHERE ar.id = p_request_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Kharchi request nahi mili.'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.workers w
    WHERE w.id = v_req.worker_id AND w.thekedar_id IN (SELECT id FROM public.workers WHERE user_id = auth.uid())
  ) THEN RAISE EXCEPTION 'Yeh request aapki team ki nahi hai.'; END IF;
  IF v_req.status <> 'pending' THEN RAISE EXCEPTION 'Kharchi request pehle hi review ho chuki hai.'; END IF;

  IF p_approve THEN
    INSERT INTO public.advances (worker_id, amount, date, note, given_by, status)
    VALUES (
      v_req.worker_id, v_req.amount, (now() AT TIME ZONE 'Asia/Kolkata')::date,
      COALESCE(NULLIF(trim(v_req.note), ''), 'Worker kharchi request'), auth.uid(), 'pending'
    ) RETURNING id INTO v_advance_id;
    v_new_status := 'approved';
    UPDATE public.advance_requests
      SET status = 'approved', advance_id = v_advance_id,
          reviewed_by = auth.uid(), reviewed_at = now(), review_note = NULL
      WHERE id = v_req.id;
  ELSE
    v_new_status := 'rejected';
    UPDATE public.advance_requests
      SET status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(),
          review_note = COALESCE(NULLIF(trim(p_note), ''), 'Thekedar ne request approve nahi ki')
      WHERE id = v_req.id;
  END IF;

  RETURN QUERY SELECT v_req.id, v_advance_id, v_new_status;
END;
$$;
REVOKE ALL ON FUNCTION public.review_advance_request(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_advance_request(uuid, boolean, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
