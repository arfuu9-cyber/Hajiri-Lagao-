-- Hajiri Lagao: Replace SMS OTP for advance verification with authenticated in-app confirmation.
-- Apply this migration to the same Supabase project used by Vercel.

ALTER TABLE public.advances
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS given_by uuid,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS verified_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS verification_method text,
  ADD COLUMN IF NOT EXISTS disputed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS disputed_at timestamptz,
  ADD COLUMN IF NOT EXISTS dispute_reason text;

-- Allow disputed records to remain in the audit trail but never count as payroll deductions.
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

ALTER TABLE public.advances
  DROP CONSTRAINT IF EXISTS advances_status_check;

ALTER TABLE public.advances
  ADD CONSTRAINT advances_status_check
  CHECK (status IN ('pending', 'verified', 'disputed'));

ALTER TABLE public.advances
  DROP CONSTRAINT IF EXISTS advances_verification_method_check;

ALTER TABLE public.advances
  ADD CONSTRAINT advances_verification_method_check
  CHECK (verification_method IS NULL OR verification_method IN ('in_app', 'worker_dispute'));

CREATE INDEX IF NOT EXISTS advances_pending_worker_idx
  ON public.advances (worker_id, created_at DESC)
  WHERE status = 'pending';

CREATE OR REPLACE FUNCTION public.list_my_pending_advances()
RETURNS TABLE (
  id uuid,
  worker_id uuid,
  amount numeric,
  date date,
  note text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.id, a.worker_id, a.amount, a.date, a.note, a.created_at
  FROM public.advances a
  JOIN public.workers w ON w.id = a.worker_id
  WHERE auth.uid() IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.user_profiles p WHERE p.id = auth.uid() AND p.role = 'labour')
    AND w.user_id = auth.uid()
    AND a.status = 'pending'
  ORDER BY a.created_at DESC
  LIMIT 20;
$$;

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
  IF NOT EXISTS (SELECT 1 FROM public.user_profiles p WHERE p.id = auth.uid() AND p.role = 'labour') THEN
    RAISE EXCEPTION 'Sirf linked Mazdoor apni kharchi confirm kar sakta hai.';
  END IF;

  SELECT a.* INTO v_advance
  FROM public.advances a
  JOIN public.workers w ON w.id = a.worker_id
  WHERE a.id = p_advance_id
    AND w.user_id = auth.uid()
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
  SET status = 'verified',
      verified_at = now(),
      verified_by = auth.uid(),
      verification_method = 'in_app'
  WHERE id = v_advance.id
  RETURNING * INTO v_advance;

  RETURN QUERY SELECT v_advance.id, v_advance.status, v_advance.verified_at;
END;
$$;

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
  IF NOT EXISTS (SELECT 1 FROM public.user_profiles p WHERE p.id = auth.uid() AND p.role = 'labour') THEN
    RAISE EXCEPTION 'Sirf linked Mazdoor kharchi par dikkat darj kar sakta hai.';
  END IF;
  IF length(v_reason) < 4 OR length(v_reason) > 250 THEN
    RAISE EXCEPTION 'Dikkat ka reason 4 se 250 characters ka hona chahiye.';
  END IF;

  SELECT a.* INTO v_advance
  FROM public.advances a
  JOIN public.workers w ON w.id = a.worker_id
  WHERE a.id = p_advance_id
    AND w.user_id = auth.uid()
  FOR UPDATE OF a;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ye kharchi aapke account se linked nahi hai.';
  END IF;
  IF v_advance.status <> 'pending' THEN
    RAISE EXCEPTION 'Sirf pending kharchi par dikkat darj ho sakti hai.';
  END IF;

  UPDATE public.advances
  SET status = 'disputed',
      disputed_by = auth.uid(),
      disputed_at = now(),
      dispute_reason = v_reason,
      verification_method = 'worker_dispute'
  WHERE id = v_advance.id
  RETURNING * INTO v_advance;

  RETURN QUERY SELECT v_advance.id, v_advance.status, v_advance.disputed_at;
END;
$$;

REVOKE ALL ON FUNCTION public.list_my_pending_advances() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.confirm_advance_in_app(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.dispute_advance_in_app(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_my_pending_advances() TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_advance_in_app(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.dispute_advance_in_app(uuid, text) TO authenticated;
GRANT SELECT (disputed_at, dispute_reason) ON public.advances TO authenticated;

NOTIFY pgrst, 'reload schema';


-- Remove old NFC-card field and keep the worker-protection trigger valid.
CREATE OR REPLACE FUNCTION public.protect_worker_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND OLD.user_id = auth.uid() THEN
    NEW.daily_wage := OLD.daily_wage;
    NEW.thekedar_id := OLD.thekedar_id;
    NEW.role := OLD.role;
    NEW.active := OLD.active;
    NEW.user_id := OLD.user_id;
    NEW.invite_code := OLD.invite_code;
  END IF;
  RETURN NEW;
END;
$$;

DROP INDEX IF EXISTS public.idx_workers_nfc_tag_uid;
ALTER TABLE public.workers DROP COLUMN IF EXISTS nfc_tag_uid;

-- Remove legacy OTP secret/expiry fields; old verification audit rows are retained.
ALTER TABLE public.advances DROP COLUMN IF EXISTS otp_code;
ALTER TABLE public.advances DROP COLUMN IF EXISTS otp_expires_at;
DROP TABLE IF EXISTS public.auth_otp_codes;

NOTIFY pgrst, 'reload schema';
