-- ============ SCANNER SESSIONS ============
CREATE TABLE public.scanner_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_token TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  locked BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX idx_scanner_sessions_expires ON public.scanner_sessions(expires_at);
CREATE INDEX idx_scanner_sessions_locked ON public.scanner_sessions(locked);

-- Add scanner_pin scope to app_settings if needed
-- This will be verified in the edge function

-- Enable RLS
ALTER TABLE public.scanner_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_all_scanner_sessions" ON public.scanner_sessions FOR ALL USING (true) WITH CHECK (true);
