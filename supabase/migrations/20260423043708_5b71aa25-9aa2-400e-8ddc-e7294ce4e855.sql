
CREATE OR REPLACE FUNCTION public.verify_pin_hash(_pin text, _hash text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT crypt(_pin, _hash) = _hash;
$$;

CREATE OR REPLACE FUNCTION public.hash_pins(_pins jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  out jsonb := '{}'::jsonb;
  k text;
  v text;
BEGIN
  FOR k, v IN SELECT * FROM jsonb_each_text(_pins) LOOP
    out := out || jsonb_build_object(k, crypt(v, gen_salt('bf', 10)));
  END LOOP;
  RETURN out;
END;
$$;

-- Lock down: revoke from public/anon/authenticated; only service_role may call.
REVOKE ALL ON FUNCTION public.verify_pin_hash(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.hash_pins(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_pin_hash(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.hash_pins(jsonb) TO service_role;
