
-- =========================================================
-- 1) profile_change_audit
-- =========================================================
CREATE TABLE IF NOT EXISTS public.profile_change_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  field text NOT NULL,
  old_value text,
  new_value text,
  changed_by uuid,
  changed_by_email text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_profile_change_audit_user ON public.profile_change_audit(user_id, created_at DESC);
ALTER TABLE public.profile_change_audit ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin reads profile_change_audit" ON public.profile_change_audit;
CREATE POLICY "admin reads profile_change_audit" ON public.profile_change_audit
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- =========================================================
-- 2) contact_migration_audit
-- =========================================================
CREATE TABLE IF NOT EXISTS public.contact_migration_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_kind text NOT NULL,            -- 'visitor' | 'contact' | 'auth' | 'order'
  source_id text,
  target_customer_id uuid,
  target_email text,
  target_whatsapp text,
  status text NOT NULL,                 -- 'success' | 'linked' | 'error'
  message text,
  performed_by uuid,
  performed_by_email text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_contact_migration_audit_created ON public.contact_migration_audit(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contact_migration_audit_email   ON public.contact_migration_audit(lower(target_email));
ALTER TABLE public.contact_migration_audit ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin reads contact_migration_audit" ON public.contact_migration_audit;
CREATE POLICY "admin reads contact_migration_audit" ON public.contact_migration_audit
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "admin inserts contact_migration_audit" ON public.contact_migration_audit;
CREATE POLICY "admin inserts contact_migration_audit" ON public.contact_migration_audit
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));

-- =========================================================
-- 3) update_user_profile -> agora audita
-- =========================================================
CREATE OR REPLACE FUNCTION public.update_user_profile(_user_id uuid, _full_name text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_caller uuid := auth.uid();
  v_caller_email text;
  v_name   text := nullif(trim(coalesce(_full_name,'')), '');
  v_old    text;
BEGIN
  IF v_caller IS NULL OR NOT public.has_role(v_caller, 'admin') THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';
  END IF;
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'user_id obrigatório' USING ERRCODE='23502';
  END IF;
  IF v_name IS NULL THEN
    RAISE EXCEPTION 'Nome não pode ficar vazio' USING ERRCODE='23514';
  END IF;
  IF length(v_name) > 200 THEN
    RAISE EXCEPTION 'Nome muito longo' USING ERRCODE='23514';
  END IF;

  SELECT full_name INTO v_old FROM public.profiles WHERE id = _user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perfil não encontrado' USING ERRCODE='23503';
  END IF;

  UPDATE public.profiles
     SET full_name = v_name, updated_at = now()
   WHERE id = _user_id;

  IF coalesce(v_old,'') IS DISTINCT FROM v_name THEN
    SELECT email INTO v_caller_email FROM public.profiles WHERE id = v_caller;
    INSERT INTO public.profile_change_audit (user_id, field, old_value, new_value, changed_by, changed_by_email)
    VALUES (_user_id, 'full_name', v_old, v_name, v_caller, v_caller_email);
  END IF;

  RETURN jsonb_build_object('success', true, 'user_id', _user_id, 'full_name', v_name);
END
$function$;

-- =========================================================
-- 4) migrate_visitor_to_customer -> agora audita
-- =========================================================
CREATE OR REPLACE FUNCTION public.migrate_visitor_to_customer(_visitor_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_caller uuid := auth.uid();
  v_caller_email text;
  v record;
  v_existing uuid;
  v_new_id uuid;
  v_name text;
  v_notes text;
BEGIN
  IF v_caller IS NULL OR NOT public.has_role(v_caller,'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  SELECT email INTO v_caller_email FROM public.profiles WHERE id = v_caller;

  SELECT * INTO v FROM public.visitors WHERE id = _visitor_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'visitor não encontrado'; END IF;

  IF coalesce(trim(v.whatsapp_phone),'') <> '' THEN
    SELECT id INTO v_existing FROM public.customers
      WHERE regexp_replace(coalesce(whatsapp,''),'\D','','g')
          = regexp_replace(v.whatsapp_phone,'\D','','g')
      LIMIT 1;
  END IF;

  IF v_existing IS NOT NULL THEN
    UPDATE public.visitors SET customer_id = v_existing WHERE id = _visitor_id;
    INSERT INTO public.contact_migration_audit
      (source_kind, source_id, target_customer_id, target_whatsapp, status, message, performed_by, performed_by_email)
    VALUES ('visitor', _visitor_id::text, v_existing, v.whatsapp_phone, 'linked',
            'Visitante vinculado a cliente existente', v_caller, v_caller_email);
    RETURN jsonb_build_object('success',true,'customer_id',v_existing,'created',false);
  END IF;

  v_name := coalesce(nullif(trim(v.whatsapp_phone),''), 'Visitante ' || left(v.id::text,8));
  v_notes := concat_ws(E'\n',
    'Migrado de visitante ' || v.id,
    CASE WHEN v.ip IS NOT NULL THEN 'IP: ' || host(v.ip) END,
    CASE WHEN v.ip_city IS NOT NULL THEN 'Origem IP: '||v.ip_city||'/'||coalesce(v.ip_region,'')||' '||coalesce(v.ip_country,'') END
  );

  INSERT INTO public.customers (name, whatsapp, city, state, source, status, notes, created_by)
  VALUES (v_name, v.whatsapp_phone, v.ip_city, v.ip_region, 'visitante', 'lead', v_notes, v_caller)
  RETURNING id INTO v_new_id;

  UPDATE public.visitors SET customer_id = v_new_id WHERE id = _visitor_id;

  INSERT INTO public.contact_migration_audit
    (source_kind, source_id, target_customer_id, target_whatsapp, status, message, performed_by, performed_by_email)
  VALUES ('visitor', _visitor_id::text, v_new_id, v.whatsapp_phone, 'success',
          'Cliente criado a partir de visitante', v_caller, v_caller_email);

  RETURN jsonb_build_object('success',true,'customer_id',v_new_id,'created',true);
END $function$;

-- =========================================================
-- 5) users_source_counts (contadores)
-- =========================================================
CREATE OR REPLACE FUNCTION public.users_source_counts()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_auth bigint;
  v_customer bigint;
  v_visitor bigint;
  v_order bigint;
  v_admin bigint;
  v_editor bigint;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  SELECT count(*) INTO v_auth     FROM public.profiles;
  SELECT count(*) INTO v_customer FROM public.customers;
  SELECT count(*) INTO v_visitor  FROM public.visitors WHERE customer_id IS NULL;
  SELECT count(DISTINCT lower(customer_email)) INTO v_order FROM public.orders WHERE customer_email IS NOT NULL;
  SELECT count(*) INTO v_admin  FROM public.user_roles WHERE role='admin';
  SELECT count(*) INTO v_editor FROM public.user_roles WHERE role='editor';
  RETURN jsonb_build_object(
    'auth', v_auth, 'customer', v_customer, 'visitor', v_visitor, 'order', v_order,
    'admin', v_admin, 'editor', v_editor
  );
END $function$;

-- =========================================================
-- 6) list_contact_migration_audit (com filtros)
-- =========================================================
CREATE OR REPLACE FUNCTION public.list_contact_migration_audit(
  _search text DEFAULT NULL,
  _status text DEFAULT NULL,
  _kind   text DEFAULT NULL,
  _limit  int  DEFAULT 100,
  _offset int  DEFAULT 0
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_search text := nullif(trim(coalesce(_search,'')),'');
  v_status text := nullif(_status,'all');
  v_kind   text := nullif(_kind,'all');
  v_total  bigint;
  v_rows   jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _limit IS NULL OR _limit <= 0 OR _limit > 500 THEN _limit := 100; END IF;
  IF _offset IS NULL OR _offset < 0 THEN _offset := 0; END IF;

  WITH base AS (
    SELECT * FROM public.contact_migration_audit a
     WHERE (v_status IS NULL OR a.status = v_status)
       AND (v_kind   IS NULL OR a.source_kind = v_kind)
       AND (v_search IS NULL OR
            lower(coalesce(a.target_email,''))   LIKE '%'||lower(v_search)||'%' OR
            lower(coalesce(a.target_whatsapp,'')) LIKE '%'||lower(v_search)||'%' OR
            lower(coalesce(a.message,''))        LIKE '%'||lower(v_search)||'%' OR
            lower(coalesce(a.performed_by_email,'')) LIKE '%'||lower(v_search)||'%')
  )
  SELECT count(*) INTO v_total FROM base;

  SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC), '[]'::jsonb)
    INTO v_rows
    FROM (SELECT * FROM base ORDER BY created_at DESC LIMIT _limit OFFSET _offset) x;

  RETURN jsonb_build_object('total', v_total, 'rows', v_rows);
END $function$;
