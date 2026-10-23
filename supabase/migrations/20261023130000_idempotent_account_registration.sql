/*
  Hajiri Lagao: idempotent, atomic Thekedar/Gatekeeper registration.
  Apply after user_profiles, workers, and worker-link migrations.

  This function writes profile + account worker row in one DB transaction.
  Repeating the call for the same role repairs a missing worker row and does not
  create duplicates. It never silently changes an existing account's role.
*/
CREATE OR REPLACE FUNCTION public.register_account_with_role(
  p_display_name text,
  p_phone text,
  p_role text
)
RETURNS TABLE(
  profile_id uuid,
  worker_id uuid,
  role text,
  display_name text,
  phone text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_name text := trim(coalesce(p_display_name, ''));
  v_phone text := trim(coalesce(p_phone, ''));
  v_role text := lower(trim(coalesce(p_role, '')));
  v_existing_role text;
  v_worker_id uuid;
  v_worker_role text;
  v_row_role text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Registration se pehle sign in karein.';
  END IF;

  IF v_role NOT IN ('thekedar', 'gatekeeper') THEN
    RAISE EXCEPTION 'Registration role valid nahi hai.';
  END IF;
  IF length(v_name) < 2 OR length(v_name) > 100 THEN
    RAISE EXCEPTION 'Naam 2 se 100 characters ke beech hona chahiye.';
  END IF;
  IF length(regexp_replace(v_phone, '[^0-9]', '', 'g')) < 7
     OR length(regexp_replace(v_phone, '[^0-9]', '', 'g')) > 15 THEN
    RAISE EXCEPTION 'Valid phone number daalein (7 se 15 digits).';
  END IF;

  /* Serialize retries/two-tab submits for this authenticated user. */
  PERFORM pg_advisory_xact_lock(hashtext(v_user_id::text)::bigint);

  SELECT p.role INTO v_existing_role
  FROM public.user_profiles p
  WHERE p.id = v_user_id
  FOR UPDATE;

  IF FOUND THEN
    IF v_existing_role IS DISTINCT FROM v_role THEN
      RAISE EXCEPTION 'Yeh login pehle se doosre role ke saath registered hai. Role change karne ke liye support se sampark karein.';
    END IF;
    UPDATE public.user_profiles
       SET display_name = v_name,
           phone = v_phone,
           updated_at = now()
     WHERE id = v_user_id;
  ELSE
    INSERT INTO public.user_profiles (id, phone, display_name, role)
    VALUES (v_user_id, v_phone, v_name, v_role);
  END IF;

  v_worker_role := CASE WHEN v_role = 'thekedar' THEN 'Thekedar' ELSE 'Gatekeeper' END;

  /* Do not create a second account row if an earlier request partially completed. */
  SELECT w.id, w.role INTO v_worker_id, v_row_role
  FROM public.workers w
  WHERE w.user_id = v_user_id
  ORDER BY w.created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF v_worker_id IS NOT NULL THEN
    IF lower(trim(coalesce(v_row_role, ''))) <> lower(v_worker_role) THEN
      RAISE EXCEPTION 'Is login se ek alag worker role pehle se linked hai. Duplicate account banane ke bajay pehle account verify karein.';
    END IF;

    UPDATE public.workers
       SET name = v_name,
           phone = v_phone
     WHERE id = v_worker_id;
  ELSE
    INSERT INTO public.workers (name, phone, role, daily_wage, user_id, thekedar_id)
    VALUES (v_name, v_phone, v_worker_role, 0, v_user_id, NULL)
    RETURNING id INTO v_worker_id;
  END IF;

  RETURN QUERY
  SELECT v_user_id, v_worker_id, v_role, v_name, v_phone;
END;
$$;

REVOKE ALL ON FUNCTION public.register_account_with_role(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_account_with_role(text, text, text) TO authenticated;
NOTIFY pgrst, 'reload schema';
