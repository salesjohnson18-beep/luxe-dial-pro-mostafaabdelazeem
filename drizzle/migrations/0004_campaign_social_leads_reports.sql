ALTER TABLE public.campaign_entries ADD COLUMN leads integer NOT NULL DEFAULT 0;
ALTER TABLE public.campaign_entries ADD CONSTRAINT campaign_social_leads_valid CHECK (leads >= 0 AND (platform IN ('Meta', 'Snapchat', 'TikTok', 'Twitter/X') OR leads = 0));
COMMENT ON COLUMN public.campaign_entries.leads IS 'Messages or leads for social platforms only; Google Ads remains zero.';
CREATE OR REPLACE FUNCTION public.get_shared_report(_token text, _from date, _to date)
RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE c record;
BEGIN
 SELECT id, client_name, project_name, currency INTO c FROM public.clients WHERE share_token = _token;
 IF NOT FOUND THEN RETURN NULL; END IF;
 RETURN json_build_object(
 'client_name', c.client_name, 'project_name', c.project_name, 'currency', c.currency,
 'entries', COALESCE((SELECT json_agg(json_build_object('entry_date',entry_date,'platform',platform,'spend',spend,'clicks',clicks,'impressions',impressions,'purchases',purchases,'revenue',revenue,'leads',leads)) FROM public.campaign_entries WHERE client_id = c.id AND entry_date BETWEEN _from AND _to), '[]'::json));
END $function$;
REVOKE ALL ON FUNCTION public.get_shared_report(text,date,date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_shared_report(text,date,date) TO anon, authenticated, service_role;