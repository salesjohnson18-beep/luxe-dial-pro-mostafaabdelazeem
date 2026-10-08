ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'SAR';
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'SAR';
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'SAR',
  ADD COLUMN IF NOT EXISTS contract_total numeric,
  ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'upfront',
  ADD COLUMN IF NOT EXISTS installments_count integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS work_start_date date,
  ADD COLUMN IF NOT EXISTS last_transfer_at date,
  ADD COLUMN IF NOT EXISTS sheet_url text,
  ADD COLUMN IF NOT EXISTS sheet_synced_at timestamptz;
ALTER TABLE public.client_vault
  ADD COLUMN IF NOT EXISTS username text,
  ADD COLUMN IF NOT EXISTS secret text,
  ADD COLUMN IF NOT EXISTS url text;
ALTER TABLE public.client_installments ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'SAR';

CREATE OR REPLACE FUNCTION public.list_staff()
RETURNS TABLE(id uuid, name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, COALESCE(NULLIF(p.full_name,''), p.email)
  FROM public.profiles p
  WHERE public.has_any_role(auth.uid()) AND EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = p.id)
  ORDER BY 2
$$;
GRANT EXECUTE ON FUNCTION public.list_staff() TO authenticated;

-- Regenerate unpaid manual installments from the client's contract fields
CREATE OR REPLACE FUNCTION public.generate_client_installments(_client uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c record; n int; amt numeric; paid_sum numeric; paid_n int; i int; step interval; start date;
BEGIN
  IF NOT (public.can_edit_client(_client) OR public.has_role(auth.uid(),'accountant')) THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO c FROM public.clients WHERE id = _client;
  IF c.contract_total IS NULL OR c.contract_total <= 0 THEN RETURN 0; END IF;
  IF EXISTS (SELECT 1 FROM public.client_installments WHERE client_id = _client AND quote_id IS NOT NULL) THEN RETURN 0; END IF;
  DELETE FROM public.client_installments WHERE client_id = _client AND quote_id IS NULL AND paid = false;
  SELECT COALESCE(sum(amount),0), count(*) INTO paid_sum, paid_n FROM public.client_installments WHERE client_id = _client AND paid;
  n := CASE WHEN c.payment_method = 'upfront' THEN 1 ELSE GREATEST(c.installments_count,1) END;
  step := CASE WHEN c.payment_method = 'monthly' THEN interval '1 month' ELSE interval '7 days' END;
  start := COALESCE(c.work_start_date, current_date);
  amt := round(c.contract_total / n, 2);
  FOR i IN (paid_n+1)..n LOOP
    INSERT INTO public.client_installments(client_id, number, total_count, agreement_total, amount, due_date, currency)
    VALUES (_client, i, n, c.contract_total,
      CASE WHEN i = n THEN c.contract_total - amt*(n-1) ELSE amt END,
      (start + step*(i-1))::date, c.currency);
  END LOOP;
  RETURN n - paid_n;
END $$;
GRANT EXECUTE ON FUNCTION public.generate_client_installments(uuid) TO authenticated;

CREATE TABLE public.finance_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL DEFAULT 'expense',
  amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'SAR',
  category text,
  note text,
  entry_date date NOT NULL DEFAULT current_date,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  installment_id uuid REFERENCES public.client_installments(id) ON DELETE CASCADE,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_entries TO authenticated;
GRANT ALL ON public.finance_entries TO service_role;
ALTER TABLE public.finance_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "finance access" ON public.finance_entries FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'accountant'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'accountant'));

-- Mark installment paid + record income atomically
CREATE OR REPLACE FUNCTION public.set_installment_paid(_id uuid, _paid boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE i record;
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'accountant')) THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO i FROM public.client_installments WHERE id = _id;
  UPDATE public.client_installments SET paid = _paid, paid_at = CASE WHEN _paid THEN now() END WHERE id = _id;
  DELETE FROM public.finance_entries WHERE installment_id = _id;
  IF _paid THEN
    INSERT INTO public.finance_entries(kind, amount, currency, category, note, client_id, installment_id)
    VALUES ('income', i.amount, i.currency, 'دفعة عميل', format('الدفعة %s من %s', i.number, i.total_count), i.client_id, _id);
  END IF;
END $$;
GRANT EXECUTE ON FUNCTION public.set_installment_paid(uuid, boolean) TO authenticated;

CREATE TABLE public.reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  title text NOT NULL,
  kind text NOT NULL DEFAULT 'task',
  recurrence text NOT NULL DEFAULT 'none',
  due_at timestamptz NOT NULL DEFAULT now(),
  done boolean NOT NULL DEFAULT false,
  last_done_at timestamptz,
  note text,
  link text,
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reminders TO authenticated;
GRANT ALL ON public.reminders TO service_role;
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own reminders" ON public.reminders FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE OR REPLACE FUNCTION public.get_shared_report(_token text, _from date, _to date)
RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE c record;
BEGIN
  SELECT id, client_name, project_name, currency INTO c FROM public.clients WHERE share_token = _token;
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN json_build_object(
    'client_name', c.client_name, 'project_name', c.project_name, 'currency', c.currency,
    'entries', COALESCE((SELECT json_agg(json_build_object('entry_date',entry_date,'platform',platform,'spend',spend,'clicks',clicks,'impressions',impressions,'purchases',purchases,'revenue',revenue))
      FROM public.campaign_entries WHERE client_id = c.id AND entry_date BETWEEN _from AND _to), '[]'::json)
  );
END $$;

CREATE OR REPLACE FUNCTION public.get_shared_quote(_token text)
RETURNS json LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT json_build_object(
    'seq', q.seq, 'customer_name', q.customer_name, 'project_name', q.project_name, 'currency', q.currency,
    'payment_type', q.payment_type, 'installments', q.installments, 'discount', q.discount,
    'status', q.status, 'client_response', q.client_response, 'notes', q.notes,
    'valid_until', q.valid_until, 'created_at', q.created_at,
    'items', COALESCE((SELECT json_agg(json_build_object('name',name,'description',description,'price',price,'qty',qty) ORDER BY position)
       FROM public.quote_items WHERE quote_id = q.id), '[]'::json))
  FROM public.quotes q WHERE q.share_token = _token AND q.status <> 'cancelled'
$$;

-- installments created from quotes should carry the quote currency
CREATE OR REPLACE FUNCTION public.convert_quote_to_client(_quote uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE q record; cid uuid; tot numeric; n int; amt numeric; i int; step interval;
BEGIN
  IF NOT public.can_crm() THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO q FROM public.quotes WHERE id = _quote FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not found'; END IF;
  cid := q.client_id;
  IF cid IS NULL AND q.lead_id IS NOT NULL THEN SELECT client_id INTO cid FROM public.leads WHERE id = q.lead_id; END IF;
  tot := public.quote_total(_quote);
  n := CASE WHEN q.payment_type = 'upfront' THEN 1 ELSE GREATEST(q.installments,1) END;
  IF cid IS NULL THEN
    INSERT INTO public.clients(client_name, project_name, phone, transfer_cycle, currency, contract_total, payment_method, installments_count, work_start_date, created_by)
    VALUES (q.customer_name, COALESCE(NULLIF(q.project_name,''), q.customer_name), q.phone,
            CASE WHEN q.payment_type = 'monthly' THEN 'monthly' ELSE 'weekly' END, q.currency, tot, q.payment_type, n, current_date, auth.uid())
    RETURNING id INTO cid;
  END IF;
  step := CASE WHEN q.payment_type = 'monthly' THEN interval '1 month' ELSE interval '7 days' END;
  IF NOT EXISTS (SELECT 1 FROM public.client_installments WHERE quote_id = _quote) THEN
    amt := round(tot / n, 2);
    FOR i IN 1..n LOOP
      INSERT INTO public.client_installments(client_id, quote_id, number, total_count, agreement_total, amount, due_date, currency)
      VALUES (cid, _quote, i, n, tot, CASE WHEN i = n THEN tot - amt*(n-1) ELSE amt END, (current_date + step*(i-1))::date, q.currency);
    END LOOP;
  END IF;
  UPDATE public.quotes SET client_id = cid, status = 'done', updated_at = now() WHERE id = _quote;
  IF q.lead_id IS NOT NULL THEN UPDATE public.leads SET status = 'done', client_id = cid WHERE id = q.lead_id; END IF;
  RETURN cid;
END $$;

CREATE OR REPLACE FUNCTION public.convert_lead_to_client(_lead uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE l record; cid uuid;
BEGIN
  IF NOT public.can_crm() THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO l FROM public.leads WHERE id = _lead FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not found'; END IF;
  IF l.client_id IS NOT NULL THEN UPDATE public.leads SET status = 'done' WHERE id = _lead; RETURN l.client_id; END IF;
  INSERT INTO public.clients(client_name, project_name, phone, notes, currency, work_start_date, created_by)
  VALUES (l.client_name, COALESCE(NULLIF(l.project_name,''), l.client_name), l.phone,
          NULLIF(concat_ws(' — ', l.service, l.notes),''), l.currency, current_date, auth.uid())
  RETURNING id INTO cid;
  UPDATE public.leads SET status = 'done', client_id = cid WHERE id = _lead;
  RETURN cid;
END $$;