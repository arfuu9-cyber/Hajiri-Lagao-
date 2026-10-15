/*
# Add optional age and profile_photo_url columns to workers table

1. Modified Tables
- `workers`: Adds two optional columns:
  - `age` (integer, nullable) — stores the worker's age if provided. Useful for sites/companies that have a minimum age requirement (e.g. 18+). NULL means age was not captured.
  - `profile_photo_url` (text, nullable) — stores a URL to the worker's profile photo (captured via camera or uploaded). NULL means no photo was captured.

2. Security
- No policy changes. RLS already enabled on workers.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workers' AND column_name = 'age'
  ) THEN
    ALTER TABLE workers ADD COLUMN age integer;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workers' AND column_name = 'profile_photo_url'
  ) THEN
    ALTER TABLE workers ADD COLUMN profile_photo_url text;
  END IF;
END $$;
