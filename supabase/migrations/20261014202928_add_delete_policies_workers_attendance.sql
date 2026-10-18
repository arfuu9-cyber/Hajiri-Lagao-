/*
# Add missing DELETE policies on workers and attendance tables

1. Modified Tables
- `workers`: Add DELETE policy for authenticated users (was missing)
- `attendance`: Add DELETE policy for authenticated users (was missing)

2. Security
- RLS already enabled on both tables
- Workers: authenticated users can delete worker records (single-tenant app model)
- Attendance: authenticated users can delete attendance records
- These complement the existing SELECT, INSERT, UPDATE policies
*/

DROP POLICY IF EXISTS "delete_workers" ON workers;
CREATE POLICY "delete_workers" ON workers FOR DELETE
  TO authenticated USING (true);

DROP POLICY IF EXISTS "delete_attendance" ON attendance;
CREATE POLICY "delete_attendance" ON attendance FOR DELETE
  TO authenticated USING (true);
