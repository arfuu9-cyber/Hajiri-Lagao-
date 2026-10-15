/*
# Add duty_multiplier column to attendance table

1. Modified Tables
- `attendance`: Adds `duty_multiplier` numeric column (default 1.0).
  - Stores the duty type multiplier: 0 (absent), 0.5 (half day), 1 (full), 1.5 (overtime), 2 (double).
  - This replaces the old half_day boolean + overtime_hours combo for day-value calculation.
  - Old columns (half_day, overtime_hours) are kept for backwards compatibility — no data loss.
  - Backfill: existing records with half_day=true get duty_multiplier=0.5, others get 1.0.

2. Security
- No policy changes. RLS already enabled on attendance.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'attendance' AND column_name = 'duty_multiplier'
  ) THEN
    ALTER TABLE attendance ADD COLUMN duty_multiplier numeric(3,1) NOT NULL DEFAULT 1.0;
  END IF;
END $$;

-- Backfill: set 0.5 for existing half-day records, 1.0 for everything else
UPDATE attendance SET duty_multiplier = 0.5 WHERE half_day = true AND duty_multiplier = 1.0;
UPDATE attendance SET duty_multiplier = 1.0 WHERE half_day = false AND duty_multiplier IS NULL;
