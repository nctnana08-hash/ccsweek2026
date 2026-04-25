DROP POLICY IF EXISTS app_settings_active_context_public_read ON public.app_settings;

CREATE POLICY app_settings_active_context_public_read
ON public.app_settings
FOR SELECT
TO anon, authenticated
USING (key = 'active_scan_context');