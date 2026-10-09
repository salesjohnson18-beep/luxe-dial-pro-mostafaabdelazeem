ALTER TABLE public.reminders ADD COLUMN IF NOT EXISTS assignee_id uuid;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS next_followup_at timestamptz;

DROP POLICY IF EXISTS "own reminders" ON public.reminders;
CREATE POLICY "view reminders" ON public.reminders FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR assignee_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "insert reminders" ON public.reminders FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());
CREATE POLICY "update reminders" ON public.reminders FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR assignee_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "delete reminders" ON public.reminders FOR DELETE TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.update_shared_quote_customer(_token text, _name text, _project text, _phone text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE q record;
BEGIN
  IF length(trim(coalesce(_name,''))) = 0 THEN RAISE EXCEPTION 'invalid'; END IF;
  SELECT * INTO q FROM public.quotes WHERE share_token = _token AND status IN ('draft','sent','changes_requested','accepted');
  IF NOT FOUND THEN RETURN 'locked'; END IF;
  UPDATE public.quotes SET customer_name = left(trim(_name),120), project_name = NULLIF(left(trim(coalesce(_project,'')),120),''),
    phone = NULLIF(left(trim(coalesce(_phone,'')),30),''), updated_at = now() WHERE id = q.id;
  IF q.client_id IS NOT NULL THEN
    UPDATE public.clients SET client_name = left(trim(_name),120),
      project_name = COALESCE(NULLIF(left(trim(coalesce(_project,'')),120),''), project_name),
      phone = COALESCE(NULLIF(left(trim(coalesce(_phone,'')),30),''), phone) WHERE id = q.client_id;
  END IF;
  IF q.lead_id IS NOT NULL THEN
    UPDATE public.leads SET client_name = left(trim(_name),120), project_name = NULLIF(left(trim(coalesce(_project,'')),120),''),
      phone = NULLIF(left(trim(coalesce(_phone,'')),30),'') WHERE id = q.lead_id;
  END IF;
  RETURN 'ok';
END $$;

GRANT EXECUTE ON FUNCTION public.get_shared_quote(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.respond_quote(text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_shared_quote_customer(text, text, text, text) TO anon, authenticated;