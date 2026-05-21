-- ============================================================
-- list_all_users: unifica auth-users + contatos (orders/customers/visitors)
-- ============================================================
CREATE OR REPLACE FUNCTION public.list_all_users(
  _search text DEFAULT NULL,
  _role   text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_caller uuid := auth.uid();
  v_search text := nullif(trim(coalesce(_search,'')), '');
  v_role   text := nullif(_role, 'all');
  v_rows   jsonb;
BEGIN
  IF v_caller IS NULL OR NOT public.has_role(v_caller, 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  WITH
  -- 1) Usuários autenticados (têm profile em auth.users)
  auth_src AS (
    SELECT
      'auth'::text                              AS source,
      p.id::text                                AS user_id,
      p.email,
      p.full_name,
      NULL::text                                AS whatsapp,
      p.created_at,
      u.last_sign_in_at,
      u.email_confirmed_at,
      coalesce(
        (SELECT array_agg(ur.role::text ORDER BY ur.role::text)
           FROM public.user_roles ur WHERE ur.user_id = p.id),
        '{}'::text[]
      )                                         AS roles,
      (SELECT c.id FROM public.customers c
        WHERE lower(coalesce(c.email,'')) = lower(coalesce(p.email,''))
        LIMIT 1)                                AS linked_customer_id,
      0::bigint                                 AS linked_visitors
    FROM public.profiles p
    LEFT JOIN auth.users u ON u.id = p.id
  ),
  -- 2) Customers do CRM (sem login)
  cust_src AS (
    SELECT
      'customer'::text                          AS source,
      ('customer:' || c.id::text)               AS user_id,
      c.email,
      c.name                                    AS full_name,
      c.whatsapp                                AS whatsapp,
      c.created_at,
      NULL::timestamptz                         AS last_sign_in_at,
      NULL::timestamptz                         AS email_confirmed_at,
      '{}'::text[]                              AS roles,
      c.id                                      AS linked_customer_id,
      0::bigint                                 AS linked_visitors
    FROM public.customers c
    WHERE NOT EXISTS (
      SELECT 1 FROM public.profiles p
       WHERE lower(coalesce(p.email,'')) = lower(coalesce(c.email,''))
         AND coalesce(c.email,'') <> ''
    )
  ),
  -- 3) Visitantes anônimos com whatsapp (sem login e sem customer com mesmo whats)
  vis_src AS (
    SELECT
      'visitor'::text                           AS source,
      ('visitor:' || v.id::text)                AS user_id,
      NULL::text                                AS email,
      coalesce(nullif(trim(v.whatsapp_phone),''), 'Visitante ' || left(v.id::text,8)) AS full_name,
      v.whatsapp_phone                          AS whatsapp,
      v.created_at,
      NULL::timestamptz                         AS last_sign_in_at,
      NULL::timestamptz                         AS email_confirmed_at,
      '{}'::text[]                              AS roles,
      v.customer_id                             AS linked_customer_id,
      0::bigint                                 AS linked_visitors
    FROM public.visitors v
    WHERE coalesce(trim(v.whatsapp_phone),'') <> ''
      AND v.customer_id IS NULL
  ),
  -- 4) Contatos vindos de pedidos (sem login e sem customer)
  order_src AS (
    SELECT DISTINCT ON (lower(o.customer_email))
      'order'::text                             AS source,
      ('order:' || lower(o.customer_email))     AS user_id,
      o.customer_email                          AS email,
      o.customer_name                           AS full_name,
      o.customer_phone                          AS whatsapp,
      min(o.created_at) OVER (PARTITION BY lower(o.customer_email)) AS created_at,
      NULL::timestamptz                         AS last_sign_in_at,
      NULL::timestamptz                         AS email_confirmed_at,
      '{}'::text[]                              AS roles,
      NULL::uuid                                AS linked_customer_id,
      0::bigint                                 AS linked_visitors
    FROM public.orders o
    WHERE coalesce(trim(o.customer_email),'') <> ''
      AND NOT EXISTS (
        SELECT 1 FROM public.profiles p
         WHERE lower(coalesce(p.email,'')) = lower(o.customer_email)
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.customers c
         WHERE lower(coalesce(c.email,'')) = lower(o.customer_email)
      )
    ORDER BY lower(o.customer_email), o.created_at DESC
  ),
  combined AS (
    SELECT * FROM auth_src
    UNION ALL SELECT * FROM cust_src
    UNION ALL SELECT * FROM vis_src
    UNION ALL SELECT * FROM order_src
  )
  SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.created_at DESC NULLS LAST), '[]'::jsonb)
    INTO v_rows
  FROM combined t
  WHERE
    (v_search IS NULL OR
       lower(coalesce(t.email,''))     LIKE '%'||lower(v_search)||'%' OR
       lower(coalesce(t.full_name,'')) LIKE '%'||lower(v_search)||'%' OR
       lower(coalesce(t.whatsapp,''))  LIKE '%'||lower(v_search)||'%')
    AND (
      v_role IS NULL OR
      (v_role = 'none'  AND coalesce(array_length(t.roles,1),0) = 0 AND t.source = 'auth') OR
      (v_role <> 'none' AND v_role = ANY(t.roles))
    );

  RETURN jsonb_build_object('rows', v_rows);
END
$function$;

-- ============================================================
-- update_user_profile: admin pode editar nome de um perfil
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_user_profile(
  _user_id uuid,
  _full_name text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_caller uuid := auth.uid();
  v_name   text := nullif(trim(coalesce(_full_name,'')), '');
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

  UPDATE public.profiles
     SET full_name = v_name,
         updated_at = now()
   WHERE id = _user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perfil não encontrado' USING ERRCODE='23503';
  END IF;

  RETURN jsonb_build_object('success', true, 'user_id', _user_id, 'full_name', v_name);
END
$function$;
