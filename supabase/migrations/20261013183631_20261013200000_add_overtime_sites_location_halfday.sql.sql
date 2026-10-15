/*
# Add overtime, checkout, sites, GPS location, and half-day support

## Overview
Extends the attendance system to support overtime hours, check-in/check-out times,
half-day attendance, construction site management, and GPS location capture.
Also adds a photo_url field for selfie/photo verification.

## New Tables

### sites
- `id` (uuid, primary key)
- `name` (text, required) — site name e.g. "Tower A - Andheri"
- `address` (text, nullable) — site address
- `created_at` (timestamptz)

## Modified Tables

### attendance (modified)
- `overtime_hours` (numeric, default 0) — extra hours worked beyond standard shift
- `time_out` (timestamptz, nullable) — when worker checked out; null if not yet checked out
- `half_day` (boolean, default false) — marks a half-day attendance (counts as 0.5 for payroll)
- `site_id` (uuid, nullable, FK → sites.id) — which construction site the worker attended
- `latitude` (double precision, nullable) — GPS latitude at check-in
- `longitude` (double precision, nullable) — GPS longitude at check-in
- `photo_url` (text, nullable) — selfie/photo verification URL

### workers (modified)
- `site_id` (uuid, nullable, FK → sites.id) — default site assignment for the worker
- `active` (boolean, default true) — soft-delete / deactivation flag without losing data

## Security
- RLS enabled on `sites`; authenticated supervisors have full CRUD
- Existing attendance and worker policies already allow authenticated access
- No data is lost — all new columns are nullable or have safe defaults

## Compatibility Notes
1. Existing attendance records get overtime_hours=0, half_day=false, time_out=null
2. Existing workers get active=true, site_id=null
3. No existing columns removed or renamed
*/

CREATE TABLE IF NOT EXISTS sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE sites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_sites" ON sites;
CREATE POLICY "select_sites"
  ON sites FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "insert_sites" ON sites;
CREATE POLICY "insert_sites"
  ON sites FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "update_sites" ON sites;
CREATE POLICY "update_sites"
  ON sites FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "delete_sites" ON sites;
CREATE POLICY "delete_sites"
  ON sites FOR DELETE
  TO authenticated
  USING (true);

ALTER TABLE attendance
  ADD COLUMN IF NOT EXISTS overtime_hours numeric(5, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS time_out timestamptz,
  ADD COLUMN IF NOT EXISTS half_day boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS site_id uuid REFERENCES sites(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision,
  ADD COLUMN IF NOT EXISTS photo_url text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'attendance_overtime_nonnegative'
  ) THEN
    ALTER TABLE attendance
      ADD CONSTRAINT attendance_overtime_nonnegative CHECK (overtime_hours >= 0);
  END IF;
END $$;

ALTER TABLE workers
  ADD COLUMN IF NOT EXISTS site_id uuid REFERENCES sites(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_attendance_site_id ON attendance (site_id);
CREATE INDEX IF NOT EXISTS idx_attendance_half_day ON attendance (half_day);
CREATE INDEX IF NOT EXISTS idx_workers_active ON workers (active);
CREATE INDEX IF NOT EXISTS idx_workers_site_id ON workers (site_id);
