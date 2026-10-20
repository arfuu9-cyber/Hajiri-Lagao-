/*
  Data security: every thekedar sees only his own team, every mazdoor only himself.

  - workers.user_id     = login of this person
  - workers.thekedar_id = the thekedar (a workers row) this mazdoor works under
*/

-- ---------- helper functions (security definer: no RLS recursion) ----------
CREATE OR REPLACE FUNCTION public.my_worker_ids()
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM workers WHERE user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.can_access_worker(wid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM workers w
    WHERE w.id = wid
      AND (w.user_id = auth.uid()
           OR w.thekedar_id IN (SELECT id FROM workers WHERE user_id = auth.uid()))
  );
$$;

CREATE OR REPLACE FUNCTION public.is_my_team_member(wid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM workers w
    WHERE w.id = wid
      AND w.thekedar_id IN (SELECT id FROM workers WHERE user_id = auth.uid())
  );
$$;

REVOKE ALL ON FUNCTION public.my_worker_ids(), public.can_access_worker(uuid), public.is_my_team_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_worker_ids(), public.can_access_worker(uuid), public.is_my_team_member(uuid) TO authenticated;

-- ---------- remove every old (open) policy on these tables ----------
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('workers','attendance','advances','advance_verifications','payments','gate_passes')
  LOOP
    EXECUTE format('DROP POLICY %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

ALTER TABLE workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE advances ENABLE ROW LEVEL SECURITY;
ALTER TABLE advance_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE gate_passes ENABLE ROW LEVEL SECURITY;

-- ---------- workers ----------
CREATE POLICY workers_select ON workers FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR thekedar_id IN (SELECT my_worker_ids()));
CREATE POLICY workers_insert ON workers FOR INSERT TO authenticated
  WITH CHECK ((user_id = auth.uid() AND thekedar_id IS NULL) OR thekedar_id IN (SELECT my_worker_ids()));
CREATE POLICY workers_update ON workers FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR thekedar_id IN (SELECT my_worker_ids()))
  WITH CHECK (user_id = auth.uid() OR thekedar_id IN (SELECT my_worker_ids()));
CREATE POLICY workers_delete ON workers FOR DELETE TO authenticated
  USING (thekedar_id IN (SELECT my_worker_ids()));

-- a mazdoor can never change his own wage, role, team, card or login link
CREATE OR REPLACE FUNCTION public.protect_worker_columns()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND OLD.user_id = auth.uid() THEN
    NEW.daily_wage := OLD.daily_wage;
    NEW.thekedar_id := OLD.thekedar_id;
    NEW.role := OLD.role;
    NEW.active := OLD.active;
    NEW.nfc_tag_uid := OLD.nfc_tag_uid;
    NEW.user_id := OLD.user_id;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS protect_worker_columns ON workers;
CREATE TRIGGER protect_worker_columns BEFORE UPDATE ON workers
  FOR EACH ROW EXECUTE FUNCTION public.protect_worker_columns();

-- mazdoor registering takes over the record his thekedar created for his phone
CREATE OR REPLACE FUNCTION public.claim_worker_by_phone(p_phone text)
RETURNS SETOF workers LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE w workers;
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  UPDATE workers SET user_id = auth.uid()
  WHERE id = (SELECT id FROM workers
              WHERE phone = p_phone AND role = 'Labour' AND user_id IS NULL
              ORDER BY created_at DESC LIMIT 1)
  RETURNING * INTO w;
  IF w.id IS NOT NULL THEN RETURN NEXT w; END IF;
END $$;
REVOKE ALL ON FUNCTION public.claim_worker_by_phone(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_worker_by_phone(text) TO authenticated;

-- ---------- attendance: thekedar for his team, mazdoor only for himself (today) ----------
CREATE POLICY attendance_select ON attendance FOR SELECT TO authenticated USING (can_access_worker(worker_id));
CREATE POLICY attendance_insert ON attendance FOR INSERT TO authenticated
  WITH CHECK (is_my_team_member(worker_id)
              OR (worker_id IN (SELECT my_worker_ids()) AND date::date = (now() AT TIME ZONE 'Asia/Kolkata')::date));
CREATE POLICY attendance_update ON attendance FOR UPDATE TO authenticated
  USING (is_my_team_member(worker_id)) WITH CHECK (is_my_team_member(worker_id));
CREATE POLICY attendance_delete ON attendance FOR DELETE TO authenticated USING (is_my_team_member(worker_id));

-- ---------- advances: only the thekedar can create (always 'pending'); OTP step runs server-side ----------
CREATE POLICY advances_select ON advances FOR SELECT TO authenticated USING (can_access_worker(worker_id));
CREATE POLICY advances_insert ON advances FOR INSERT TO authenticated
  WITH CHECK (is_my_team_member(worker_id) AND status = 'pending');

-- nobody can read the secret OTP code through the API
REVOKE SELECT ON public.advances FROM authenticated, anon;
GRANT SELECT (id, worker_id, amount, status, date, note, given_by, verified_at, created_at, otp_expires_at)
  ON public.advances TO authenticated;

-- ---------- advance_verifications: server only (service role) ----------
-- (no policy = no client access)

-- ---------- payments ----------
CREATE POLICY payments_select ON payments FOR SELECT TO authenticated USING (can_access_worker(worker_id));
CREATE POLICY payments_insert ON payments FOR INSERT TO authenticated WITH CHECK (is_my_team_member(worker_id));
CREATE POLICY payments_delete ON payments FOR DELETE TO authenticated USING (is_my_team_member(worker_id));

-- ---------- gate passes (gatekeeper comes later) ----------
CREATE POLICY gate_passes_owner ON gate_passes FOR ALL TO authenticated
  USING (thekedar_id IN (SELECT my_worker_ids())) WITH CHECK (thekedar_id IN (SELECT my_worker_ids()));

-- ---------- storage: Aadhaar photos become private, profile photos stay public ----------
UPDATE storage.buckets SET public = false WHERE id = 'worker-id-photos';
DROP POLICY IF EXISTS "Auth select worker photos" ON storage.objects;
DROP POLICY IF EXISTS "Auth insert worker photos" ON storage.objects;
DROP POLICY IF EXISTS "Auth update worker photos" ON storage.objects;
DROP POLICY IF EXISTS "Auth delete worker photos" ON storage.objects;
CREATE POLICY "worker photos upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id IN ('worker-photos','worker-id-photos'));
CREATE POLICY "profile photos update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'worker-photos');
CREATE POLICY "profile photos delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'worker-photos');

NOTIFY pgrst, 'reload schema';
