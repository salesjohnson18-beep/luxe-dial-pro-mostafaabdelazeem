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