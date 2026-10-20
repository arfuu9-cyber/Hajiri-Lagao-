-- EMERGENCY ROLLBACK: puts back "any logged-in user can do everything" (insecure, but app works).
GRANT SELECT ON public.advances TO authenticated;
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['workers','attendance','advances','payments','gate_passes','advance_verifications'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS rollback_open ON public.%I', t);
    EXECUTE format('CREATE POLICY rollback_open ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)', t);
  END LOOP;
END $$;
DROP TRIGGER IF EXISTS protect_worker_columns ON workers;
NOTIFY pgrst, 'reload schema';
