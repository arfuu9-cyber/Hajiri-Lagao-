/*
# Add worker-photos storage bucket for profile photos

1. Storage
- Create `worker-photos` storage bucket (public read) for worker profile photos captured during registration.

2. Security
- Storage bucket policies: public read, anon+authenticated insert (single-tenant app model matching existing worker-id-photos bucket).
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('worker-photos', 'worker-photos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public read access for worker-photos" ON storage.objects;
CREATE POLICY "Public read access for worker-photos"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'worker-photos');

DROP POLICY IF EXISTS "anon insert for worker-photos" ON storage.objects;
CREATE POLICY "anon insert for worker-photos"
  ON storage.objects FOR INSERT
  TO anon, authenticated
  WITH CHECK (bucket_id = 'worker-photos');

DROP POLICY IF EXISTS "anon update for worker-photos" ON storage.objects;
CREATE POLICY "anon update for worker-photos"
  ON storage.objects FOR UPDATE
  TO anon, authenticated
  USING (bucket_id = 'worker-photos')
  WITH CHECK (bucket_id = 'worker-photos');

DROP POLICY IF EXISTS "anon delete for worker-photos" ON storage.objects;
CREATE POLICY "anon delete for worker-photos"
  ON storage.objects FOR DELETE
  TO anon, authenticated
  USING (bucket_id = 'worker-photos');
