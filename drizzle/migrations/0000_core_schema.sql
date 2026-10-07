CREATE TYPE public.app_role AS ENUM ('admin','media_buyer','sales','accountant');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  email text,
  full_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT, INSERT, DELETE ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;
CREATE OR REPLACE FUNCTION public.has_any_role(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id)
$$;

CREATE POLICY "own profile or admin read" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());

CREATE POLICY "read own roles or admin" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin insert roles" ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin delete roles" ON public.user_roles FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin') AND user_id <> auth.uid());

-- Called after sign-in: creates profile; first user ever becomes admin
CREATE OR REPLACE FUNCTION public.bootstrap_user()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); em text;
BEGIN
  IF uid IS NULL THEN RETURN NULL; END IF;
  SELECT email INTO em FROM auth.users WHERE id = uid;
  INSERT INTO public.profiles(id, email) VALUES (uid, em) ON CONFLICT (id) DO NOTHING;
  PERFORM pg_advisory_xact_lock(424242);
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    INSERT INTO public.user_roles(user_id, role) VALUES (uid, 'admin') ON CONFLICT DO NOTHING;
  END IF;
  RETURN 'ok';
END $$;
REVOKE ALL ON FUNCTION public.bootstrap_user() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.bootstrap_user() TO authenticated;

CREATE TABLE public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name text NOT NULL,
  project_name text NOT NULL,
  industry text,
  contract_type text NOT NULL DEFAULT 'freelance',
  transfer_cycle text NOT NULL DEFAULT 'weekly',
  phone text,
  notes text,
  assigned_to uuid,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  share_token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16),'hex'),
  enable_monthly_sheet boolean NOT NULL DEFAULT false,
  enable_pricing boolean NOT NULL DEFAULT false,
  enable_inventory boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients TO authenticated;
GRANT ALL ON public.clients TO service_role;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_edit_client(_client uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(),'admin') OR (
    public.has_role(auth.uid(),'media_buyer') AND EXISTS (
      SELECT 1 FROM public.clients c WHERE c.id = _client AND (c.assigned_to = auth.uid() OR c.created_by = auth.uid())))
$$;
CREATE OR REPLACE FUNCTION public.can_view_client(_client uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'sales') OR public.has_role(auth.uid(),'accountant')
    OR public.can_edit_client(_client)
$$;

CREATE POLICY "view clients" ON public.clients FOR SELECT TO authenticated USING (public.can_view_client(id));
CREATE POLICY "create clients" ON public.clients FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'media_buyer'));
CREATE POLICY "update clients" ON public.clients FOR UPDATE TO authenticated USING (public.can_edit_client(id));
CREATE POLICY "delete clients" ON public.clients FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.campaign_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  entry_date date NOT NULL,
  platform text NOT NULL,
  spend numeric NOT NULL DEFAULT 0,
  clicks integer NOT NULL DEFAULT 0,
  impressions integer NOT NULL DEFAULT 0,
  purchases integer NOT NULL DEFAULT 0,
  revenue numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, entry_date, platform)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaign_entries TO authenticated;
GRANT ALL ON public.campaign_entries TO service_role;
ALTER TABLE public.campaign_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view entries" ON public.campaign_entries FOR SELECT TO authenticated USING (public.can_view_client(client_id));
CREATE POLICY "insert entries" ON public.campaign_entries FOR INSERT TO authenticated WITH CHECK (public.can_edit_client(client_id));
CREATE POLICY "update entries" ON public.campaign_entries FOR UPDATE TO authenticated USING (public.can_edit_client(client_id));
CREATE POLICY "delete entries" ON public.campaign_entries FOR DELETE TO authenticated USING (public.can_edit_client(client_id));

CREATE TABLE public.store_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  entry_date date NOT NULL,
  revenue numeric NOT NULL DEFAULT 0,
  orders integer NOT NULL DEFAULT 0,
  UNIQUE (client_id, entry_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_sales TO authenticated;
GRANT ALL ON public.store_sales TO service_role;
ALTER TABLE public.store_sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view sales" ON public.store_sales FOR SELECT TO authenticated USING (public.can_view_client(client_id));
CREATE POLICY "write sales" ON public.store_sales FOR ALL TO authenticated USING (public.can_edit_client(client_id)) WITH CHECK (public.can_edit_client(client_id));

CREATE TABLE public.client_vault (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'password',
  label text NOT NULL,
  value text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_vault TO authenticated;
GRANT ALL ON public.client_vault TO service_role;
ALTER TABLE public.client_vault ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vault access" ON public.client_vault FOR ALL TO authenticated
  USING (public.can_edit_client(client_id)) WITH CHECK (public.can_edit_client(client_id));

-- Public shared report by token (no login)
CREATE OR REPLACE FUNCTION public.get_shared_report(_token text, _from date, _to date)
RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE c record;
BEGIN
  SELECT id, client_name, project_name INTO c FROM public.clients WHERE share_token = _token;
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN json_build_object(
    'client_name', c.client_name, 'project_name', c.project_name,
    'entries', COALESCE((SELECT json_agg(json_build_object('entry_date',entry_date,'platform',platform,'spend',spend,'clicks',clicks,'impressions',impressions,'purchases',purchases,'revenue',revenue))
      FROM public.campaign_entries WHERE client_id = c.id AND entry_date BETWEEN _from AND _to), '[]'::json)
  );
END $$;
GRANT EXECUTE ON FUNCTION public.get_shared_report(text, date, date) TO anon, authenticated;

-- Admin user listing
CREATE OR REPLACE FUNCTION public.list_users()
RETURNS TABLE(id uuid, email text, full_name text, roles public.app_role[], created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY SELECT p.id, p.email, p.full_name,
    COALESCE(array_agg(r.role) FILTER (WHERE r.role IS NOT NULL), '{}'), p.created_at
  FROM public.profiles p LEFT JOIN public.user_roles r ON r.user_id = p.id
  GROUP BY p.id ORDER BY p.created_at;
END $$;
GRANT EXECUTE ON FUNCTION public.list_users() TO authenticated;