-- 1. Override por produto
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS pdp_badge_override jsonb;

COMMENT ON COLUMN public.products.pdp_badge_override IS
  'Override do Badge da PDP para este produto. Quando enabled=true, sobrescreve a configuração global. Estrutura: { enabled, label, tone, showIcon, position, offsetX, offsetY }';

-- 2. Tabela de eventos do badge
CREATE TABLE IF NOT EXISTS public.pdp_badge_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name text NOT NULL CHECK (event_name IN ('impression','click')),
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  product_slug text,
  badge_label text,
  tone text,
  position text,
  source text NOT NULL DEFAULT 'global' CHECK (source IN ('global','product_override')),
  session_id text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pdp_badge_events_event_created
  ON public.pdp_badge_events (event_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pdp_badge_events_product_created
  ON public.pdp_badge_events (product_id, created_at DESC);

ALTER TABLE public.pdp_badge_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can insert badge events" ON public.pdp_badge_events;
CREATE POLICY "Anyone can insert badge events"
  ON public.pdp_badge_events
  FOR INSERT
  WITH CHECK (event_name IN ('impression','click'));

DROP POLICY IF EXISTS "Admins can read badge events" ON public.pdp_badge_events;
CREATE POLICY "Admins can read badge events"
  ON public.pdp_badge_events
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 3. Limpeza automática (>180 dias)
CREATE OR REPLACE FUNCTION public.cleanup_pdp_badge_events()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.pdp_badge_events
   WHERE created_at < now() - interval '180 days';
END;
$$;

-- 4. Estatísticas (admin-only)
CREATE OR REPLACE FUNCTION public.pdp_badge_stats(
  _from timestamptz DEFAULT (now() - interval '30 days'),
  _to   timestamptz DEFAULT now()
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_impressions int;
  v_clicks int;
  v_top_products jsonb;
  v_by_tone jsonb;
  v_by_position jsonb;
  v_by_source jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT count(*)::int INTO v_impressions
    FROM public.pdp_badge_events
   WHERE event_name = 'impression' AND created_at >= _from AND created_at <= _to;

  SELECT count(*)::int INTO v_clicks
    FROM public.pdp_badge_events
   WHERE event_name = 'click' AND created_at >= _from AND created_at <= _to;

  SELECT coalesce(jsonb_agg(row_to_json(p)), '[]'::jsonb) INTO v_top_products
  FROM (
    SELECT product_slug,
           count(*) FILTER (WHERE event_name='impression')::int AS impressions,
           count(*) FILTER (WHERE event_name='click')::int      AS clicks
      FROM public.pdp_badge_events
     WHERE product_slug IS NOT NULL
       AND created_at >= _from AND created_at <= _to
     GROUP BY product_slug
     ORDER BY count(*) FILTER (WHERE event_name='click') DESC, count(*) DESC
     LIMIT 10
  ) p;

  SELECT coalesce(jsonb_object_agg(tone, c), '{}'::jsonb) INTO v_by_tone
  FROM (
    SELECT coalesce(tone,'(none)') AS tone, count(*)::int AS c
      FROM public.pdp_badge_events
     WHERE event_name = 'click' AND created_at >= _from AND created_at <= _to
     GROUP BY tone
  ) t;

  SELECT coalesce(jsonb_object_agg(position, c), '{}'::jsonb) INTO v_by_position
  FROM (
    SELECT coalesce(position,'(none)') AS position, count(*)::int AS c
      FROM public.pdp_badge_events
     WHERE event_name = 'click' AND created_at >= _from AND created_at <= _to
     GROUP BY position
  ) t;

  SELECT coalesce(jsonb_object_agg(source, c), '{}'::jsonb) INTO v_by_source
  FROM (
    SELECT source, count(*)::int AS c
      FROM public.pdp_badge_events
     WHERE event_name = 'click' AND created_at >= _from AND created_at <= _to
     GROUP BY source
  ) t;

  RETURN jsonb_build_object(
    'from', _from,
    'to', _to,
    'impressions', v_impressions,
    'clicks', v_clicks,
    'ctr', CASE WHEN v_impressions > 0 THEN round((v_clicks::numeric / v_impressions::numeric) * 100, 2) ELSE 0 END,
    'top_products', v_top_products,
    'by_tone', v_by_tone,
    'by_position', v_by_position,
    'by_source', v_by_source
  );
END;
$$;