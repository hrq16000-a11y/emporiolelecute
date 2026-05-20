
-- Fase 2 SAFE — RPC server-side de busca inteligente.
-- Move a carga (normalização, sinônimos, fuzzy) do client para o Postgres.

create or replace function public.search_products(_q text, _limit int default 60)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
declare
  v_q text;
  v_terms text[];
  v_ids jsonb;
  v_suggestion text;
  v_max_sim real;
  v_sug_sim real;
begin
  v_q := trim(regexp_replace(lower(public.unaccent(coalesce(_q, ''))), '\s+', ' ', 'g'));

  if v_q = '' or length(v_q) < 2 then
    return jsonb_build_object('ids', '[]'::jsonb, 'suggestion', null);
  end if;

  if _limit is null or _limit <= 0 or _limit > 200 then
    _limit := 60;
  end if;

  -- Expansão de termos: termo + sinônimos casados (exato ou trigram)
  with syn as (
    select canonical_term, aliases
      from public.search_synonyms
     where coalesce(is_active, true) = true
       and (
         lower(public.unaccent(canonical_term)) = v_q
         or exists (
           select 1 from unnest(coalesce(aliases, '{}'::text[])) a
            where lower(public.unaccent(a)) = v_q
         )
         or lower(public.unaccent(canonical_term)) % v_q
       )
  ),
  expanded as (
    select v_q as term
    union
    select lower(public.unaccent(canonical_term)) from syn
    union
    select lower(public.unaccent(a))
      from syn, unnest(coalesce(aliases, '{}'::text[])) a
  )
  select array_agg(distinct term)
    into v_terms
    from expanded
   where term is not null and length(term) > 0;

  if v_terms is null or array_length(v_terms, 1) is null then
    return jsonb_build_object('ids', '[]'::jsonb, 'suggestion', null);
  end if;

  perform set_limit(0.15);

  with scored as (
    select p.id,
           max(similarity(p.search_text, t.term))                  as sim,
           bool_or(p.search_text ilike '%' || t.term || '%')       as substr_hit,
           p.featured_weight
      from public.products p
      cross join unnest(v_terms) as t(term)
     where p.is_active = true
       and (p.search_text % t.term or p.search_text ilike '%' || t.term || '%')
     group by p.id, p.featured_weight
  ),
  ranked as (
    select id, sim
      from scored
     order by (case when substr_hit then 1 else 0 end) desc,
              sim desc nulls last,
              featured_weight desc nulls last
     limit _limit
  )
  select coalesce(jsonb_agg(id), '[]'::jsonb), max(sim)
    into v_ids, v_max_sim
    from ranked;

  -- "Você quis dizer..." quando relevância é baixa
  if v_max_sim is null or v_max_sim < 0.4 then
    select s.canonical_term,
           greatest(
             similarity(lower(public.unaccent(s.canonical_term)), v_q),
             coalesce((
               select max(similarity(lower(public.unaccent(a)), v_q))
                 from unnest(coalesce(s.aliases, '{}'::text[])) a
             ), 0)
           )
      into v_suggestion, v_sug_sim
      from public.search_synonyms s
     where coalesce(s.is_active, true) = true
     order by 2 desc nulls last
     limit 1;

    if v_sug_sim is null or v_sug_sim < 0.3 then
      v_suggestion := null;
    end if;
  end if;

  return jsonb_build_object(
    'ids', coalesce(v_ids, '[]'::jsonb),
    'suggestion', v_suggestion
  );
end;
$$;

grant execute on function public.search_products(text, int) to anon, authenticated;
