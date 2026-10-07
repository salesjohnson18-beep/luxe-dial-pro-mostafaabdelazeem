CREATE OR REPLACE FUNCTION public.can_crm()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'sales')
$$;
CREATE OR REPLACE FUNCTION public.can_view_crm()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.can_crm() OR public.has_role(auth.uid(),'accountant')
$$;

CREATE TABLE public.services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  price numeric NOT NULL DEFAULT 0,
  payment_terms text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.services TO authenticated;
GRANT ALL ON public.services TO service_role;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view services" ON public.services FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()));
CREATE POLICY "manage services" ON public.services FOR ALL TO authenticated USING (public.can_crm()) WITH CHECK (public.can_crm());

CREATE TABLE public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seq serial,
  client_name text NOT NULL,
  project_name text,
  phone text,
  service text,
  rep_id uuid DEFAULT auth.uid(),
  rep_name text,
  status text NOT NULL DEFAULT 'following',
  notes text,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads TO authenticated;
GRANT USAGE ON SEQUENCE public.leads_seq_seq TO authenticated;
GRANT ALL ON public.leads TO service_role;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view leads" ON public.leads FOR SELECT TO authenticated USING (public.can_view_crm());
CREATE POLICY "manage leads" ON public.leads FOR ALL TO authenticated USING (public.can_crm()) WITH CHECK (public.can_crm());

CREATE TABLE public.lead_followups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  attempt_no integer NOT NULL,
  outcome text NOT NULL,
  note text,
  caller_name text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_followups TO authenticated;
GRANT ALL ON public.lead_followups TO service_role;
ALTER TABLE public.lead_followups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view followups" ON public.lead_followups FOR SELECT TO authenticated USING (public.can_view_crm());
CREATE POLICY "manage followups" ON public.lead_followups FOR ALL TO authenticated USING (public.can_crm()) WITH CHECK (public.can_crm());

CREATE TABLE public.quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seq serial,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  customer_name text NOT NULL,
  project_name text,
  phone text,
  payment_type text NOT NULL DEFAULT 'upfront',
  installments integer NOT NULL DEFAULT 1,
  discount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  client_response text,
  notes text,
  valid_until date,
  share_token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16),'hex'),
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quotes TO authenticated;
GRANT USAGE ON SEQUENCE public.quotes_seq_seq TO authenticated;
GRANT ALL ON public.quotes TO service_role;
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view quotes" ON public.quotes FOR SELECT TO authenticated USING (public.can_view_crm());
CREATE POLICY "manage quotes" ON public.quotes FOR ALL TO authenticated USING (public.can_crm()) WITH CHECK (public.can_crm());

CREATE TABLE public.quote_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  service_id uuid REFERENCES public.services(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  price numeric NOT NULL DEFAULT 0,
  qty integer NOT NULL DEFAULT 1,
  position integer NOT NULL DEFAULT 0
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quote_items TO authenticated;
GRANT ALL ON public.quote_items TO service_role;
ALTER TABLE public.quote_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view quote items" ON public.quote_items FOR SELECT TO authenticated USING (public.can_view_crm());
CREATE POLICY "manage quote items" ON public.quote_items FOR ALL TO authenticated USING (public.can_crm()) WITH CHECK (public.can_crm());

CREATE TABLE public.client_installments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  quote_id uuid REFERENCES public.quotes(id) ON DELETE SET NULL,
  number integer NOT NULL,
  total_count integer NOT NULL,
  agreement_total numeric NOT NULL,
  amount numeric NOT NULL,
  due_date date NOT NULL,
  paid boolean NOT NULL DEFAULT false,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_installments TO authenticated;
GRANT ALL ON public.client_installments TO service_role;
ALTER TABLE public.client_installments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view installments" ON public.client_installments FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'accountant') OR public.has_role(auth.uid(),'sales'));
CREATE POLICY "manage installments" ON public.client_installments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'accountant'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'accountant'));

CREATE OR REPLACE FUNCTION public.quote_total(_quote uuid)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT GREATEST(COALESCE((SELECT sum(price*qty) FROM public.quote_items WHERE quote_id = _quote),0)
    - (SELECT discount FROM public.quotes WHERE id = _quote), 0)
$$;
GRANT EXECUTE ON FUNCTION public.quote_total(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.convert_lead_to_client(_lead uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE l record; cid uuid;
BEGIN
  IF NOT public.can_crm() THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO l FROM public.leads WHERE id = _lead FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not found'; END IF;
  IF l.client_id IS NOT NULL THEN
    UPDATE public.leads SET status = 'done' WHERE id = _lead;
    RETURN l.client_id;
  END IF;
  INSERT INTO public.clients(client_name, project_name, phone, notes, created_by)
  VALUES (l.client_name, COALESCE(NULLIF(l.project_name,''), l.client_name), l.phone,
          NULLIF(concat_ws(' — ', l.service, l.notes),''), auth.uid())
  RETURNING id INTO cid;
  UPDATE public.leads SET status = 'done', client_id = cid WHERE id = _lead;
  RETURN cid;
END $$;
GRANT EXECUTE ON FUNCTION public.convert_lead_to_client(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.convert_quote_to_client(_quote uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE q record; cid uuid; tot numeric; n int; amt numeric; i int; step interval;
BEGIN
  IF NOT public.can_crm() THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO q FROM public.quotes WHERE id = _quote FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not found'; END IF;
  cid := q.client_id;
  IF cid IS NULL AND q.lead_id IS NOT NULL THEN
    SELECT client_id INTO cid FROM public.leads WHERE id = q.lead_id;
  END IF;
  IF cid IS NULL THEN
    INSERT INTO public.clients(client_name, project_name, phone, transfer_cycle, created_by)
    VALUES (q.customer_name, COALESCE(NULLIF(q.project_name,''), q.customer_name), q.phone,
            CASE WHEN q.payment_type = 'monthly' THEN 'monthly' ELSE 'weekly' END, auth.uid())
    RETURNING id INTO cid;
  END IF;
  tot := public.quote_total(_quote);
  n := CASE WHEN q.payment_type = 'upfront' THEN 1 ELSE GREATEST(q.installments,1) END;
  step := CASE WHEN q.payment_type = 'monthly' THEN interval '1 month' ELSE interval '7 days' END;
  IF NOT EXISTS (SELECT 1 FROM public.client_installments WHERE quote_id = _quote) THEN
    amt := round(tot / n, 2);
    FOR i IN 1..n LOOP
      INSERT INTO public.client_installments(client_id, quote_id, number, total_count, agreement_total, amount, due_date)
      VALUES (cid, _quote, i, n, tot,
        CASE WHEN i = n THEN tot - amt*(n-1) ELSE amt END,
        (current_date + step*(i-1))::date);
    END LOOP;
  END IF;
  UPDATE public.quotes SET client_id = cid, status = 'done', updated_at = now() WHERE id = _quote;
  IF q.lead_id IS NOT NULL THEN
    UPDATE public.leads SET status = 'done', client_id = cid WHERE id = q.lead_id;
  END IF;
  RETURN cid;
END $$;
GRANT EXECUTE ON FUNCTION public.convert_quote_to_client(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_shared_quote(_token text)
RETURNS json LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT json_build_object(
    'seq', q.seq, 'customer_name', q.customer_name, 'project_name', q.project_name,
    'payment_type', q.payment_type, 'installments', q.installments, 'discount', q.discount,
    'status', q.status, 'client_response', q.client_response, 'notes', q.notes,
    'valid_until', q.valid_until, 'created_at', q.created_at,
    'items', COALESCE((SELECT json_agg(json_build_object('name',name,'description',description,'price',price,'qty',qty) ORDER BY position)
       FROM public.quote_items WHERE quote_id = q.id), '[]'::json))
  FROM public.quotes q WHERE q.share_token = _token AND q.status <> 'cancelled'
$$;
GRANT EXECUTE ON FUNCTION public.get_shared_quote(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.respond_quote(_token text, _action text, _note text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _action NOT IN ('accepted','changes_requested') THEN RAISE EXCEPTION 'invalid'; END IF;
  UPDATE public.quotes SET status = _action, client_response = left(_note, 2000), updated_at = now()
  WHERE share_token = _token AND status IN ('draft','sent','changes_requested');
  IF NOT FOUND THEN RETURN 'locked'; END IF;
  RETURN 'ok';
END $$;
GRANT EXECUTE ON FUNCTION public.respond_quote(text, text, text) TO anon, authenticated;