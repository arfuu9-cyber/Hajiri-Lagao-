/*
  Hajiri Lagao: atomically register a mazdoor and create a verified connection request.

  Apply after:
    - user_profiles and workers base migrations
    - 20261021100000_secure_data_access.sql
    - 20261022100000_invite_code.sql
    - 20261023110000_verified_connections_and_safe_request_review.sql

  A code resolves to one specific workers row and that row's thekedar_id. It creates
  a pending request only; the owning Thekedar must approve before workers.user_id is linked.
  Because profile + request are in one PostgreSQL transaction, invalid codes do not
  leave behind a half-registered user profile.
*/

CREATE OR REPLACE FUNCTION public.register_labour_with_invite_code(
  p_display_name text,
  p_phone text,
  p_code text
)
RETURNS TABLE(
  request_id uuid,
  worker_name text,
  thekedar_name text,
  status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_code text := upper(trim(coalesce(p_code, '')));
  v_display_name text := trim(coalesce(p_display_name, ''));
  v_phone text := trim(coalesce(p_phone, ''));
  v_profile_role text;
  v_profile_exists boolean := false;
  v_worker record;
  v_existing_request record;
  v_request_id uuid;
  v_status text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Registration se pehle sign in karein.';
  END IF;

  IF length(v_display_name) < 2 OR length(v_display_name) > 100 THEN
    RAISE EXCEPTION 'Pura naam kam se kam 2 aur zyada se zyada 100 characters ka hona chahiye.';
  END IF;

  IF v_phone = '' THEN
    RAISE EXCEPTION 'Phone number zaroori hai.';
  END IF;

  IF v_code !~ '^[A-Z0-9]{6}$' THEN
    RAISE EXCEPTION 'Thekedar ka valid 6-character invite code daalo.';
  END IF;

  /* Lock the exact invited worker row while checking and creating its request. */
  SELECT
    w.id AS worker_id,
    w.name AS worker_name,
    w.user_id AS worker_user_id,
    w.thekedar_id AS thekedar_id,
    t.name AS thekedar_name
  INTO v_worker
  FROM public.workers w
  JOIN public.workers t ON t.id = w.thekedar_id
  JOIN public.user_profiles tp ON tp.id = t.user_id AND tp.role = 'thekedar'
  WHERE upper(trim(w.invite_code)) = v_code
    AND coalesce(w.active, true) = true
  LIMIT 1
  FOR UPDATE OF w;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invite code galat hai ya kisi active Thekedar ke worker profile se linked nahi hai.';
  END IF;

  IF v_worker.worker_user_id IS NOT NULL AND v_worker.worker_user_id <> v_user_id THEN
    RAISE EXCEPTION 'Is worker profile se doosra account pehle hi linked hai. Thekedar se madad lein.';
  END IF;

  /* Do not let the same login claim two separate connected worker records. */
  IF v_worker.worker_user_id IS DISTINCT FROM v_user_id AND EXISTS (
    SELECT 1
    FROM public.workers own_worker
    WHERE own_worker.user_id = v_user_id
      AND own_worker.thekedar_id IS NOT NULL
      AND own_worker.id <> v_worker.worker_id
  ) THEN
    RAISE EXCEPTION 'Aapka account pehle se ek worker profile se linked hai. Duplicate hisaab se bachne ke liye usi profile ka use karein.';
  END IF;

  /* Recover safely if an earlier app version saved this profile before requesting a link. */
  SELECT p.role INTO v_profile_role
  FROM public.user_profiles p
  WHERE p.id = v_user_id
  FOR UPDATE;
  v_profile_exists := FOUND;

  IF v_profile_exists THEN
    IF v_profile_role IS DISTINCT FROM 'labour' THEN
      RAISE EXCEPTION 'Yeh login pehle se kisi doosre role ke saath registered hai.';
    END IF;

    UPDATE public.user_profiles
    SET display_name = v_display_name,
        phone = v_phone,
        updated_at = now()
    WHERE id = v_user_id;
  ELSE
    INSERT INTO public.user_profiles (id, phone, display_name, role)
    VALUES (v_user_id, v_phone, v_display_name, 'labour');
  END IF;

  IF v_worker.worker_user_id = v_user_id THEN
    RETURN QUERY SELECT NULL::uuid, v_worker.worker_name::text, v_worker.thekedar_name::text, 'approved'::text;
    RETURN;
  END IF;

  SELECT r.id, r.status, r.requested_by
  INTO v_existing_request
  FROM public.team_connection_requests r
  WHERE r.worker_id = v_worker.worker_id
    AND r.status = 'pending'
  LIMIT 1;

  IF FOUND THEN
    IF v_existing_request.requested_by = v_user_id THEN
      RETURN QUERY SELECT v_existing_request.id, v_worker.worker_name::text, v_worker.thekedar_name::text, 'pending'::text;
      RETURN;
    END IF;
    RAISE EXCEPTION 'Is worker ke liye connection request pehle se pending hai. Thekedar se sampark karein.';
  END IF;

  INSERT INTO public.team_connection_requests (worker_id, thekedar_id, requested_by, status)
  VALUES (v_worker.worker_id, v_worker.thekedar_id, v_user_id, 'pending')
  RETURNING id INTO v_request_id;

  RETURN QUERY SELECT v_request_id, v_worker.worker_name::text, v_worker.thekedar_name::text, 'pending'::text;
END;
$$;

REVOKE ALL ON FUNCTION public.register_labour_with_invite_code(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_labour_with_invite_code(text, text, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
