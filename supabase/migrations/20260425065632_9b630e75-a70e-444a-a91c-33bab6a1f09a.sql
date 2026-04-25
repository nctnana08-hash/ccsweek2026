-- Enable realtime for app_settings so active scan context syncs across devices
ALTER TABLE public.app_settings REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.app_settings;

-- Update Scanner PIN to 47224722
UPDATE public.app_settings
SET value = value || jsonb_build_object(
  'scanner_pin',
  extensions.crypt('47224722', extensions.gen_salt('bf', 10))
),
updated_at = now()
WHERE key = 'pins_hashed';