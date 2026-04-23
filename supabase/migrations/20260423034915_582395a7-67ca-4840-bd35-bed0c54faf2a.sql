-- ============ STUDENTS ============
CREATE TABLE public.students (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  email TEXT,
  section TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'enrolled' CHECK (status IN ('enrolled','inactive','graduated')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_students_section ON public.students(section);
CREATE INDEX idx_students_status ON public.students(status);

-- ============ EVENTS ============
CREATE TABLE public.events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_events_status ON public.events(status);

-- ============ EVENT DAYS ============
CREATE TABLE public.event_days (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  day_label TEXT NOT NULL,
  date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_event_days_event ON public.event_days(event_id);
CREATE INDEX idx_event_days_date ON public.event_days(date);

-- ============ SCAN SLOTS ============
CREATE TABLE public.scan_slots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  day_id UUID NOT NULL REFERENCES public.event_days(id) ON DELETE CASCADE,
  slot_label TEXT NOT NULL,
  slot_type TEXT NOT NULL DEFAULT 'in' CHECK (slot_type IN ('in','out','custom')),
  "order" INT NOT NULL DEFAULT 0,
  late_cutoff_time TIME,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_scan_slots_day ON public.scan_slots(day_id);

-- ============ ATTENDANCE RECORDS ============
CREATE TABLE public.attendance_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID,
  student_id TEXT NOT NULL,
  name TEXT NOT NULL,
  section TEXT NOT NULL,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  day_id UUID NOT NULL REFERENCES public.event_days(id) ON DELETE CASCADE,
  slot_id UUID NOT NULL REFERENCES public.scan_slots(id) ON DELETE CASCADE,
  slot_label TEXT NOT NULL,
  scanned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_late BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT uq_attendance_profile_slot UNIQUE (profile_id, slot_id)
);
CREATE INDEX idx_attendance_event ON public.attendance_records(event_id);
CREATE INDEX idx_attendance_day ON public.attendance_records(day_id);
CREATE INDEX idx_attendance_slot ON public.attendance_records(slot_id);
CREATE INDEX idx_attendance_student ON public.attendance_records(student_id);
CREATE INDEX idx_attendance_section ON public.attendance_records(section);
CREATE INDEX idx_attendance_scanned_at ON public.attendance_records(scanned_at DESC);

-- ============ APP SETTINGS ============
CREATE TABLE public.app_settings (
  key TEXT NOT NULL PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============ TIMESTAMP TRIGGER ============
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER tr_students_updated BEFORE UPDATE ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER tr_events_updated BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER tr_app_settings_updated BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ RLS (public for v1, PIN-gated in app) ============
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_all_students" ON public.students FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all_events" ON public.events FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all_event_days" ON public.event_days FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all_scan_slots" ON public.scan_slots FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all_attendance" ON public.attendance_records FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all_settings" ON public.app_settings FOR ALL USING (true) WITH CHECK (true);

-- ============ REALTIME ============
ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance_records;
ALTER PUBLICATION supabase_realtime ADD TABLE public.app_settings;

-- ============ DEFAULT PIN SETTINGS ============
INSERT INTO public.app_settings (key, value) VALUES
  ('pins', '{"admin":"47254725","date_override":"4724685","delete_confirm":"4725555","qr_checker":"472005"}'::jsonb),
  ('active_scan_context', '{"event_id":null,"day_id":null,"slot_id":null}'::jsonb);
