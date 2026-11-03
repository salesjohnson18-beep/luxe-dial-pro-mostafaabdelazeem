CREATE TABLE public.sheet_sync_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  webhook_url text,
  enabled boolean NOT NULL DEFAULT true,
  last_sync_at timestamptz,
  last_status text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.sheet_sync_settings TO authenticated;
GRANT ALL ON public.sheet_sync_settings TO service_role;
ALTER TABLE public.sheet_sync_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage sheet sync" ON public.sheet_sync_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
INSERT INTO public.sheet_sync_settings (id) VALUES (true);