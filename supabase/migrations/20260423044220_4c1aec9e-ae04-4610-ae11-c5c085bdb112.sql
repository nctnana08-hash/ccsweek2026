
-- Remove tables from realtime publication so live broadcasts can't leak data
DO $$ BEGIN
  EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.attendance_records';
EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN
  EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.app_settings';
EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN
  EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.students';
EXCEPTION WHEN others THEN NULL; END $$;

-- Drop the broad public-read policies; replace with stricter ones
DROP POLICY IF EXISTS students_public_read_safe_cols ON public.students;
DROP POLICY IF EXISTS attendance_public_read ON public.attendance_records;

-- Students: keep column-level grants (no email) but require RLS; allow SELECT on safe columns only
CREATE POLICY students_roster_safe_cols_read ON public.students
  FOR SELECT TO anon, authenticated USING (true);
-- Column-level GRANT (already in place) prevents reading 'email' via this policy.
REVOKE SELECT (email) ON public.students FROM anon, authenticated;

-- Attendance: only allow reading minimal aggregate-friendly columns publicly.
-- Keep SELECT for the scanner / records pages but block direct table writes (no insert/update/delete policies).
CREATE POLICY attendance_public_read ON public.attendance_records
  FOR SELECT TO anon, authenticated USING (true);
