-- =========================================================
-- FASE 1 — Schema, RPCs atômicas, RPC de usuários e backfill
-- =========================================================

ALTER TABLE public.visitors
  ADD COLUMN IF NOT EXISTS is_bot            boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS bot_name          text,
  ADD COLUMN IF NOT EXISTS lead_status       text        NOT NULL DEFAULT 'visitor',
  ADD COLUMN IF NOT EXISTS lead_promoted_at  timestamptz,
  ADD COLUMN IF NOT EXISTS lead_trigger      text;

ALTER TABLE public.visitors DROP CONSTRAINT IF EXISTS visitors_lead_status_chk;
ALTER TABLE public.visitors
  ADD CONSTRAINT visitors_lead_status_chk
  CHECK (lead_status IN ('visitor','lead','customer','bot'));

CREATE INDEX IF NOT EXISTS visitors_human_last_seen_idx
  ON public.visitors (last_seen_at DESC) WHERE is_bot = false;
CREATE INDEX IF NOT EXISTS visitors_lead_status_idx
  ON public.visitors (lead_status) WHERE is_bot = false;
CREATE INDEX IF NOT EXISTS visitors_is_bot_idx
  ON public.visitors (is_bot);

ALTER TABLE public.visitor_pageviews
  ADD COLUMN IF NOT EXISTS step_index   int,
  ADD COLUMN IF NOT EXISTS from_path    text,
  ADD COLUMN IF NOT EXISTS cta_id       text,
  ADD COLUMN IF NOT EXISTS event_type   text NOT NULL DEFAULT 'pageview';

CREATE INDEX IF NOT EXISTS visitor_pageviews_step_idx
  ON public.visitor_pageviews (visitor_id, step_index);

-- =========================================================
-- RPC: track_pageview
-- =========================================================
CREATE OR REPLACE FUNCTION public.track_pageview(
  _visitor_id    text,
  _session_id    uuid,
  _path          text,
  _title         text,
  _product_slug  text,
  _referrer      text,
  _from_path     text DEFAULT NULL,
  _cta_id        text DEFAULT NULL,
  _event_type    text DEFAULT 'pageview'
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_product_id uuid;
  v_step       int;
  v_id         uuid;
BEGIN
  IF _visitor_id IS NULL OR length(_visitor_id) = 0 OR length(_visitor_id) > 64 THEN
    RAISE EXCEPTION 'invalid_visitor_id';
  END IF;
  IF _path IS NULL OR length(_path) = 0 THEN
    RAISE EXCEPTION 'invalid_path';
  END IF;

  IF _product_slug IS NOT NULL AND length(_product_slug) > 0 THEN
    SELECT id INTO v_product_id FROM public.products WHERE slug = _product_slug LIMIT 1;
  END IF;

  SELECT coalesce(max(step_index), 0) + 1
    INTO v_step
    FROM public.visitor_pageviews
   WHERE visitor_id = _visitor_id;

  INSERT INTO public.visitor_pageviews(
    visitor_id, session_id, path, title, product_id, referrer,
    step_index, from_path, cta_id, event_type
  ) VALUES (
    _visitor_id, _session_id,
    left(_path, 500),
    left(coalesce(_title,''), 300),
    v_product_id,
    left(coalesce(_referrer,''), 500),
    v_step,
    left(coalesce(_from_path,''), 500),
    left(coalesce(_cta_id,''), 120),
    coalesce(nullif(_event_type,''), 'pageview')
  )
  RETURNING id INTO v_id;

  UPDATE public.visitors
     SET total_pageviews = total_pageviews + 1,
         last_seen_at    = now()
   WHERE visitor_id = _visitor_id;

  RETURN v_id;
END;
$$;

-- =========================================================
-- RPC: track_heartbeat (INCREMENTO)
-- =========================================================
CREATE OR REPLACE FUNCTION public.track_heartbeat(
  _visitor_id    text,
  _pageview_id   uuid,
  _delta_seconds int,
  _scroll_depth  int
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_delta  int := greatest(0, least(coalesce(_delta_seconds, 0), 3600));
  v_scroll int := CASE
    WHEN _scroll_depth IS NULL THEN NULL
    ELSE greatest(0, least(_scroll_depth, 100))
  END;
  v_pv_id  uuid := _pageview_id;
BEGIN
  IF _visitor_id IS NULL OR length(_visitor_id) = 0 THEN
    RAISE EXCEPTION 'invalid_visitor_id';
  END IF;
  IF v_delta = 0 THEN RETURN; END IF;

  IF v_pv_id IS NULL THEN
    SELECT id INTO v_pv_id
      FROM public.visitor_pageviews
     WHERE visitor_id = _visitor_id
     ORDER BY viewed_at DESC
     LIMIT 1;
  END IF;

  IF v_pv_id IS NOT NULL THEN
    UPDATE public.visitor_pageviews
       SET time_on_page_seconds = least(time_on_page_seconds + v_delta, 86400),
           scroll_depth_pct     = greatest(coalesce(scroll_depth_pct, 0), coalesce(v_scroll, 0))
     WHERE id = v_pv_id;
  END IF;

  UPDATE public.visitors
     SET total_time_seconds = total_time_seconds + v_delta,
         last_seen_at       = now()
   WHERE visitor_id = _visitor_id;
END;
$$;

-- =========================================================
-- RPC: list_all_users_paginated (só staff + customers)
-- =========================================================
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
VOLATILE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_caller uuid := auth.uid();
  v_search text := nullif(trim(coalesce(_search,'')), '');
  v_role   text := nullif(_role,'all');
  v_src    text := nullif(_source,'all');
  v_wa     text := nullif(regexp_replace(coalesce(_whatsapp,''),'\D','','g'), '');
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
    WHEN 'last_sign_in_at'    THEN 'last_sign_in_at'
    WHEN 'email'              THEN 'lower(coalesce(email,''''))'
    WHEN 'full_name'          THEN 'lower(coalesce(full_name,''''))'
    WHEN 'source'             THEN 'source'
    WHEN 'role'               THEN 'role_rank'
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
    SELECT 'customer'::text, ('customer:'||c.id::text),
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
  combined AS (
    SELECT * FROM auth_src
    UNION ALL SELECT * FROM cust_src
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

-- =========================================================
-- BACKFILL — bots e leads
-- =========================================================
UPDATE public.visitors
   SET is_bot   = true,
       bot_name = lower(coalesce(
         substring(user_agent FROM '([A-Za-z0-9_\-]+[Bb]ot)'),
         substring(user_agent FROM '([A-Za-z0-9_\-]+[Cc]rawler)'),
         substring(user_agent FROM '([A-Za-z0-9_\-]+[Ss]pider)'),
         'bot'
       )),
       lead_status = 'bot'
 WHERE coalesce(user_agent, '') ~* '(bot|crawl|spider|slurp|bingbot|googlebot|amazonbot|gptbot|claudebot|perplexitybot|ahrefs|semrush|mj12bot|yandexbot|baiduspider|facebookexternalhit|twitterbot|whatsapp|telegram|headlesschrome|phantomjs|puppeteer|playwright|duckduckbot|applebot|petalbot|seznambot|chrome-lighthouse)';

UPDATE public.visitors
   SET lead_status = 'customer'
 WHERE customer_id IS NOT NULL
   AND is_bot = false
   AND lead_status <> 'customer';

UPDATE public.visitors
   SET lead_status = 'visitor'
 WHERE is_bot = false
   AND customer_id IS NULL
   AND lead_status NOT IN ('visitor','lead');