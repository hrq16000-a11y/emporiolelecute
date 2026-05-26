
-- =========================================================
-- 1. Linkagem automática visitor -> customer por WhatsApp
-- =========================================================
CREATE OR REPLACE FUNCTION public.normalize_phone_digits(_v text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $$
  SELECT NULLIF(regexp_replace(coalesce(_v,''), '\D', '', 'g'), '')
$$;

CREATE OR REPLACE FUNCTION public.link_visitor_to_customer()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_digits text;
  v_cid uuid;
BEGIN
  IF NEW.customer_id IS NOT NULL THEN RETURN NEW; END IF;
  v_digits := public.normalize_phone_digits(NEW.whatsapp_phone);
  IF v_digits IS NULL OR length(v_digits) < 8 THEN RETURN NEW; END IF;

  SELECT id INTO v_cid FROM public.customers
   WHERE public.normalize_phone_digits(whatsapp) = v_digits
      OR public.normalize_phone_digits(phone)    = v_digits
   ORDER BY created_at ASC LIMIT 1;

  IF v_cid IS NOT NULL THEN NEW.customer_id := v_cid; END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_link_visitor_to_customer ON public.visitors;
CREATE TRIGGER trg_link_visitor_to_customer
  BEFORE INSERT OR UPDATE OF whatsapp_phone ON public.visitors
  FOR EACH ROW EXECUTE FUNCTION public.link_visitor_to_customer();

-- Backfill: tenta vincular visitantes existentes sem customer_id.
UPDATE public.visitors v
   SET customer_id = c.id
  FROM public.customers c
 WHERE v.customer_id IS NULL
   AND v.whatsapp_phone IS NOT NULL
   AND (
        public.normalize_phone_digits(c.whatsapp) = public.normalize_phone_digits(v.whatsapp_phone)
     OR public.normalize_phone_digits(c.phone)    = public.normalize_phone_digits(v.whatsapp_phone)
   );

-- =========================================================
-- 2. RPC: perfil unificado (visitor | customer | user)
-- =========================================================
CREATE OR REPLACE FUNCTION public.get_unified_profile(_kind text, _id text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_customer  public.customers%ROWTYPE;
  v_user_email text;
  v_visitor_ids text[] := '{}';
  v_primary   public.visitors%ROWTYPE;
  v_agg       record;
  v_kind      text := lower(coalesce(_kind,''));
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _id IS NULL OR length(_id) = 0 THEN
    RAISE EXCEPTION 'missing_id';
  END IF;

  -- Resolver alvo: descobrir customer + visitor_ids associados.
  IF v_kind = 'user' THEN
    SELECT email INTO v_user_email FROM auth.users WHERE id = _id::uuid;
    IF v_user_email IS NOT NULL THEN
      SELECT * INTO v_customer FROM public.customers WHERE lower(email) = lower(v_user_email) LIMIT 1;
    END IF;
  ELSIF v_kind = 'customer' THEN
    SELECT * INTO v_customer FROM public.customers WHERE id = _id::uuid;
  ELSIF v_kind = 'visitor' THEN
    SELECT * INTO v_primary FROM public.visitors WHERE visitor_id = _id LIMIT 1;
    IF v_primary.customer_id IS NOT NULL THEN
      SELECT * INTO v_customer FROM public.customers WHERE id = v_primary.customer_id;
    END IF;
  ELSE
    RAISE EXCEPTION 'invalid_kind';
  END IF;

  -- Coletar TODOS os visitor_ids associados (mata a "amnésia").
  IF v_customer.id IS NOT NULL THEN
    SELECT coalesce(array_agg(visitor_id ORDER BY last_seen_at DESC), '{}')
      INTO v_visitor_ids
      FROM public.visitors WHERE customer_id = v_customer.id;
  END IF;
  IF v_kind = 'visitor' AND NOT (_id = ANY(v_visitor_ids)) THEN
    v_visitor_ids := array_append(v_visitor_ids, _id);
  END IF;

  -- Visitante "primário" (mais recente) para herdar infra/origem.
  IF v_primary.id IS NULL AND array_length(v_visitor_ids,1) > 0 THEN
    SELECT * INTO v_primary FROM public.visitors
     WHERE visitor_id = ANY(v_visitor_ids)
     ORDER BY last_seen_at DESC NULLS LAST LIMIT 1;
  END IF;

  -- Agregados de telemetria somando TODOS os visitor_ids.
  SELECT coalesce(sum(total_pageviews),0)     AS pv,
         coalesce(sum(total_sessions),0)      AS sess,
         coalesce(sum(total_time_seconds),0)  AS tt,
         min(first_seen_at)                   AS first_seen,
         max(last_seen_at)                    AS last_seen
    INTO v_agg
    FROM public.visitors WHERE visitor_id = ANY(v_visitor_ids);

  RETURN jsonb_build_object(
    'kind', v_kind,
    'id', _id,
    'visitor_ids', to_jsonb(v_visitor_ids),
    'identity', jsonb_build_object(
      'name',     coalesce(v_customer.name, NULL),
      'email',    coalesce(v_customer.email, v_user_email),
      'whatsapp', coalesce(v_customer.whatsapp, v_primary.whatsapp_phone),
      'phone',    v_customer.phone,
      'customer_id', v_customer.id,
      'is_bot',   v_primary.is_bot,
      'bot_name', v_primary.bot_name,
      'lead_status', v_primary.lead_status,
      'lead_trigger', v_primary.lead_trigger,
      'lead_promoted_at', v_primary.lead_promoted_at,
      'tags', v_customer.tags,
      'status', v_customer.status
    ),
    'infra', jsonb_build_object(
      'ip', v_primary.ip,
      'ip_country', v_primary.ip_country,
      'ip_region',  v_primary.ip_region,
      'ip_city',    v_primary.ip_city,
      'ip_isp',     v_primary.ip_isp,
      'ip_asn',     v_primary.ip_asn,
      'timezone',   coalesce(v_primary.timezone, v_primary.ip_timezone),
      'device_type',  v_primary.device_type,
      'device_brand', v_primary.device_brand,
      'device_model', v_primary.device_model,
      'os_name',      v_primary.os_name,
      'os_version',   v_primary.os_version,
      'browser_name', v_primary.browser_name,
      'browser_version', v_primary.browser_version,
      'language',  v_primary.language,
      'screen_w',  v_primary.screen_w,
      'screen_h',  v_primary.screen_h,
      'lat', coalesce(v_primary.gps_lat, v_primary.ip_lat),
      'lon', coalesce(v_primary.gps_lon, v_primary.ip_lon),
      'gps_accuracy', v_primary.gps_accuracy
    ),
    'commerce', jsonb_build_object(
      'first_referrer',     v_primary.first_referrer,
      'first_landing_path', v_primary.first_landing_path,
      'utm_source',   v_primary.utm_source,
      'utm_medium',   v_primary.utm_medium,
      'utm_campaign', v_primary.utm_campaign,
      'utm_term',     v_primary.utm_term,
      'utm_content',  v_primary.utm_content,
      'source',       v_customer.source,
      'notes',        v_customer.notes
    ),
    'aggregates', jsonb_build_object(
      'total_pageviews',     v_agg.pv,
      'total_sessions',      v_agg.sess,
      'total_time_seconds',  v_agg.tt,
      'first_seen_at',       v_agg.first_seen,
      'last_seen_at',        v_agg.last_seen
    )
  );
END $$;

GRANT EXECUTE ON FUNCTION public.get_unified_profile(text, text) TO authenticated;

-- =========================================================
-- 3. RPC: timeline unificada (vários visitor_ids)
-- =========================================================
CREATE OR REPLACE FUNCTION public.get_unified_timeline(_visitor_ids text[], _limit int DEFAULT 500)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_rows jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _visitor_ids IS NULL OR array_length(_visitor_ids,1) IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;
  IF _limit IS NULL OR _limit <= 0 OR _limit > 2000 THEN _limit := 500; END IF;

  SELECT coalesce(jsonb_agg(row_to_json(t) ORDER BY t.visitor_id, t.step_index NULLS LAST, t.viewed_at), '[]'::jsonb)
    INTO v_rows
    FROM (
      SELECT id, visitor_id, session_id, path, title, referrer,
             step_index, from_path, cta_id, event_type,
             time_on_page_seconds, scroll_depth_pct, viewed_at
        FROM public.visitor_pageviews
       WHERE visitor_id = ANY(_visitor_ids)
       ORDER BY visitor_id, step_index NULLS LAST, viewed_at
       LIMIT _limit
    ) t;

  RETURN v_rows;
END $$;

GRANT EXECUTE ON FUNCTION public.get_unified_timeline(text[], int) TO authenticated;

-- =========================================================
-- 4. Guard idempotência em mark_visitor_as_lead (30s)
-- =========================================================
CREATE OR REPLACE FUNCTION public.mark_visitor_as_lead(_visitor_id uuid, _trigger text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_row public.visitors%ROWTYPE;
BEGIN
  IF _visitor_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'missing_visitor_id');
  END IF;

  SELECT * INTO v_row FROM public.visitors WHERE visitor_id::text = _visitor_id::text;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'visitor_not_found');
  END IF;
  IF v_row.is_bot THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'bot_ignored');
  END IF;

  -- Idempotência: já é lead/customer => no-op.
  IF v_row.lead_status IN ('customer','lead') THEN
    RETURN jsonb_build_object('ok', true, 'noop', true, 'status', v_row.lead_status);
  END IF;

  -- Janela de cooldown: se foi marcado nos últimos 30s pelo mesmo trigger, no-op silencioso.
  IF v_row.lead_promoted_at IS NOT NULL
     AND v_row.lead_promoted_at > now() - interval '30 seconds'
     AND coalesce(v_row.lead_trigger,'') = coalesce(_trigger,'') THEN
    RETURN jsonb_build_object('ok', true, 'noop', true, 'reason', 'cooldown');
  END IF;

  UPDATE public.visitors
     SET lead_status = 'lead',
         lead_promoted_at = COALESCE(lead_promoted_at, now()),
         lead_trigger = COALESCE(_trigger, 'unknown')
   WHERE visitor_id::text = _visitor_id::text;

  RETURN jsonb_build_object('ok', true, 'status', 'lead', 'trigger', _trigger);
END $$;

-- =========================================================
-- 5. Índices de busca (evita full table scan)
-- =========================================================
CREATE INDEX IF NOT EXISTS idx_visitors_ip_text         ON public.visitors ((host(ip)));
CREATE INDEX IF NOT EXISTS idx_visitors_city_lower      ON public.visitors (lower(ip_city));
CREATE INDEX IF NOT EXISTS idx_visitors_country_lower   ON public.visitors (lower(ip_country));
CREATE INDEX IF NOT EXISTS idx_visitors_region_lower    ON public.visitors (lower(ip_region));
CREATE INDEX IF NOT EXISTS idx_visitors_device_model_lower ON public.visitors (lower(device_model));
CREATE INDEX IF NOT EXISTS idx_visitors_customer_id     ON public.visitors (customer_id);
CREATE INDEX IF NOT EXISTS idx_visitors_lead_status     ON public.visitors (lead_status) WHERE lead_status IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_customers_name_lower     ON public.customers (lower(name));
CREATE INDEX IF NOT EXISTS idx_customers_email_lower    ON public.customers (lower(email));
CREATE INDEX IF NOT EXISTS idx_customers_whatsapp_digits ON public.customers (public.normalize_phone_digits(whatsapp));
CREATE INDEX IF NOT EXISTS idx_customers_phone_digits   ON public.customers (public.normalize_phone_digits(phone));
CREATE INDEX IF NOT EXISTS idx_customers_city_lower     ON public.customers (lower(city));

CREATE INDEX IF NOT EXISTS idx_visitor_pageviews_visitor_step ON public.visitor_pageviews (visitor_id, step_index);
