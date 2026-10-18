/*
# Add Aadhaar fields, Gate Pass table, and Storage bucket

1. Modified Tables
- `workers`: Add `aadhaar_number` (text, nullable) and `id_photo_url` (text, nullable) columns.
  These store the worker's Aadhaar number and the URL of the uploaded Aadhaar card photo.

2. New Tables
- `gate_passes`: Stores gate pass entries created when a gatekeeper scans a Thekedar's QR code.
  - `id` (uuid, primary key)
  - `thekedar_id` (uuid, FK to workers.id) — the Thekedar whose QR was scanned
  - `worker_ids` (jsonb) — array of worker IDs whose attendance was marked via this gate pass
  - `entry_time` (timestamptz) — when the gate pass was created
  - `created_at` (timestamptz, default now())

3. Storage
- Create `worker-id-photos` storage bucket (public read) for Aadhaar card photos.

4. Security
- Enable RLS on `gate_passes`.
- Policies: `TO anon, authenticated` for all CRUD (single-tenant app model matching existing tables).
- Storage bucket policies: public read, authenticated insert.
*/

-- Add aadhaar_number and id_photo_url to workers
ALTER TABLE workers
  ADD COLUMN IF NOT EXISTS aadhaar_number text,
  ADD COLUMN IF NOT EXISTS id_photo_url text;

-- Create gate_passes table
CREATE TABLE IF NOT EXISTS gate_passes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thekedar_id uuid REFERENCES workers(id) ON DELETE CASCADE,
  worker_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  entry_time timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE gate_passes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_gate_passes" ON gate_passes;
CREATE POLICY "anon_select_gate_passes" ON gate_passes FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_gate_passes" ON gate_passes;
CREATE POLICY "anon_insert_gate_passes" ON gate_passes FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_gate_passes" ON gate_passes;
CREATE POLICY "anon_update_gate_passes" ON gate_passes FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_gate_passes" ON gate_passes;
CREATE POLICY "anon_delete_gate_passes" ON gate_passes FOR DELETE
  TO anon, authenticated USING (true);

-- Create storage bucket for worker ID photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('worker-id-photos', 'worker-id-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: public read, authenticated insert
DROP POLICY IF EXISTS "Public read access for worker-id-photos" ON storage.objects;
CREATE POLICY "Public read access for worker-id-photos"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'worker-id-photos');

DROP POLICY IF EXISTS "Authenticated insert for worker-id-photos" ON storage.objects;
CREATE POLICY "Authenticated insert for worker-id-photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'worker-id-photos');
