/*
# Create workers and attendance tables for Construction Worker Attendance App

## Overview
This migration creates the two application tables needed for the Construction Worker
Attendance & Management MVP: `workers` and `attendance`. It includes constraints,
indexes, RLS policies, and a unique constraint to prevent duplicate daily attendance.

## New Tables

### workers
- `id` (uuid, primary key, auto-generated)
- `name` (text, required) — worker's full name
- `phone` (text, required) — contact phone number
- `role` (text, required) — job role (e.g. Painter, Helper, Mason, Electrician, Carpenter)
- `nfc_tag_uid` (text, nullable, unique) — assigned NFC card identifier
- `created_at` (timestamptz, defaults to now()) — creation timestamp

### attendance
- `id` (uuid, primary key, auto-generated)
- `worker_id` (uuid, required, FK → workers.id ON DELETE CASCADE)
- `date` (date, required) — attendance date in Asia/Kolkata business timezone
- `time_in` (timestamptz, defaults to now()) — when attendance was recorded
- `status` (text, required, defaults to 'present') — constrained to 'present' or 'late'

## Constraints
- `attendance_status_check` — status must be 'present' or 'late'
- `attendance_unique_worker_date` — one attendance record per worker per date (unique on worker_id + date)
- `workers_nfc_tag_uid_key` — nfc_tag_uid must be unique when present

## Indexes
- `idx_workers_nfc_tag_uid` — fast lookup by NFC tag UID
- `idx_workers_created_at` — sorting workers by newest first
- `idx_attendance_worker_id` — attendance lookups by worker
- `idx_attendance_date` — attendance history grouped/sorted by date

## Security
- RLS enabled on both tables
- All CRUD policies scoped to `authenticated` (supervisor login required)
- Workers: authenticated supervisors can read, insert, update
- Attendance: authenticated supervisors can read, insert
- No DELETE policies in this MVP (data preservation)
*/

-- ============================================================
-- workers table
-- ============================================================

CREATE TABLE IF NOT EXISTS workers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text NOT NULL,
  role text NOT NULL,
  nfc_tag_uid text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workers_nfc_tag_uid ON workers (nfc_tag_uid);
CREATE INDEX IF NOT EXISTS idx_workers_created_at ON workers (created_at DESC);

ALTER TABLE workers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_workers" ON workers;
CREATE POLICY "select_workers"
  ON workers FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "insert_workers" ON workers;
CREATE POLICY "insert_workers"
  ON workers FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "update_workers" ON workers;
CREATE POLICY "update_workers"
  ON workers FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- attendance table
-- ============================================================

CREATE TABLE IF NOT EXISTS attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id uuid NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  date date NOT NULL,
  time_in timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'present',
  CONSTRAINT attendance_status_check CHECK (status IN ('present', 'late')),
  CONSTRAINT attendance_unique_worker_date UNIQUE (worker_id, date)
);

CREATE INDEX IF NOT EXISTS idx_attendance_worker_id ON attendance (worker_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance (date DESC);

ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_attendance" ON attendance;
CREATE POLICY "select_attendance"
  ON attendance FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "insert_attendance" ON attendance;
CREATE POLICY "insert_attendance"
  ON attendance FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "update_attendance" ON attendance;
CREATE POLICY "update_attendance"
  ON attendance FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
