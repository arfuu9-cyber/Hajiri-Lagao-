/*
  Bhugtaan (salary paid) record - replaces the "chukta kiya" tick in the copy.
*/
CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id uuid NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  paid_on date NOT NULL DEFAULT current_date,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth full access payments" ON payments
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
NOTIFY pgrst, 'reload schema';
