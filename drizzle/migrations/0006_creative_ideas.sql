CREATE TABLE public.creative_ideas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'hook',
  platform text,
  title text,
  content text NOT NULL,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.creative_ideas TO authenticated;
GRANT ALL ON public.creative_ideas TO service_role;
ALTER TABLE public.creative_ideas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view ideas" ON public.creative_ideas FOR SELECT TO authenticated USING (public.can_view_client(client_id));
CREATE POLICY "manage ideas" ON public.creative_ideas FOR ALL TO authenticated USING (public.can_edit_client(client_id)) WITH CHECK (public.can_edit_client(client_id));