ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS contract_kind text NOT NULL DEFAULT 'project';
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
UPDATE public.clients SET status = CASE WHEN is_active THEN 'active' ELSE 'inactive' END;
UPDATE public.clients SET contract_kind = 'retainer' WHERE payment_method IN ('monthly','weekly') AND installments_count <= 1;
ALTER TABLE public.clients ADD CONSTRAINT clients_contract_kind_chk CHECK (contract_kind IN ('project','retainer'));
ALTER TABLE public.clients ADD CONSTRAINT clients_status_chk CHECK (status IN ('active','paused','inactive'));

CREATE OR REPLACE FUNCTION public.sync_client_status() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.is_active := (NEW.status = 'active'); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS trg_sync_client_status ON public.clients;
CREATE TRIGGER trg_sync_client_status BEFORE INSERT OR UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.sync_client_status();

-- internal: add one cycle after the latest one (or aligned to today)
CREATE OR REPLACE FUNCTION public._add_retainer_cycle(_client uuid, _force boolean) RETURNS date LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c record; stepd int; last date; nxt date; num int; k int;
BEGIN
  SELECT * INTO c FROM public.clients WHERE id = _client;
  IF c.contract_kind <> 'retainer' OR c.contract_total IS NULL OR c.contract_total <= 0 THEN RETURN NULL; END IF;
  stepd := CASE WHEN c.payment_method = 'weekly' THEN 7 ELSE 30 END;
  SELECT max(due_date), COALESCE(max(number),0) INTO last, num FROM public.client_installments WHERE client_id = _client;
  IF last IS NULL THEN
    nxt := COALESCE(c.work_start_date, current_date) + stepd;
    IF nxt < current_date - stepd THEN
      k := (current_date - nxt) / stepd; nxt := nxt + k * stepd;
    END IF;
  ELSE
    nxt := last + stepd;
    IF NOT _force AND nxt < current_date - stepd THEN
      k := (current_date - nxt) / stepd; nxt := nxt + k * stepd;
    END IF;
  END IF;
  INSERT INTO public.client_installments(client_id, number, total_count, agreement_total, amount, due_date, currency)
  VALUES (_client, num + 1, 0, c.contract_total, c.contract_total, nxt, c.currency);
  RETURN nxt;
END $$;
REVOKE ALL ON FUNCTION public._add_retainer_cycle(uuid, boolean) FROM PUBLIC, anon, authenticated;

-- ensure current + next cycle exist for an active retainer
CREATE OR REPLACE FUNCTION public._ensure_retainer(_client uuid) RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c record; stepd int; made int := 0;
BEGIN
  SELECT * INTO c FROM public.clients WHERE id = _client;
  IF c.status <> 'active' OR c.contract_kind <> 'retainer' OR COALESCE(c.contract_total,0) <= 0 THEN RETURN 0; END IF;
  stepd := CASE WHEN c.payment_method = 'weekly' THEN 7 ELSE 30 END;
  WHILE made < 60 AND COALESCE((SELECT max(due_date) FROM public.client_installments WHERE client_id = _client), '1900-01-01'::date) <= current_date + stepd - 1 LOOP
    PERFORM public._add_retainer_cycle(_client, false); made := made + 1;
  END LOOP;
  RETURN made;
END $$;
REVOKE ALL ON FUNCTION public._ensure_retainer(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.generate_next_cycle(_client uuid) RETURNS date LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c record;
BEGIN
  IF NOT (public.can_edit_client(_client) OR public.has_role(auth.uid(),'accountant')) THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO c FROM public.clients WHERE id = _client;
  IF c.status <> 'active' THEN RAISE EXCEPTION 'العميل غير نشط'; END IF;
  IF c.contract_kind <> 'retainer' THEN RAISE EXCEPTION 'متاح للتعاقد المستمر فقط'; END IF;
  RETURN public._add_retainer_cycle(_client, true);
END $$;
GRANT EXECUTE ON FUNCTION public.generate_next_cycle(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.ensure_recurring_cycles() RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; total int := 0;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_any_role(auth.uid()) THEN RETURN 0; END IF;
  FOR r IN SELECT id FROM public.clients WHERE status = 'active' AND contract_kind = 'retainer' LOOP
    IF public.can_edit_client(r.id) OR public.has_role(auth.uid(),'accountant') THEN total := total + public._ensure_retainer(r.id); END IF;
  END LOOP;
  RETURN total;
END $$;
GRANT EXECUTE ON FUNCTION public.ensure_recurring_cycles() TO authenticated;

CREATE OR REPLACE FUNCTION public.generate_client_installments(_client uuid)
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE c record; n int; adv numeric; rest numeric; amt numeric; i int; stepd int; start date; made int := 0;
BEGIN
  IF NOT (public.can_edit_client(_client) OR public.has_role(auth.uid(),'accountant')) THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO c FROM public.clients WHERE id = _client;
  IF c.contract_total IS NULL OR c.contract_total <= 0 THEN RETURN 0; END IF;
  IF c.contract_kind = 'retainer' THEN
    UPDATE public.client_installments SET amount = c.contract_total, agreement_total = c.contract_total, currency = c.currency
      WHERE client_id = _client AND paid = false AND total_count = 0;
    RETURN public._ensure_retainer(_client);
  END IF;
  IF c.status <> 'active' THEN RETURN 0; END IF;
  IF EXISTS (SELECT 1 FROM public.client_installments WHERE client_id = _client AND quote_id IS NOT NULL) THEN RETURN 0; END IF;
  IF EXISTS (SELECT 1 FROM public.client_installments WHERE client_id = _client AND paid) THEN RETURN 0; END IF;
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
END $function$;

CREATE OR REPLACE FUNCTION public.installment_invoice()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE c record;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT project_name, payment_method INTO c FROM public.clients WHERE id = NEW.client_id;
    INSERT INTO public.invoices(client_id, installment_id, description, amount, currency, issue_date, due_date, status, paid_at)
    VALUES (NEW.client_id, NEW.id,
      CASE WHEN NEW.is_advance THEN format('دفعة مقدمة — %s', c.project_name)
           WHEN NEW.total_count = 0 THEN format('أتعاب الإدارة والتسويق — %s — الدورة %s %s', c.project_name, CASE WHEN c.payment_method = 'weekly' THEN 'الأسبوعية' ELSE 'الشهرية' END, NEW.number)
           ELSE format('أتعاب الإدارة والتسويق — %s — الدفعة %s من %s', c.project_name, NEW.number, NEW.total_count) END,
      NEW.amount, NEW.currency, current_date, NEW.due_date, CASE WHEN NEW.paid THEN 'paid' ELSE 'pending' END, NEW.paid_at);
  ELSE
    UPDATE public.invoices SET status = CASE WHEN NEW.paid THEN 'paid' ELSE 'pending' END, paid_at = NEW.paid_at,
      payment_method = NEW.payment_method, due_date = NEW.due_date, amount = NEW.amount WHERE installment_id = NEW.id;
    IF NEW.paid AND NOT OLD.paid AND NEW.total_count = 0 THEN PERFORM public._ensure_retainer(NEW.client_id); END IF;
  END IF;
  RETURN NEW;
END $function$;