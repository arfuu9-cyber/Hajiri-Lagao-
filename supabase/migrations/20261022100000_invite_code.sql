/*
  Invite code: a mazdoor links to his thekedar with a 6-letter code (not a phone number).
  Run AFTER 20261021100000_secure_data_access.sql
*/
ALTER TABLE workers
  ADD COLUMN IF NOT EXISTS invite_code text UNIQUE
  DEFAULT upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));

UPDATE workers SET invite_code = upper(substr(md5(random()::text || id::text), 1, 6))
WHERE invite_code IS NULL;

CREATE OR REPLACE FUNCTION public.claim_worker_by_code(p_code text)
RETURNS SETOF workers LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE w workers;
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  UPDATE workers SET user_id = auth.uid()
  WHERE invite_code = upper(trim(p_code)) AND role = 'Labour' AND user_id IS NULL
  RETURNING * INTO w;
  IF w.id IS NOT NULL THEN RETURN NEXT w; END IF;
END $$;
REVOKE ALL ON FUNCTION public.claim_worker_by_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_worker_by_code(text) TO authenticated;

-- phone-number claiming is no longer allowed
DROP FUNCTION IF EXISTS public.claim_worker_by_phone(text);

-- a mazdoor cannot change his own code either
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
    NEW.invite_code := OLD.invite_code;
  END IF;
  RETURN NEW;
END $$;

NOTIFY pgrst, 'reload schema';
