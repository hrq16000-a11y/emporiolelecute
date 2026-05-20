
-- 1) Log de buscas
create table if not exists public.search_query_log (
  id uuid primary key default gen_random_uuid(),
  term_raw text not null,
  term_normalized text not null,
  result_count int not null default 0,
  suggestion text,
  created_at timestamptz not null default now()
);

create index if not exists idx_search_query_log_normalized
  on public.search_query_log (term_normalized);
create index if not exists idx_search_query_log_created_at
  on public.search_query_log (created_at desc);
create index if not exists idx_search_query_log_zero
  on public.search_query_log (term_normalized)
  where result_count = 0;

alter table public.search_query_log enable row level security;

drop policy if exists "anyone can insert search log" on public.search_query_log;
create policy "anyone can insert search log"
  on public.search_query_log for insert
  to anon, authenticated with check (true);

drop policy if exists "admins read search log" on public.search_query_log;
create policy "admins read search log"
  on public.search_query_log for select
  to authenticated using (public.has_role(auth.uid(), 'admin'));

drop policy if exists "admins delete search log" on public.search_query_log;
create policy "admins delete search log"
  on public.search_query_log for delete
  to authenticated using (public.has_role(auth.uid(), 'admin'));

create or replace function public.log_search(_q text, _result_count int, _suggestion text default null)
returns void
language plpgsql
volatile
security invoker
set search_path = public, pg_catalog
as $$
declare v_norm text;
begin
  v_norm := trim(regexp_replace(lower(public.unaccent(coalesce(_q, ''))), '\s+', ' ', 'g'));
  if v_norm = '' or length(v_norm) < 2 then return; end if;
  insert into public.search_query_log (term_raw, term_normalized, result_count, suggestion)
  values (left(coalesce(_q,''), 200), left(v_norm, 200), greatest(coalesce(_result_count,0), 0), nullif(_suggestion,''));
end;
$$;
grant execute on function public.log_search(text, int, text) to anon, authenticated;

-- 2) Search boosts (com trigger para normalizar — generated column não aceita stable fn)
create table if not exists public.search_boosts (
  id uuid primary key default gen_random_uuid(),
  term text not null,
  term_normalized text not null,
  product_id uuid not null references public.products(id) on delete cascade,
  weight int not null default 100,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (term_normalized, product_id)
);

create or replace function public.search_boosts_normalize()
returns trigger
language plpgsql
set search_path = public, pg_catalog
as $$
begin
  NEW.term := trim(coalesce(NEW.term,''));
  NEW.term_normalized := trim(regexp_replace(lower(public.unaccent(NEW.term)), '\s+', ' ', 'g'));
  if NEW.term_normalized = '' then
    raise exception 'Termo do boost não pode ser vazio.' using errcode='23514';
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_search_boosts_normalize on public.search_boosts;
create trigger trg_search_boosts_normalize
  before insert or update on public.search_boosts
  for each row execute function public.search_boosts_normalize();

drop trigger if exists trg_search_boosts_updated on public.search_boosts;
create trigger trg_search_boosts_updated
  before update on public.search_boosts
  for each row execute function public.update_updated_at_column();

create index if not exists idx_search_boosts_term
  on public.search_boosts (term_normalized) where is_active;

alter table public.search_boosts enable row level security;

drop policy if exists "search boosts public read" on public.search_boosts;
create policy "search boosts public read"
  on public.search_boosts for select
  to anon, authenticated using (is_active);

drop policy if exists "search boosts admin all" on public.search_boosts;
create policy "search boosts admin all"
  on public.search_boosts for all
  to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- 3) RPC search_products v2 — agora com boosts
create or replace function public.search_products(_q text, _limit int default 60)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public, pg_catalog
as $$
declare
  v_q text;
  v_terms text[];
  v_ids jsonb;
  v_boost_ids uuid[];
  v_suggestion text;
  v_max_sim real;
  v_sug_sim real;
begin
  v_q := trim(regexp_replace(lower(public.unaccent(coalesce(_q, ''))), '\s+', ' ', 'g'));
  if v_q = '' or length(v_q) < 2 then
    return jsonb_build_object('ids', '[]'::jsonb, 'suggestion', null);
  end if;
  if _limit is null or _limit <= 0 or _limit > 200 then _limit := 60; end if;

  with syn as (
    select canonical_term, aliases
      from public.search_synonyms
     where coalesce(active, true) = true
       and (
         lower(public.unaccent(canonical_term)) = v_q
         or exists (select 1 from unnest(coalesce(aliases, '{}'::text[])) a
                    where lower(public.unaccent(a)) = v_q)
         or lower(public.unaccent(canonical_term)) % v_q
       )
  ),
  expanded as (
    select v_q as term
    union select lower(public.unaccent(canonical_term)) from syn
    union select lower(public.unaccent(a))
            from syn, unnest(coalesce(aliases, '{}'::text[])) a
  )
  select array_agg(distinct term) into v_terms
    from expanded where term is not null and length(term) > 0;
  if v_terms is null then v_terms := array[v_q]; end if;

  select array_agg(b.product_id order by b.weight desc, b.created_at asc)
    into v_boost_ids
    from public.search_boosts b
    join public.products p on p.id = b.product_id and p.is_active = true
   where b.is_active = true
     and b.term_normalized = any (v_terms);

  perform set_limit(0.15);

  with scored as (
    select p.id,
           max(similarity(p.search_text, t.term))            as sim,
           bool_or(p.search_text ilike '%' || t.term || '%') as substr_hit,
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
  ),
  merged as (
    select id, ord from (
      select unnest(coalesce(v_boost_ids, '{}'::uuid[])) as id,
             generate_subscripts(coalesce(v_boost_ids, '{}'::uuid[]), 1) as ord
    ) b
    union all
    select id, 100000 + row_number() over () as ord
      from ranked
     where id <> all (coalesce(v_boost_ids, '{}'::uuid[]))
  ),
  dedup as (
    select distinct on (id) id, ord from merged order by id, ord
  )
  select coalesce(jsonb_agg(id order by ord), '[]'::jsonb)
    into v_ids
    from (select id, ord from dedup order by ord limit _limit) f;

  select max(sim) into v_max_sim from (
    select max(similarity(p.search_text, t.term)) as sim
      from public.products p
      cross join unnest(v_terms) as t(term)
     where p.is_active = true
       and (p.search_text % t.term or p.search_text ilike '%' || t.term || '%')
     group by p.id
  ) s;

  if v_max_sim is null or v_max_sim < 0.4 then
    select s.canonical_term,
           greatest(
             similarity(lower(public.unaccent(s.canonical_term)), v_q),
             coalesce((select max(similarity(lower(public.unaccent(a)), v_q))
                         from unnest(coalesce(s.aliases, '{}'::text[])) a), 0)
           )
      into v_suggestion, v_sug_sim
      from public.search_synonyms s
     where coalesce(s.active, true) = true
     order by 2 desc nulls last
     limit 1;
    if v_sug_sim is null or v_sug_sim < 0.3 then v_suggestion := null; end if;
  end if;

  return jsonb_build_object('ids', coalesce(v_ids, '[]'::jsonb), 'suggestion', v_suggestion);
end;
$$;
grant execute on function public.search_products(text, int) to anon, authenticated;

-- 4) View para o dashboard de insights
create or replace view public.search_insights_summary
with (security_invoker = true) as
select term_normalized,
       count(*)::int                                 as total_searches,
       count(*) filter (where result_count = 0)::int as zero_result_count,
       max(created_at)                               as last_searched_at,
       max(suggestion)                               as last_suggestion
  from public.search_query_log
 where created_at >= now() - interval '90 days'
 group by term_normalized;
