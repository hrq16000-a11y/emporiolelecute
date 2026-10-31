DROP FUNCTION IF EXISTS public.search_products(text, integer, uuid, numeric, numeric);

CREATE OR REPLACE FUNCTION public.search_products(
  _q text,
  _limit integer DEFAULT 24,
  _category_id uuid DEFAULT NULL::uuid,
  _min_price numeric DEFAULT NULL::numeric,
  _max_price numeric DEFAULT NULL::numeric,
  _offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_q_raw      text := coalesce(_q, '');
  v_q          text;
  v_terms      text[];
  v_all        jsonb := '[]'::jsonb;
  v_ids        jsonb := '[]'::jsonb;
  v_boost_ids  uuid[];
  v_suggestion text;
  v_total      int := 0;
  v_result_cnt int := 0;
  v_source     text := 'none';
  v_tsq        tsquery;
  v_cap        int := 500;
BEGIN
  v_q := trim(regexp_replace(lower(public.unaccent(v_q_raw)), '\s+', ' ', 'g'));
  IF v_q = '' OR length(v_q) < 2 THEN
    RETURN jsonb_build_object('ids','[]'::jsonb,'suggestion',null,'source','empty','count',0,'total',0,'offset',0,'has_more',false);
  END IF;
  IF _limit IS NULL OR _limit <= 0 OR _limit > 200 THEN _limit := 24; END IF;
  IF _offset IS NULL OR _offset < 0 THEN _offset := 0; END IF;

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

  SELECT array_agg(b.product_id ORDER BY b.weight DESC, b.created_at ASC)
    INTO v_boost_ids
    FROM public.search_boosts b
    JOIN public.products p ON p.id = b.product_id AND p.is_active = true
   WHERE b.is_active = true
     AND b.term_normalized = ANY(v_terms)
     AND (b.starts_at IS NULL OR b.starts_at <= now())
     AND (b.ends_at IS NULL OR b.ends_at >= now())
     AND (_category_id IS NULL OR p.category_id = _category_id)
     AND (_min_price IS NULL OR p.price >= _min_price)
     AND (_max_price IS NULL OR p.price < _max_price);

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
         AND (_category_id IS NULL OR p.category_id = _category_id)
         AND (_min_price IS NULL OR p.price >= _min_price)
         AND (_max_price IS NULL OR p.price < _max_price)
         AND to_tsvector(
               'portuguese',
               public.unaccent(coalesce(p.name,'') || ' ' ||
                               coalesce(p.description,'') || ' ' ||
                               coalesce(p.search_text,''))
             ) @@ v_tsq
       ORDER BY p.featured_weight DESC NULLS LAST
       LIMIT v_cap
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
      INTO v_all
      FROM (SELECT id, ord FROM dedup ORDER BY ord LIMIT v_cap) f;

    v_total := jsonb_array_length(v_all);
    IF v_total > 0 THEN v_source := 'exact'; END IF;
  END IF;

  IF v_total = 0 THEN
    WITH scored AS (
      SELECT p.id,
             max(GREATEST(
               word_similarity(t.term, lower(public.unaccent(coalesce(p.name,'')))),
               word_similarity(t.term, lower(public.unaccent(coalesce(p.search_text,''))))
             )) AS sim,
             p.featured_weight
        FROM public.products p
        CROSS JOIN unnest(v_terms) AS t(term)
       WHERE p.is_active = true
         AND (_category_id IS NULL OR p.category_id = _category_id)
         AND (_min_price IS NULL OR p.price >= _min_price)
         AND (_max_price IS NULL OR p.price < _max_price)
       GROUP BY p.id, p.featured_weight
      HAVING max(GREATEST(
               word_similarity(t.term, lower(public.unaccent(coalesce(p.name,'')))),
               word_similarity(t.term, lower(public.unaccent(coalesce(p.search_text,''))))
             )) > 0.3
    ),
    ranked AS (
      SELECT id, sim FROM scored
       ORDER BY sim DESC, featured_weight DESC NULLS LAST
       LIMIT v_cap
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
      INTO v_all
      FROM (SELECT id, ord FROM dedup ORDER BY ord LIMIT v_cap) f;

    v_total := jsonb_array_length(v_all);
    IF v_total > 0 THEN v_source := 'fuzzy'; END IF;
  END IF;

  -- Paginação em memória sobre a lista já ranqueada (cap de 500 itens)
  SELECT coalesce(jsonb_agg(elem ORDER BY idx), '[]'::jsonb)
    INTO v_ids
    FROM (
      SELECT elem, idx
        FROM jsonb_array_elements(v_all) WITH ORDINALITY AS t(elem, idx)
       ORDER BY idx
       OFFSET _offset LIMIT _limit
    ) page;

  v_result_cnt := jsonb_array_length(v_ids);

  IF v_total = 0 OR v_source = 'fuzzy' THEN
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

  IF _offset = 0 THEN
    BEGIN
      PERFORM public.log_search(v_q_raw, v_total, v_suggestion);
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  RETURN jsonb_build_object(
    'ids', coalesce(v_ids, '[]'::jsonb),
    'suggestion', v_suggestion,
    'source', v_source,
    'count', v_result_cnt,
    'total', v_total,
    'offset', _offset,
    'has_more', (_offset + v_result_cnt) < v_total
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.search_products(text, integer, uuid, numeric, numeric, integer) TO anon, authenticated, service_role;