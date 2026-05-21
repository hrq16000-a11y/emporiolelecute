
CREATE OR REPLACE FUNCTION public.list_all_users_paginated(
  _search   text DEFAULT NULL,
  _role     text DEFAULT NULL,
  _source   text DEFAULT NULL,
  _whatsapp text DEFAULT NULL,
  _ip       text DEFAULT NULL,
  _sort_key text DEFAULT 'created_at',
  _sort_dir text DEFAULT 'desc',
  _limit    int  DEFAULT 25,
  _offset   int  DEFAULT 0
) RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_caller uuid := auth.uid();
  v_search text := nullif(trim(coalesce(_search,'')), '');
  v_role   text := nullif(_role,'all');
  v_src    text := nullif(_source,'all');
  v_wa     text := nullif(regexp_replace(coalesce(_whatsapp,''),'\D','','g'), '');
  v_ip     text := nullif(trim(coalesce(_ip,'')), '');
  v_order  text;
  v_total  bigint;
  v_rows   jsonb;
BEGIN
  IF v_caller IS NULL OR NOT public.has_role(v_caller, 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _limit IS NULL OR _limit <= 0 OR _limit > 500 THEN _limit := 25; END IF;
  IF _offset IS NULL OR _offset < 0 THEN _offset := 0; END IF;

  v_order := CASE lower(coalesce(_sort_key,'created_at'))
    WHEN 'last_sign_in_at' THEN 'last_sign_in_at'
    WHEN 'email'           THEN 'lower(coalesce(email,''''))'
    WHEN 'full_name'       THEN 'lower(coalesce(full_name,''''))'
    WHEN 'source'          THEN 'source'
    WHEN 'role'            THEN 'role_rank'
    WHEN 'email_confirmed_at' THEN 'email_confirmed_at'
    ELSE 'created_at'
  END
  || CASE WHEN lower(coalesce(_sort_dir,'desc'))='asc'
          THEN ' ASC NULLS LAST' ELSE ' DESC NULLS LAST' END;

  DROP TABLE IF EXISTS tmp_users_pag;
  CREATE TEMP TABLE tmp_users_pag ON COMMIT DROP AS
  WITH auth_src AS (
    SELECT 'auth'::text source, p.id::text user_id,
           p.email, p.full_name,
           NULL::text whatsapp, NULL::inet last_ip,
           p.created_at, u.last_sign_in_at, u.email_confirmed_at,
           coalesce((SELECT array_agg(ur.role::text ORDER BY ur.role::text)
                       FROM public.user_roles ur WHERE ur.user_id = p.id), '{}'::text[]) roles,
           (SELECT c.id FROM public.customers c
             WHERE lower(coalesce(c.email,'')) = lower(coalesce(p.email,''))
             LIMIT 1) linked_customer_id,
           0::bigint linked_visitors
      FROM public.profiles p
      LEFT JOIN auth.users u ON u.id = p.id
  ),
  cust_src AS (
    SELECT 'customer', ('customer:'||c.id::text),
           c.email, c.name,
           c.whatsapp, NULL::inet,
           c.created_at, NULL::timestamptz, NULL::timestamptz,
           '{}'::text[],
           c.id, 0::bigint
      FROM public.customers c
      WHERE NOT EXISTS (
        SELECT 1 FROM public.profiles p
         WHERE lower(coalesce(p.email,'')) = lower(coalesce(c.email,''))
           AND coalesce(c.email,'') <> ''
      )
  ),
  vis_src AS (
    SELECT 'visitor', ('visitor:'||v.id::text),
           NULL::text,
           coalesce(nullif(trim(v.whatsapp_phone),''), 'Visitante '||left(v.id::text,8)),
           v.whatsapp_phone, v.ip,
           v.created_at, v.last_seen_at, NULL::timestamptz,
           '{}'::text[],
           v.customer_id, 0::bigint
      FROM public.visitors v
      WHERE coalesce(trim(v.whatsapp_phone),'') <> '' OR v.ip IS NOT NULL
  ),
  order_src AS (
    SELECT DISTINCT ON (lower(o.customer_email))
           'order', ('order:'||lower(o.customer_email)),
           o.customer_email, o.customer_name,
           o.customer_phone, NULL::inet,
           min(o.created_at) OVER (PARTITION BY lower(o.customer_email)),
           NULL::timestamptz, NULL::timestamptz,
           '{}'::text[], NULL::uuid, 0::bigint
      FROM public.orders o
      WHERE coalesce(trim(o.customer_email),'') <> ''
        AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE lower(coalesce(p.email,''))=lower(o.customer_email))
        AND NOT EXISTS (SELECT 1 FROM public.customers c WHERE lower(coalesce(c.email,''))=lower(o.customer_email))
      ORDER BY lower(o.customer_email), o.created_at DESC
  ),
  combined AS (
    SELECT * FROM auth_src
    UNION ALL SELECT * FROM cust_src
    UNION ALL SELECT * FROM vis_src
    UNION ALL SELECT * FROM order_src
  )
  SELECT
    t.source, t.user_id, t.email, t.full_name, t.whatsapp,
    host(t.last_ip) AS last_ip,
    t.created_at, t.last_sign_in_at, t.email_confirmed_at, t.roles,
    t.linked_customer_id, t.linked_visitors,
    (CASE WHEN 'admin' = ANY(t.roles) THEN 3
          WHEN 'editor' = ANY(t.roles) THEN 2
          WHEN coalesce(array_length(t.roles,1),0) > 0 THEN 1
          ELSE 0 END) AS role_rank
  FROM combined t
  WHERE
    (v_search IS NULL OR
       lower(coalesce(t.email,''))     LIKE '%'||lower(v_search)||'%' OR
       lower(coalesce(t.full_name,'')) LIKE '%'||lower(v_search)||'%' OR
       lower(coalesce(t.whatsapp,''))  LIKE '%'||lower(v_search)||'%')
    AND (v_src IS NULL OR t.source = v_src)
    AND (v_wa  IS NULL OR regexp_replace(coalesce(t.whatsapp,''),'\D','','g') LIKE '%'||v_wa||'%')
    AND (v_ip  IS NULL OR (t.last_ip IS NOT NULL AND host(t.last_ip) LIKE '%'||v_ip||'%'))
    AND (
      v_role IS NULL OR
      (v_role = 'none'  AND coalesce(array_length(t.roles,1),0) = 0 AND t.source = 'auth') OR
      (v_role <> 'none' AND v_role = ANY(t.roles))
    );

  SELECT count(*) INTO v_total FROM tmp_users_pag;

  EXECUTE format(
    'SELECT coalesce(jsonb_agg(to_jsonb(x) - ''role_rank''), ''[]''::jsonb)
       FROM (SELECT * FROM tmp_users_pag ORDER BY %s LIMIT $1 OFFSET $2) x',
     v_order)
  INTO v_rows USING _limit, _offset;

  RETURN jsonb_build_object('total', v_total, 'rows', v_rows);
END $function$;
