
-- Recreate view with security_invoker so it uses caller's privileges
DROP VIEW IF EXISTS public.students_public;

CREATE VIEW public.students_public
WITH (security_invoker = true) AS
SELECT id, student_id, name, section, status, created_at, updated_at
FROM public.students;

-- Since the view runs as the invoker and anon/authenticated have no SELECT on students,
-- we need a SELECT policy on students that hides email-row access? Better: grant SELECT
-- on specific columns of students table.
GRANT SELECT (id, student_id, name, section, status, created_at, updated_at)
  ON public.students TO anon, authenticated;

-- Add an RLS policy allowing SELECT (column-level grant restricts which columns)
CREATE POLICY students_public_read_safe_cols ON public.students
  FOR SELECT TO anon, authenticated USING (true);

GRANT SELECT ON public.students_public TO anon, authenticated;

-- app_settings has RLS enabled with no policies => no access for anon/auth. That's intentional.
-- The linter INFO is acceptable here, but add explicit no-op comment via dummy denying policy is unnecessary.
-- We'll suppress by leaving as-is (intentional lockdown).
