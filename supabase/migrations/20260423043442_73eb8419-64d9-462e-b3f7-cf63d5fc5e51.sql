
-- Enable pgcrypto for hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- 1. APP_SETTINGS: lock down completely (PINs live here)
-- ============================================================
DROP POLICY IF EXISTS public_all_settings ON public.app_settings;
-- No policies = no access for anon/authenticated. Only service_role bypasses RLS.

-- ============================================================
-- 2. STUDENTS: public can read roster WITHOUT email; no writes
-- ============================================================
DROP POLICY IF EXISTS public_all_students ON public.students;

-- Create a safe view exposing students without email
CREATE OR REPLACE VIEW public.students_public AS
SELECT id, student_id, name, section, status, created_at, updated_at
FROM public.students;

GRANT SELECT ON public.students_public TO anon, authenticated;

-- Block all direct table access (no policies)
REVOKE ALL ON public.students FROM anon, authenticated;

-- ============================================================
-- 3. EVENTS / EVENT_DAYS / SCAN_SLOTS: public read-only
-- ============================================================
DROP POLICY IF EXISTS public_all_events ON public.events;
DROP POLICY IF EXISTS public_all_event_days ON public.event_days;
DROP POLICY IF EXISTS public_all_scan_slots ON public.scan_slots;

CREATE POLICY events_public_read ON public.events
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY event_days_public_read ON public.event_days
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY scan_slots_public_read ON public.scan_slots
  FOR SELECT TO anon, authenticated USING (true);

-- ============================================================
-- 4. ATTENDANCE_RECORDS: public read-only (needed for live scan UI dedupe);
--    writes go through edge function
-- ============================================================
DROP POLICY IF EXISTS public_all_attendance ON public.attendance_records;

CREATE POLICY attendance_public_read ON public.attendance_records
  FOR SELECT TO anon, authenticated USING (true);

-- ============================================================
-- 5. Migrate existing PINs to hashed form
-- ============================================================
-- Read current pins, hash each value, store under key 'pins_hashed'
DO $$
DECLARE
  current_pins jsonb;
  hashed jsonb := '{}'::jsonb;
  k text;
  v text;
BEGIN
  SELECT value INTO current_pins FROM public.app_settings WHERE key = 'pins';
  IF current_pins IS NULL THEN
    -- seed defaults
    current_pins := jsonb_build_object(
      'admin', '47254725',
      'date_override', '1234',
      'delete_confirm', '9999',
      'qr_checker', '4725'
    );
  END IF;

  FOR k, v IN SELECT * FROM jsonb_each_text(current_pins)
  LOOP
    hashed := hashed || jsonb_build_object(k, crypt(v, gen_salt('bf', 10)));
  END LOOP;

  INSERT INTO public.app_settings (key, value)
  VALUES ('pins_hashed', hashed)
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

  -- Remove plaintext pins
  DELETE FROM public.app_settings WHERE key = 'pins';
END $$;

-- ============================================================
-- 6. Helper RPC for public QR lookup (exact student_id match only)
-- ============================================================
CREATE OR REPLACE FUNCTION public.lookup_student_for_qr(_student_id text)
RETURNS TABLE(student_id text, name text, section text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.student_id, s.name, s.section
  FROM public.students s
  WHERE s.student_id = _student_id
    AND s.status = 'enrolled'
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.lookup_student_for_qr(text) TO anon, authenticated;
