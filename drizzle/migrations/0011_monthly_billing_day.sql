ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS billing_day integer CHECK (billing_day BETWEEN 1 AND 31);

CREATE OR REPLACE FUNCTION public._day_in_month(_d date, _day int)
 RETURNS date LANGUAGE sql IMMUTABLE SET search_path TO 'public'
AS $$ SELECT make_date(extract(year FROM _d)::int, extract(month FROM _d)::int,
  LEAST(_day, extract(day FROM (date_trunc('month', _d) + interval '1 month - 1 day'))::int)) $$;

CREATE OR REPLACE FUNCTION public._add_retainer_cycle(_client uuid, _force boolean)
 RETURNS date LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE c record; stepd int; last date; nxt date; num int; k int; amt numeric; fixed boolean;
BEGIN
  SELECT * INTO c FROM public.clients WHERE id = _client;
  IF c.contract_kind <> 'retainer' OR c.contract_total IS NULL OR c.contract_total <= 0 THEN RETURN NULL; END IF;
  stepd := CASE WHEN c.payment_method = 'weekly' THEN 7 ELSE 30 END;
  fixed := c.payment_method <> 'weekly' AND c.billing_day IS NOT NULL;
  amt := round(c.contract_total / GREATEST(COALESCE(c.installments_count,1),1), 2);
  SELECT max(due_date), COALESCE(max(number),0) INTO last, num FROM public.client_installments WHERE client_id = _client;
  IF fixed THEN
    IF last IS NULL THEN
      nxt := public._day_in_month(COALESCE(c.work_start_date, current_date), c.billing_day);
      IF nxt <= COALESCE(c.work_start_date, current_date) THEN nxt := public._day_in_month((date_trunc('month', nxt) + interval '1 month')::date, c.billing_day); END IF;
    ELSE
      nxt := public._day_in_month((date_trunc('month', last) + interval '1 month')::date, c.billing_day);
    END IF;
    IF NOT _force AND nxt < current_date - 30 THEN
      nxt := public._day_in_month(current_date, c.billing_day);
      IF last IS NOT NULL AND nxt <= last THEN nxt := public._day_in_month((date_trunc('month', last) + interval '1 month')::date, c.billing_day); END IF;
    END IF;
  ELSIF last IS NULL THEN
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
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE c record; r record; prev date := NULL;
BEGIN
  SELECT * INTO c FROM public.clients WHERE id = _client;
  IF c.contract_kind <> 'retainer' OR COALESCE(c.contract_total,0) <= 0 THEN RETURN; END IF;
  UPDATE public.client_installments
     SET amount = round(c.contract_total / GREATEST(COALESCE(c.installments_count,1),1), 2),
         agreement_total = c.contract_total, currency = c.currency
   WHERE client_id = _client AND paid = false AND total_count = 0;
  IF c.payment_method <> 'weekly' AND c.billing_day IS NOT NULL THEN
    FOR r IN SELECT id, due_date FROM public.client_installments WHERE client_id = _client AND paid = false AND total_count = 0 ORDER BY due_date LOOP
      IF prev IS NULL THEN prev := public._day_in_month(r.due_date, c.billing_day);
      ELSE prev := public._day_in_month((date_trunc('month', prev) + interval '1 month')::date, c.billing_day); END IF;
      UPDATE public.client_installments SET due_date = prev WHERE id = r.id;
    END LOOP;
  END IF;
END $$;
REVOKE EXECUTE ON FUNCTION public._sync_retainer_amounts(uuid) FROM PUBLIC, anon, authenticated;