/*
# Create auth OTP codes table

1. New Tables
- `auth_otp_codes`
  - `id` (uuid, primary key)
  - `phone` (text, not null) — phone number OTP was sent to
  - `otp_code` (text, not null) — 6-digit OTP
  - `expires_at` (timestamptz, not null) — when OTP expires (10 min)
  - `verified` (boolean, default false) — whether OTP was used
  - `attempts` (int, default 0) — wrong verification attempts
  - `created_at` (timestamptz, default now())

2. Security
- Enable RLS on `auth_otp_codes`.
- Allow anon + authenticated INSERT (edge function uses service role, but anon needs access for the flow).
- Actually, the edge function uses service role key which bypasses RLS.
- For safety, deny direct table access from anon/authenticated — only the edge function (service role) should read/write.
- No policies = table is locked to anon/authenticated, only service role can access.

3. Notes
- The edge function uses SUPABASE_SERVICE_ROLE_KEY which bypasses RLS.
- OTP codes are stored hashed for security (SHA-256).
- Rate limiting: max 3 OTP requests per phone per 10 minutes (enforced in edge function).
- Max 5 verification attempts per OTP.
*/

CREATE TABLE IF NOT EXISTS auth_otp_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  otp_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  verified boolean NOT NULL DEFAULT false,
  attempts integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE auth_otp_codes ENABLE ROW LEVEL SECURITY;

-- No policies: only service role (edge function) can access this table.
-- anon and authenticated roles get nothing.

-- Index for looking up recent OTPs by phone
CREATE INDEX IF NOT EXISTS idx_auth_otp_phone ON auth_otp_codes(phone);
CREATE INDEX IF NOT EXISTS idx_auth_otp_expires ON auth_otp_codes(expires_at);