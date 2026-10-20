/*
  Link thekedar <-> mazdoor <-> login accounts.
  - workers.user_id     : the login (Google account) of this person
  - workers.thekedar_id : the thekedar (a workers row) this mazdoor works under
*/
ALTER TABLE workers
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS thekedar_id uuid REFERENCES workers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS workers_thekedar_idx ON workers(thekedar_id);
CREATE INDEX IF NOT EXISTS workers_user_idx ON workers(user_id);

NOTIFY pgrst, 'reload schema';
