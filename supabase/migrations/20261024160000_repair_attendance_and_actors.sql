/*
  Hajiri Lagao: repair legacy text user IDs in attendance actor columns.

  Safe to re-run. Text values are copied to *_legacy columns before conversion.
  Only canonical UUIDs that exist in auth.users are retained as active actor IDs;
  non-UUID or orphaned values are preserved in the legacy text column and set NULL.
*/

DO $repair_actor_types$
DECLARE
  v_column text;
  v_type text;
  v_legacy text;
  v_uuid_pattern constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
BEGIN
  FOR v_column IN
    SELECT c.column_name
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = 'attendance'
      AND c.column_name IN ('marked_by', 'approved_by')
  LOOP
    SELECT c.data_type INTO v_type
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = 'attendance'
      AND c.column_name = v_column;

    IF v_type IN ('text', 'character varying', 'character') THEN
      v_legacy := v_column || '_legacy';
      EXECUTE format('ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS %I text', v_legacy);
      EXECUTE format(
        'UPDATE public.attendance SET %1$I = %2$I::text WHERE %2$I IS NOT NULL AND %1$I IS NULL',
        v_legacy, v_column
      );
      EXECUTE format(
        'UPDATE public.attendance AS a SET %1$I = NULL
         WHERE %1$I IS NOT NULL
           AND (btrim(%1$I::text) !~* %2$L
             OR NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id::text = btrim(a.%1$I::text)))',
        v_column, v_uuid_pattern
      );
      EXECUTE format(
        'ALTER TABLE public.attendance ALTER COLUMN %1$I TYPE uuid USING NULLIF(btrim(%1$I::text), '''')::uuid',
        v_column
      );
    ELSIF v_type IS NOT NULL AND v_type <> 'uuid' THEN
      RAISE EXCEPTION 'Cannot safely repair public.attendance.%: expected text or uuid, found %', v_column, v_type;
    END IF;
  END LOOP;
END;
$repair_actor_types$;

-- Add actor columns if this project is missing them entirely. Existing text columns
-- have already been converted above, so IF NOT EXISTS cannot leave them as text.
ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS marked_by uuid,
  ADD COLUMN IF NOT EXISTS approved_by uuid;

DO $ensure_actor_foreign_keys$
DECLARE
  v_column text;
  v_legacy text;
  v_attnum smallint;
  v_constraint_name text;
BEGIN
  FOREACH v_column IN ARRAY ARRAY['marked_by', 'approved_by'] LOOP
    SELECT a.attnum INTO v_attnum
    FROM pg_attribute a
    WHERE a.attrelid = 'public.attendance'::regclass
      AND a.attname = v_column
      AND NOT a.attisdropped;

    IF v_attnum IS NOT NULL AND NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      WHERE c.conrelid = 'public.attendance'::regclass
        AND c.contype = 'f'
        AND c.confrelid = 'auth.users'::regclass
        AND v_attnum = ANY (c.conkey)
    ) THEN
      -- Preserve any UUID that is no longer present in auth.users before clearing it.
      IF EXISTS (
        SELECT 1
        FROM public.attendance a
        WHERE (to_jsonb(a) ->> v_column) IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM auth.users u
            WHERE u.id::text = (to_jsonb(a) ->> v_column)
          )
      ) THEN
        v_legacy := v_column || '_legacy';
        EXECUTE format('ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS %I text', v_legacy);
        EXECUTE format(
          'UPDATE public.attendance SET %1$I = %2$I::text WHERE %2$I IS NOT NULL AND %1$I IS NULL',
          v_legacy, v_column
        );
        EXECUTE format(
          'UPDATE public.attendance AS a SET %1$I = NULL
           WHERE %1$I IS NOT NULL
             AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = a.%1$I)',
          v_column
        );
      END IF;

      v_constraint_name := 'attendance_' || v_column || '_auth_users_fkey';
      EXECUTE format(
        'ALTER TABLE public.attendance ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES auth.users(id) ON DELETE SET NULL',
        v_constraint_name, v_column
      );
    END IF;
  END LOOP;
END;
$ensure_actor_foreign_keys$;

NOTIFY pgrst, 'reload schema';
