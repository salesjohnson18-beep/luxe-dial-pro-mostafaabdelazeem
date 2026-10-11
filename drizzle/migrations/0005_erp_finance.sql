ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS advance_amount numeric NOT NULL DEFAULT 0;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS ad_budget numeric;
ALTER TABLE public.client_installments ADD COLUMN IF NOT EXISTS payment_method text;
ALTER TABLE public.client_installments ADD COLUMN IF NOT EXISTS postponed_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.client_installments ADD COLUMN IF NOT EXISTS is_advance boolean NOT NULL DEFAULT false;
ALTER TABLE public.finance_entries ADD COLUMN IF NOT EXISTS account text NOT NULL DEFAULT 'fees';
ALTER TABLE public.finance_entries ADD COLUMN IF NOT EXISTS payment_method text;
ALTER TABLE public.finance_entries ADD CONSTRAINT finance_entries_account_chk CHECK (account IN ('fees','ad_budget'));

CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seq serial NOT NULL,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  installment_id uuid UNIQUE REFERENCES public.client_installments(id) ON DELETE CASCADE,
  account text NOT NULL DEFAULT 'fees' CHECK (account IN ('fees','ad_budget')),
  description text NOT NULL,
  amount numeric NOT NULL CHECK (amount >= 0),
  currency text NOT NULL DEFAULT 'SAR',
  issue_date date NOT NULL DEFAULT current_date,
  due_date date NOT NULL DEFAULT current_date,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','cancelled')),
  paid_at timestamptz,
  payment_method text,
  share_token text NOT NULL DEFAULT encode(extensions.gen_random_bytes(16),'hex'),
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.invoices_seq_seq TO authenticated, service_role;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view invoices" ON public.invoices FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'accountant') OR public.has_role(auth.uid(),'sales'));
CREATE POLICY "manage invoices" ON public.invoices FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'accountant')) WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'accountant'));

CREATE OR REPLACE FUNCTION public.installment_invoice() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE c record;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT project_name INTO c FROM public.clients WHERE id = NEW.client_id;
    INSERT INTO public.invoices(client_id, installment_id, description, amount, currency, issue_date, due_date, status, paid_at)
    VALUES (NEW.client_id, NEW.id,
      CASE WHEN NEW.is_advance THEN format('دفعة مقدمة — %s', c.project_name) ELSE format('أتعاب الإدارة والتسويق — %s — الدفعة %s من %s', c.project_name, NEW.number, NEW.total_count) END,
      NEW.amount, NEW.currency, current_date, NEW.due_date, CASE WHEN NEW.paid THEN 'paid' ELSE 'pending' END, NEW.paid_at);
  ELSE
    UPDATE public.invoices SET status = CASE WHEN NEW.paid THEN 'paid' ELSE 'pending' END, paid_at = NEW.paid_at,
      payment_method = NEW.payment_method, due_date = NEW.due_date, amount = NEW.amount WHERE installment_id = NEW.id;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER installment_invoice_ins AFTER INSERT ON public.client_installments FOR EACH ROW EXECUTE FUNCTION public.installment_invoice();
CREATE TRIGGER installment_invoice_upd AFTER UPDATE ON public.client_installments FOR EACH ROW EXECUTE FUNCTION public.installment_invoice();

INSERT INTO public.invoices(client_id, installment_id, description, amount, currency, due_date, status, paid_at)
SELECT i.client_id, i.id, format('أتعاب الإدارة والتسويق — %s — الدفعة %s من %s', c.project_name, i.number, i.total_count), i.amount, i.currency, i.due_date,
  CASE WHEN i.paid THEN 'paid' ELSE 'pending' END, i.paid_at
FROM public.client_installments i JOIN public.clients c ON c.id = i.client_id;

CREATE OR REPLACE FUNCTION public.confirm_installment(_id uuid, _method text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE i record;
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'accountant')) THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO i FROM public.client_installments WHERE id = _id;
  IF NOT FOUND THEN RAISE EXCEPTION 'not found'; END IF;
  UPDATE public.client_installments SET paid = true, paid_at = now(), payment_method = left(_method,60) WHERE id = _id;
  DELETE FROM public.finance_entries WHERE installment_id = _id;
  INSERT INTO public.finance_entries(kind, account, amount, currency, category, note, client_id, installment_id, payment_method)
  VALUES ('income','fees', i.amount, i.currency, 'أتعاب إدارة وتسويق',
    CASE WHEN i.is_advance THEN 'دفعة مقدمة' ELSE format('الدفعة %s من %s', i.number, i.total_count) END, i.client_id, _id, left(_method,60));
END $$;

CREATE OR REPLACE FUNCTION public.postpone_installment(_id uuid, _date date) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'accountant')) THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.client_installments SET due_date = _date, postponed_count = postponed_count + 1 WHERE id = _id AND paid = false;
END $$;

CREATE OR REPLACE FUNCTION public.set_installment_paid(_id uuid, _paid boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'accountant')) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _paid THEN PERFORM public.confirm_installment(_id, NULL); RETURN; END IF;
  UPDATE public.client_installments SET paid = false, paid_at = NULL, payment_method = NULL WHERE id = _id;
  DELETE FROM public.finance_entries WHERE installment_id = _id;
END $$;

CREATE OR REPLACE FUNCTION public.generate_client_installments(_client uuid) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE c record; n int; adv numeric; rest numeric; amt numeric; i int; stepd int; start date; made int := 0;
BEGIN
  IF NOT (public.can_edit_client(_client) OR public.has_role(auth.uid(),'accountant')) THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO c FROM public.clients WHERE id = _client;
  IF c.contract_total IS NULL OR c.contract_total <= 0 THEN RETURN 0; END IF;
  IF EXISTS (SELECT 1 FROM public.client_installments WHERE client_id = _client AND quote_id IS NOT NULL) THEN RETURN 0; END IF;
  IF EXISTS (SELECT 1 FROM public.client_installments WHERE client_id = _client AND paid) THEN
    -- keep paid history; only reschedule if nothing paid
    RETURN 0;
  END IF;
  DELETE FROM public.client_installments WHERE client_id = _client AND quote_id IS NULL AND paid = false;
  start := COALESCE(c.work_start_date, current_date);
  IF c.payment_method = 'upfront' THEN
    INSERT INTO public.client_installments(client_id, number, total_count, agreement_total, amount, due_date, currency, is_advance)
    VALUES (_client, 1, 1, c.contract_total, c.contract_total, start, c.currency, true);
    RETURN 1;
  END IF;
  adv := LEAST(GREATEST(COALESCE(c.advance_amount,0),0), c.contract_total);
  n := GREATEST(c.installments_count,1);
  stepd := CASE WHEN c.payment_method = 'monthly' THEN 30 ELSE 7 END;
  rest := c.contract_total - adv;
  IF adv > 0 THEN
    INSERT INTO public.client_installments(client_id, number, total_count, agreement_total, amount, due_date, currency, is_advance)
    VALUES (_client, 1, n + 1, c.contract_total, adv, start, c.currency, true);
    made := 1;
  END IF;
  IF rest > 0 THEN
    amt := round(rest / n, 2);
    FOR i IN 1..n LOOP
      INSERT INTO public.client_installments(client_id, number, total_count, agreement_total, amount, due_date, currency)
      VALUES (_client, i + made, n + made, c.contract_total, CASE WHEN i = n THEN rest - amt*(n-1) ELSE amt END, start + stepd*i, c.currency);
    END LOOP;
  END IF;
  RETURN n + made;
END $$;

CREATE OR REPLACE FUNCTION public.convert_quote_to_client(_quote uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE q record; cid uuid; tot numeric; n int; amt numeric; i int; stepd int;
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
  stepd := CASE WHEN q.payment_type = 'monthly' THEN 30 WHEN q.payment_type = 'weekly' THEN 7 ELSE 0 END;
  IF NOT EXISTS (SELECT 1 FROM public.client_installments WHERE quote_id = _quote) THEN
    amt := round(tot / n, 2);
    FOR i IN 1..n LOOP
      INSERT INTO public.client_installments(client_id, quote_id, number, total_count, agreement_total, amount, due_date, currency, is_advance)
      VALUES (cid, _quote, i, n, tot, CASE WHEN i = n THEN tot - amt*(n-1) ELSE amt END, current_date + stepd*i, q.currency, q.payment_type = 'upfront');
    END LOOP;
  END IF;
  UPDATE public.quotes SET client_id = cid, status = 'done', updated_at = now() WHERE id = _quote;
  IF q.lead_id IS NOT NULL THEN UPDATE public.leads SET status = 'done', client_id = cid WHERE id = q.lead_id; END IF;
  RETURN cid;
END $$;

CREATE OR REPLACE FUNCTION public.get_shared_invoice(_token text) RETURNS json LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT json_build_object('seq', i.seq, 'description', i.description, 'amount', i.amount, 'currency', i.currency,
    'issue_date', i.issue_date, 'due_date', i.due_date, 'status', i.status, 'paid_at', i.paid_at, 'account', i.account,
    'client_name', c.client_name, 'project_name', c.project_name, 'phone', c.phone)
  FROM public.invoices i JOIN public.clients c ON c.id = i.client_id WHERE i.share_token = _token AND i.status <> 'cancelled'
$$;
GRANT EXECUTE ON FUNCTION public.get_shared_invoice(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_installment(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.postpone_installment(uuid, date) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.installment_invoice() FROM PUBLIC, anon, authenticated;