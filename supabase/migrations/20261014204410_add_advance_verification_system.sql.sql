/*
# Smart Advance Verification System

## Overview
Adds fraud-proof verification to the advances system. When a thekedar gives kharchi/advance to a mazdoor, the mazdoor receives an OTP via SMS/WhatsApp. Only after the mazdoor enters the correct OTP does the advance become "verified" and count towards payroll deductions. This prevents fraudulent advance entries.

## Changes to existing tables

### advances table — new columns
- `status` (text, default 'pending'): Either 'pending' (OTP not yet verified) or 'verified' (mazdoor confirmed via OTP)
- `given_by` (uuid, nullable): The auth user ID of the thekedar who gave the advance, for audit trail
- `verified_at` (timestamptz, nullable): When the mazdoor verified the advance via OTP
- `otp_code` (text, nullable): 6-digit OTP code sent to the mazdoor for verification
- `otp_expires_at` (timestamptz, nullable): When the OTP expires (10 minutes from generation)

## New tables

### advance_verifications
Tracks OTP verification attempts for audit purposes.
- `id` (uuid, primary key)
- `advance_id` (uuid, foreign key to advances.id)
- `attempt_type` (text): 'otp_sent' | 'otp_verified' | 'otp_failed' | 'otp_resent'
- `phone_used` (text): The phone number the OTP was sent to
- `created_at` (timestamptz)

## Security
- RLS enabled on advance_verifications
- Policies allow authenticated users to read/insert verification logs
- Existing advance policies remain unchanged

## Important notes
1. Only 'verified' advances are counted in payroll deductions
2. 'pending' advances remain in the system for audit but don't reduce payouts
3. OTP expires after 10 minutes
4. Each advance can only be verified once
*/

-- Add new columns to advances table
ALTER TABLE advances
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending'
    CHECK (status = ANY (ARRAY['pending'::text, 'verified'::text]));

ALTER TABLE advances
  ADD COLUMN IF NOT EXISTS given_by uuid;

ALTER TABLE advances
  ADD COLUMN IF NOT EXISTS verified_at timestamptz;

ALTER TABLE advances
  ADD COLUMN IF NOT EXISTS otp_code text;

ALTER TABLE advances
  ADD COLUMN IF NOT EXISTS otp_expires_at timestamptz;

-- Create advance_verifications audit table
CREATE TABLE IF NOT EXISTS advance_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  advance_id uuid NOT NULL REFERENCES advances(id) ON DELETE CASCADE,
  attempt_type text NOT NULL CHECK (attempt_type = ANY (ARRAY['otp_sent'::text, 'otp_verified'::text, 'otp_failed'::text, 'otp_resent'::text])),
  phone_used text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE advance_verifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_advance_verifications" ON advance_verifications;
CREATE POLICY "select_advance_verifications"
  ON advance_verifications FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_advance_verifications" ON advance_verifications;
CREATE POLICY "insert_advance_verifications"
  ON advance_verifications FOR INSERT
  TO authenticated WITH CHECK (true);

-- Create index on advances.status for payroll filtering
CREATE INDEX IF NOT EXISTS idx_advances_status ON advances(status);

-- Create index on advances.given_by for audit queries
CREATE INDEX IF NOT EXISTS idx_advances_given_by ON advances(given_by);
