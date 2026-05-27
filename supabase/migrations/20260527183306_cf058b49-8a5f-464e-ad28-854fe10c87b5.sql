
-- 1) Remover políticas permissivas + revogar INSERT direto
DROP POLICY IF EXISTS "anyone can insert search log" ON public.search_query_log;
DROP POLICY IF EXISTS "anyone can insert funnel events" ON public.pdp_funnel_events;

REVOKE INSERT ON public.search_query_log  FROM anon, authenticated, PUBLIC;
REVOKE INSERT ON public.pdp_funnel_events FROM anon, authenticated, PUBLIC;

-- 2) RPC de busca (já existia como SECURITY DEFINER, agora com circuit-breaker)
CREATE OR REPLACE FUNCTION public.log_search(
  _q text,
  _result_count int,
  _suggestion text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_norm   text;
  v_recent int;
BEGIN
  v_norm := trim(regexp_replace(lower(public.unaccent(coalesce(_q, ''))), '\s+', ' ', 'g'));
  IF v_norm = '' OR length(v_norm) < 2 THEN RETURN; END IF;

  SELECT count(*) INTO v_recent
    FROM public.search_query_log
   WHERE created_at > now() - interval '1 minute';
  IF v_recent > 1000 THEN RETURN; END IF;  -- circuit-breaker silencioso

  INSERT INTO public.search_query_log (term_raw, term_normalized, result_count, suggestion)
  VALUES (
    left(coalesce(_q,''), 200),
    left(v_norm, 200),
    greatest(coalesce(_result_count, 0), 0),
    nullif(_suggestion, '')
  );
END;
$$;

-- 3) RPC de funil PDP em batch (preserva o batching atual do front)
CREATE OR REPLACE FUNCTION public.track_pdp_funnel_batch(_events jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_recent int;
  v_count  int;
BEGIN
  IF _events IS NULL OR jsonb_typeof(_events) <> 'array' THEN RETURN; END IF;
  v_count := jsonb_array_length(_events);
  IF v_count = 0 OR v_count > 50 THEN RETURN; END IF;

  SELECT count(*) INTO v_recent
    FROM public.pdp_funnel_events
   WHERE created_at > now() - interval '1 minute';
  IF v_recent > 1000 THEN RETURN; END IF;

  INSERT INTO public.pdp_funnel_events
    (event_name, source, product_slug, quantity, personalized, session_id, meta)
  SELECT
    left(coalesce(e->>'event_name','unknown'), 100),
    nullif(left(coalesce(e->>'source',''), 100), ''),
    nullif(left(coalesce(e->>'product_slug',''), 200), ''),
    NULLIF((e->>'quantity'),'')::int,
    NULLIF((e->>'personalized'),'')::boolean,
    nullif(left(coalesce(e->>'session_id',''), 80), ''),
    CASE WHEN e ? 'meta' AND jsonb_typeof(e->'meta') = 'object' THEN e->'meta' ELSE NULL END
  FROM jsonb_array_elements(_events) AS e;
END;
$$;

-- 4) Liberar EXECUTE só para clients (não service_role, que já bypassa)
REVOKE EXECUTE ON FUNCTION public.log_search(text,int,text)              FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.track_pdp_funnel_batch(jsonb)          FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.log_search(text,int,text)              TO anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.track_pdp_funnel_batch(jsonb)          TO anon, authenticated;
