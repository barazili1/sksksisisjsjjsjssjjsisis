
CREATE TABLE public.access_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_name text NOT NULL,
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  max_devices integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.access_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key_id uuid NOT NULL REFERENCES public.access_keys(id) ON DELETE CASCADE,
  device_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (key_id, device_id)
);

CREATE INDEX access_keys_token_idx ON public.access_keys(token);
CREATE INDEX access_devices_key_id_idx ON public.access_devices(key_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.access_keys TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.access_devices TO authenticated;
GRANT ALL ON public.access_keys TO service_role;
GRANT ALL ON public.access_devices TO service_role;

ALTER TABLE public.access_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_devices ENABLE ROW LEVEL SECURITY;

-- All access mediated through server functions using service_role; no direct client access.
CREATE POLICY "deny_all_keys" ON public.access_keys FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY "deny_all_devices" ON public.access_devices FOR ALL TO authenticated USING (false) WITH CHECK (false);
