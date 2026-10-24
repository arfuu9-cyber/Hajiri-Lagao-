/*
  Hajiri Lagao repair migration (safe to re-run).
  Repairs the exact live errors:
    - attendance.rejection_reason missing
    - review_advance_request missing from the PostgREST schema cache
  Also aligns the in-app kharchi confirmation RPCs with the current frontend.
*/

-- 1) Fix the missing attendance column reported by the live app.
ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS rejection_reason text;

-- 2) Ensure advance verification fields exist for the OTP-free in-app flow.
ALTER TABLE public.advances
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS given_by uuid,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS verified_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS verification_method text,
  ADD COLUMN IF NOT EXISTS disputed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS disputed_at timestamptz,
  ADD COLUMN IF NOT EXISTS dispute_reason text;

-- Replace legacy status CHECK constraints so the in-app flow can use pending/verified/disputed.
DO $$
DECLARE
  v_constraint record;
BEGIN
  FOR v_constraint IN
    SELECT c.conname
    FROM pg_constraint c
    WHERE c.conrelid = 'public.advances'::regclass
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE public.advances DROP CONSTRAINT %I', v_constraint.conname);
  END LOOP;
END $$;

-- Keep legacy records usable: old approved advances count as verified, rejected as disputed.
UPDATE public.advances SET status = 'verified' WHERE status = 'approved';
UPDATE public.advances SET status = 'disputed' WHERE status = 'rejected';
UPDATE public.advances SET status = 'pending' WHERE status IS NULL OR trim(status) = '';
-- Preserve advances verified by the previous OTP flow if status was added later.
UPDATE public.advances SET status = 'verified' WHERE status = 'pending' AND verified_at IS NOT NULL;
UPDATE public.advances
SET status = CASE
  WHEN lower(status) IN ('verified', 'confirmed', 'received') THEN 'verified'
  WHEN lower(status) IN ('disputed', 'rejected', 'declined') THEN 'disputed'
  ELSE 'pending'
END
WHERE status NOT IN ('pending', 'verified', 'disputed');

ALTER TABLE public.advances ALTER COLUMN status SET DEFAULT 'pending';
ALTER TABLE public.advances ALTER COLUMN status SET NOT NULL;
ALTER TABLE public.advances
  ADD CONSTRAINT advances_status_check
  CHECK (status IN ('pending', 'verified', 'disputed'));

ALTER TABLE public.advances
  DROP CONSTRAINT IF EXISTS advances_verification_method_check;
UPDATE public.advances
SET verification_method = NULL
WHERE verification_method IS NOT NULL
  AND verification_method NOT IN ('in_app', 'worker_dispute');
ALTER TABLE public.advances
  ADD CONSTRAINT advances_verification_method_check
  CHECK (verification_method IS NULL OR verification_method IN ('in_app', 'worker_dispute'));

CREATE INDEX IF NOT EXISTS advances_pending_worker_idx
  ON public.advances (worker_id, created_at DESC)
  WHERE status = 'pending';

-- 3) Ensure the request table and review metadata exist.
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
  FOR SELECT TO authenticated
  USING (public.can_access_worker(worker_id));
CREATE POLICY advance_requests_insert_scoped ON public.advance_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    worker_id IN (SELECT public.my_worker_ids())
    AND status = 'pending'
    AND advance_id IS NULL
    AND reviewed_by IS NULL
    AND reviewed_at IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.workers w
      JOIN public.user_profiles p ON p.id = auth.uid() AND p.role = 'labour'
      WHERE w.id = advance_requests.worker_id
        AND w.user_id = auth.uid()
        AND w.thekedar_id IS NOT NULL
    )
  );
GRANT SELECT, INSERT ON public.advance_requests TO authenticated;
REVOKE UPDATE, DELETE, TRUNCATE ON public.advance_requests FROM anon, authenticated;

-- Remove old function signatures, then create one signature matching the frontend RPC keys.
DROP FUNCTION IF EXISTS public.review_advance_request(uuid, boolean, text);
DROP FUNCTION IF EXISTS public.review_advance_request(boolean, text, uuid);

CREATE FUNCTION public.review_advance_request(
  p_approve boolean,
  p_note text,
  p_request_id uuid
)
RETURNS TABLE (
  result_request_id uuid,
  result_advance_id uuid,
  result_status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_req record;
  v_advance_id uuid := NULL;
  v_new_status text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in again.';
  END IF;

  SELECT p.role INTO v_role
  FROM public.user_profiles p
  WHERE p.id = auth.uid();

  IF v_role IS DISTINCT FROM 'thekedar' THEN
    RAISE EXCEPTION 'Only the thekedar can review kharchi requests.';
  END IF;

  SELECT ar.id, ar.worker_id, ar.amount, ar.note, ar.status, ar.advance_id
  INTO v_req
  FROM public.advance_requests ar
  WHERE ar.id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Kharchi request nahi mili.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.workers w
    JOIN public.workers t ON t.id = w.thekedar_id
    WHERE w.id = v_req.worker_id
      AND t.user_id = auth.uid()
      AND lower(t.role) = 'thekedar'
  ) THEN
    RAISE EXCEPTION 'Yeh request aapki team ki nahi hai.';
  END IF;

  IF v_req.status <> 'pending' THEN
    RAISE EXCEPTION 'Kharchi request pehle hi review ho chuki hai.';
  END IF;

  IF p_approve THEN
    INSERT INTO public.advances (worker_id, amount, date, note, given_by, status)
    VALUES (
      v_req.worker_id,
      v_req.amount,
      (now() AT TIME ZONE 'Asia/Kolkata')::date,
      COALESCE(NULLIF(trim(v_req.note), ''), 'Worker kharchi request'),
      auth.uid(),
      'pending'
    )
    RETURNING id INTO v_advance_id;

    v_new_status := 'approved';
    UPDATE public.advance_requests
    SET status = 'approved',
        advance_id = v_advance_id,
        reviewed_by = auth.uid(),
        reviewed_at = now(),
        review_note = NULL
    WHERE id = v_req.id;
  ELSE
    v_new_status := 'rejected';
    UPDATE public.advance_requests
    SET status = 'rejected',
        reviewed_by = auth.uid(),
        reviewed_at = now(),
        review_note = COALESCE(NULLIF(trim(p_note), ''), 'Thekedar ne request approve nahi ki')
    WHERE id = v_req.id;
  END IF;

  RETURN QUERY SELECT v_req.id, v_advance_id, v_new_status;
END;
$$;

-- 4) Worker-only pending kharchi list.
CREATE OR REPLACE FUNCTION public.list_my_pending_advances()
RETURNS TABLE (id uuid, worker_id uuid, amount numeric, date date, note text, created_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.id, a.worker_id, a.amount, a.date, a.note, a.created_at
  FROM public.advances a
  JOIN public.workers w ON w.id = a.worker_id
  WHERE auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.user_profiles p
      WHERE p.id = auth.uid() AND p.role = 'labour'
    )
    AND w.user_id = auth.uid()
    AND a.status = 'pending'
  ORDER BY a.created_at DESC
  LIMIT 20;
$$;

-- 5) In-app receipt confirmation; no SMS/OTP provider required.
CREATE OR REPLACE FUNCTION public.confirm_advance_in_app(p_advance_id uuid)
RETURNS TABLE (advance_id uuid, status text, verified_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_advance public.advances%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Pehle apne Google account se login karein.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles p
    WHERE p.id = auth.uid() AND p.role = 'labour'
  ) THEN
    RAISE EXCEPTION 'Sirf linked Mazdoor apni kharchi confirm kar sakta hai.';
  END IF;

  SELECT a.* INTO v_advance
  FROM public.advances a
  JOIN public.workers w ON w.id = a.worker_id
  WHERE a.id = p_advance_id AND w.user_id = auth.uid()
  FOR UPDATE OF a;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ye kharchi aapke account se linked nahi hai.';
  END IF;

  IF v_advance.status = 'verified' THEN
    RETURN QUERY SELECT v_advance.id, v_advance.status, v_advance.verified_at;
    RETURN;
  END IF;

  IF v_advance.status <> 'pending' THEN
    RAISE EXCEPTION 'Ye kharchi ab confirm nahi ho sakti. Thekedar se hisaab milayein.';
  END IF;

  UPDATE public.advances
  SET status = 'verified', verified_at = now(), verified_by = auth.uid(), verification_method = 'in_app'
  WHERE id = v_advance.id
  RETURNING * INTO v_advance;

  RETURN QUERY SELECT v_advance.id, v_advance.status, v_advance.verified_at;
END;
$$;

-- 6) Worker can dispute a pending advance with a short reason.
CREATE OR REPLACE FUNCTION public.dispute_advance_in_app(p_advance_id uuid, p_reason text)
RETURNS TABLE (advance_id uuid, status text, disputed_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_advance public.advances%ROWTYPE;
  v_reason text := trim(coalesce(p_reason, ''));
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Pehle apne Google account se login karein.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles p
    WHERE p.id = auth.uid() AND p.role = 'labour'
  ) THEN
    RAISE EXCEPTION 'Sirf linked Mazdoor kharchi par dikkat darj kar sakta hai.';
  END IF;

  IF length(v_reason) < 4 OR length(v_reason) > 250 THEN
    RAISE EXCEPTION 'Dikkat ka reason 4 se 250 characters ka hona chahiye.';
  END IF;

  SELECT a.* INTO v_advance
  FROM public.advances a
  JOIN public.workers w ON w.id = a.worker_id
  WHERE a.id = p_advance_id AND w.user_id = auth.uid()
  FOR UPDATE OF a;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ye kharchi aapke account se linked nahi hai.';
  END IF;

  IF v_advance.status <> 'pending' THEN
    RAISE EXCEPTION 'Sirf pending kharchi par dikkat darj ho sakti hai.';
  END IF;

  UPDATE public.advances
  SET status = 'disputed', disputed_by = auth.uid(), disputed_at = now(),
      dispute_reason = v_reason, verification_method = 'worker_dispute'
  WHERE id = v_advance.id
  RETURNING * INTO v_advance;

  RETURN QUERY SELECT v_advance.id, v_advance.status, v_advance.disputed_at;
END;
$$;

REVOKE ALL ON FUNCTION public.review_advance_request(boolean, text, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.list_my_pending_advances() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.confirm_advance_in_app(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.dispute_advance_in_app(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_advance_request(boolean, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_my_pending_advances() TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_advance_in_app(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.dispute_advance_in_app(uuid, text) TO authenticated;
GRANT SELECT (disputed_at, dispute_reason) ON public.advances TO authenticated;

NOTIFY pgrst, 'reload schema';
