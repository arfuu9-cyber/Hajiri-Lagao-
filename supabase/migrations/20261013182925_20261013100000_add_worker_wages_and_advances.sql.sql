/*
# Add daily wages and advance payments

1. Purpose
- Adds daily wage tracking to workers.
- Creates a durable advances ledger for payments given to workers.
- Supports weekly payroll calculations without changing existing attendance records.

2. Modified Tables
- `workers.daily_wage` (numeric) — the worker's daily payout amount, defaulting to 0 for existing workers until updated.

3. New Tables
- `advances.id` (uuid) — unique advance record identifier.
- `advances.worker_id` (uuid) — worker receiving the payment; references `workers.id` and cascades if a worker is removed.
- `advances.amount` (numeric) — positive advance amount with two decimal places of precision.
- `advances.date` (date) — date the advance was given, defaulting to the current date.
- `advances.note` (text) — optional supervisor note.
- `advances.created_at` (timestamptz) — record creation timestamp.

4. Security
- Row Level Security is enabled on `advances`.
- Authenticated supervisors can separately select, insert, update, and delete advance records.
- Existing authenticated access rules on `workers` remain in place so wage values can be managed by the signed-in supervisor.

5. Compatibility Notes
- Existing workers are preserved and receive a safe `daily_wage` value of 0 until a supervisor edits or recreates their rate.
- No existing columns or attendance records are removed or renamed.
*/

ALTER TABLE workers
  ADD COLUMN IF NOT EXISTS daily_wage numeric(12, 2) NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'workers_daily_wage_nonnegative'
  ) THEN
    ALTER TABLE workers
      ADD CONSTRAINT workers_daily_wage_nonnegative CHECK (daily_wage >= 0);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS advances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id uuid NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  amount numeric(12, 2) NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT advances_amount_positive CHECK (amount > 0)
);

CREATE INDEX IF NOT EXISTS idx_advances_worker_date ON advances (worker_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_advances_date ON advances (date DESC);

ALTER TABLE advances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_advances" ON advances;
CREATE POLICY "select_advances"
  ON advances FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "insert_advances" ON advances;
CREATE POLICY "insert_advances"
  ON advances FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "update_advances" ON advances;
CREATE POLICY "update_advances"
  ON advances FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "delete_advances" ON advances;
CREATE POLICY "delete_advances"
  ON advances FOR DELETE
  TO authenticated
  USING (true);
