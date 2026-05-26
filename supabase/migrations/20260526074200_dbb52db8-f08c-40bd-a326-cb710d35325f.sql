-- 1. Extensão + índices trigram
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE INDEX IF NOT EXISTS idx_products_name_trgm
  ON public.products USING gin (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_products_search_text_trgm
  ON public.products USING gin (search_text gin_trgm_ops);

-- 2. RPC search_products: sinônimos → exata → fuzzy → log
CREATE OR REPLACE FUNCTION public.search_products(_q text, _limit integer DEFAULT 60)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_q_raw      text := coalesce(_q, '');
  v_q          text;
  v_terms      text[];
  v_ids        jsonb := '[]'::jsonb;
  v_boost_ids  uuid[];
  v_suggestion text;
  v_result_cnt int := 0;
  v_source     text := 'none';
  v_tsq        tsquery;
BEGIN
  v_q := trim(regexp_replace(lower(public.unaccent(v_q_raw)), '\s+', ' ', 'g'));
  IF v_q = '' OR length(v_q) < 2 THEN
    RETURN jsonb_build_object('ids','[]'::jsonb,'suggestion',null,'source','empty','count',0);
  END IF;
  IF _limit IS NULL OR _limit <= 0 OR _limit > 200 THEN _limit := 60; END IF;

  -- ====== FASE 1: expandir termo com sinônimos do /admin/busca ======
  WITH syn AS (
    SELECT canonical_term, aliases
      FROM public.search_synonyms
     WHERE coalesce(active, true) = true
       AND (
         lower(public.unaccent(canonical_term)) = v_q
         OR EXISTS (SELECT 1 FROM unnest(coalesce(aliases,'{}'::text[])) a
                     WHERE lower(public.unaccent(a)) = v_q)
       )
  ),
  expanded AS (
    SELECT v_q AS term
    UNION SELECT lower(public.unaccent(canonical_term)) FROM syn
    UNION SELECT lower(public.unaccent(a))
             FROM syn, unnest(coalesce(aliases,'{}'::text[])) a
  )
  SELECT array_agg(DISTINCT term) INTO v_terms
    FROM expanded WHERE term IS NOT NULL AND length(term) > 0;
  IF v_terms IS NULL THEN v_terms := ARRAY[v_q]; END IF;

  -- Boosts pinados pelo admin (sempre no topo)
  SELECT array_agg(b.product_id ORDER BY b.weight DESC, b.created_at ASC)
    INTO v_boost_ids
    FROM public.search_boosts b
    JOIN public.products p ON p.id = b.product_id AND p.is_active = true
   WHERE b.is_active = true
     AND b.term_normalized = ANY(v_terms);

  -- ====== FASE 2: correspondência textual exata (websearch_to_tsquery) ======
  BEGIN
    v_tsq := websearch_to_tsquery('portuguese', array_to_string(v_terms, ' OR '));
  EXCEPTION WHEN OTHERS THEN
    v_tsq := NULL;
  END;

  IF v_tsq IS NOT NULL THEN
    WITH exact AS (
      SELECT p.id
        FROM public.products p
       WHERE p.is_active = true
         AND to_tsvector(
               'portuguese',
               public.unaccent(coalesce(p.name,'') || ' ' ||
                               coalesce(p.description,'') || ' ' ||
                               coalesce(p.search_text,''))
             ) @@ v_tsq
       ORDER BY p.featured_weight DESC NULLS LAST
       LIMIT _limit
    ),
    merged AS (
      SELECT id, ord FROM (
        SELECT unnest(coalesce(v_boost_ids,'{}'::uuid[])) AS id,
               generate_subscripts(coalesce(v_boost_ids,'{}'::uuid[]),1) AS ord
      ) b
      UNION ALL
      SELECT id, 100000 + row_number() OVER () AS ord
        FROM exact
       WHERE id <> ALL(coalesce(v_boost_ids,'{}'::uuid[]))
    ),
    dedup AS (SELECT DISTINCT ON (id) id, ord FROM merged ORDER BY id, ord)
    SELECT coalesce(jsonb_agg(id ORDER BY ord), '[]'::jsonb)
      INTO v_ids
      FROM (SELECT id, ord FROM dedup ORDER BY ord LIMIT _limit) f;

    v_result_cnt := jsonb_array_length(v_ids);
    IF v_result_cnt > 0 THEN v_source := 'exact'; END IF;
  END IF;

  -- ====== FASE 3: fallback fuzzy via trigram (similarity > 0.3) ======
  IF v_result_cnt = 0 THEN
    PERFORM set_limit(0.3);
    WITH scored AS (
      SELECT p.id,
             max(GREATEST(
               similarity(coalesce(p.name,''), t.term),
               similarity(coalesce(p.search_text,''), t.term)
             )) AS sim,
             p.featured_weight
        FROM public.products p
        CROSS JOIN unnest(v_terms) AS t(term)
       WHERE p.is_active = true
         AND (coalesce(p.name,'') % t.term OR coalesce(p.search_text,'') % t.term)
       GROUP BY p.id, p.featured_weight
      HAVING max(GREATEST(
               similarity(coalesce(p.name,''), t.term),
               similarity(coalesce(p.search_text,''), t.term)
             )) > 0.3
    ),
    ranked AS (
      SELECT id, sim
        FROM scored
       ORDER BY sim DESC, featured_weight DESC NULLS LAST
       LIMIT _limit
    ),
    merged AS (
      SELECT id, ord FROM (
        SELECT unnest(coalesce(v_boost_ids,'{}'::uuid[])) AS id,
               generate_subscripts(coalesce(v_boost_ids,'{}'::uuid[]),1) AS ord
      ) b
      UNION ALL
      SELECT id, 100000 + row_number() OVER () AS ord
        FROM ranked
       WHERE id <> ALL(coalesce(v_boost_ids,'{}'::uuid[]))
    ),
    dedup AS (SELECT DISTINCT ON (id) id, ord FROM merged ORDER BY id, ord)
    SELECT coalesce(jsonb_agg(id ORDER BY ord), '[]'::jsonb)
      INTO v_ids
      FROM (SELECT id, ord FROM dedup ORDER BY ord LIMIT _limit) f;

    v_result_cnt := jsonb_array_length(v_ids);
    IF v_result_cnt > 0 THEN v_source := 'fuzzy'; END IF;
  END IF;

  -- ====== Sugestão "você quis dizer…" ======
  IF v_result_cnt = 0 OR v_source = 'fuzzy' THEN
    SELECT s.canonical_term
      INTO v_suggestion
      FROM public.search_synonyms s
     WHERE coalesce(s.active, true) = true
     ORDER BY GREATEST(
       similarity(lower(public.unaccent(s.canonical_term)), v_q),
       coalesce((SELECT max(similarity(lower(public.unaccent(a)), v_q))
                   FROM unnest(coalesce(s.aliases,'{}'::text[])) a), 0)
     ) DESC NULLS LAST
     LIMIT 1;
  END IF;

  -- ====== Log obrigatório (inclusive em fallback / zero-results) ======
  PERFORM public.log_search(v_q_raw, v_result_cnt, v_suggestion);

  RETURN jsonb_build_object(
    'ids', coalesce(v_ids, '[]'::jsonb),
    'suggestion', v_suggestion,
    'source', v_source,
    'count', v_result_cnt
  );
END;
$function$;