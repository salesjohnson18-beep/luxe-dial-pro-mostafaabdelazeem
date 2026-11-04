CREATE OR REPLACE FUNCTION public._add_retainer_cycle(_client uuid, _force boolean)
 RETURNS date LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE c record; stepd int; last date; nxt date; num int; k int; amt numeric;
BEGIN
  SELECT * INTO c FROM public.clients WHERE id = _client;
  IF c.contract_kind <> 'retainer' OR c.contract_total IS NULL OR c.contract_total <= 0 THEN RETURN NULL; END IF;
  stepd := CASE WHEN c.payment_method = 'weekly' THEN 7 ELSE 30 END;
  amt := round(c.contract_total / GREATEST(COALESCE(c.installments_count,1),1), 2);
  SELECT max(due_date), COALESCE(max(number),0) INTO last, num FROM public.client_installments WHERE client_id = _client;
  IF last IS NULL THEN
    nxt := COALESCE(c.work_start_date, current_date) + stepd;
    IF nxt < current_date - stepd THEN k := (current_date - nxt) / stepd; nxt := nxt + k * stepd; END IF;
  ELSE
    nxt := last + stepd;
    IF NOT _force AND nxt < current_date - stepd THEN k := (current_date - nxt) / stepd; nxt := nxt + k * stepd; END IF;
  END IF;
  INSERT INTO public.client_installments(client_id, number, total_count, agreement_total, amount, due_date, currency)
  VALUES (_client, num + 1, 0, c.contract_total, amt, nxt, c.currency);
  RETURN nxt;
END $function$;

CREATE OR REPLACE FUNCTION public._sync_retainer_amounts(_client uuid)
 RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path TO 'public'
AS $$
  UPDATE public.client_installments i
     SET amount = round(c.contract_total / GREATEST(COALESCE(c.installments_count,1),1), 2),
         agreement_total = c.contract_total, currency = c.currency
    FROM public.clients c
   WHERE c.id = _client AND i.client_id = c.id AND i.paid = false AND i.total_count = 0
     AND c.contract_kind = 'retainer' AND COALESCE(c.contract_total,0) > 0;
$$;
REVOKE EXECUTE ON FUNCTION public._sync_retainer_amounts(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.generate_client_installments(_client uuid)
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE c record; n int; adv numeric; rest numeric; amt numeric; i int; stepd int; start date; made int := 0;
BEGIN
  IF NOT (public.can_edit_client(_client) OR public.has_role(auth.uid(),'accountant')) THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO c FROM public.clients WHERE id = _client;
  IF c.contract_total IS NULL OR c.contract_total <= 0 THEN RETURN 0; END IF;
  IF c.contract_kind = 'retainer' THEN
    PERFORM public._sync_retainer_amounts(_client);
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
    VALUES (_client, 0, n, c.contract_total, adv, start, c.currency, true);
    made := 1;
  END IF;
  FOR i IN 1..n LOOP
    amt := CASE WHEN i = n THEN rest - round(rest / n, 2) * (n - 1) ELSE round(rest / n, 2) END;
    INSERT INTO public.client_installments(client_id, number, total_count, agreement_total, amount, due_date, currency)
    VALUES (_client, i, n, c.contract_total, amt, start + stepd * i, c.currency);
    made := made + 1;
  END LOOP;
  RETURN made;
END $function$;

DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT id FROM public.clients WHERE contract_kind = 'retainer' LOOP PERFORM public._sync_retainer_amounts(r.id); END LOOP;
END $$;