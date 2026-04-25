UPDATE public.app_settings
SET value = value || jsonb_build_object('scanner_pin', extensions.crypt('47254725', extensions.gen_salt('bf', 10)))
WHERE key = 'pins_hashed'
  AND NOT (value ? 'scanner_pin');