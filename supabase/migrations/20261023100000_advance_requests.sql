CREATE TABLE IF NOT EXISTS advance_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id uuid NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  note text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE advance_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY adv_req_select ON advance_requests FOR SELECT TO authenticated USING (can_access_worker(worker_id));
CREATE POLICY adv_req_insert ON advance_requests FOR INSERT TO authenticated
  WITH CHECK (worker_id IN (SELECT my_worker_ids()) AND status = 'pending');
CREATE POLICY adv_req_update ON advance_requests FOR UPDATE TO authenticated
  USING (is_my_team_member(worker_id)) WITH CHECK (is_my_team_member(worker_id));
NOTIFY pgrst, 'reload schema';
