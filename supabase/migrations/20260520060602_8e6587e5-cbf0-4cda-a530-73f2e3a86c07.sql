-- Fase 2 SAFE — Motor de tolerância de busca
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Normalizador imutável (lowercase + unaccent) para uso em índices e geração
CREATE OR REPLACE FUNCTION public.normalize_search(_s text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_catalog
AS $$
  SELECT lower(public.unaccent('unaccent', coalesce(_s, '')))
$$;

-- Tabela de sinônimos editorial
CREATE TABLE IF NOT EXISTS public.search_synonyms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_term text NOT NULL,
  aliases text[] NOT NULL DEFAULT '{}'::text[],
  boost_score numeric NOT NULL DEFAULT 1.0,
  active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS search_synonyms_canonical_norm_uq
  ON public.search_synonyms (public.normalize_search(canonical_term));

CREATE INDEX IF NOT EXISTS search_synonyms_aliases_gin
  ON public.search_synonyms USING GIN (aliases);

ALTER TABLE public.search_synonyms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "synonyms_public_read" ON public.search_synonyms;
CREATE POLICY "synonyms_public_read"
  ON public.search_synonyms FOR SELECT
  USING (active = true);

DROP POLICY IF EXISTS "synonyms_admin_select_all" ON public.search_synonyms;
CREATE POLICY "synonyms_admin_select_all"
  ON public.search_synonyms FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "synonyms_admin_insert" ON public.search_synonyms;
CREATE POLICY "synonyms_admin_insert"
  ON public.search_synonyms FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "synonyms_admin_update" ON public.search_synonyms;
CREATE POLICY "synonyms_admin_update"
  ON public.search_synonyms FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "synonyms_admin_delete" ON public.search_synonyms;
CREATE POLICY "synonyms_admin_delete"
  ON public.search_synonyms FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS trg_search_synonyms_updated_at ON public.search_synonyms;
CREATE TRIGGER trg_search_synonyms_updated_at
  BEFORE UPDATE ON public.search_synonyms
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Coluna de busca consolidada em products (mantida por trigger — retrocompatível,
-- nenhuma query existente é alterada; a coluna apenas adiciona capacidade)
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS search_text text;

CREATE OR REPLACE FUNCTION public.products_refresh_search_text()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.search_text := public.normalize_search(
    concat_ws(' ',
      NEW.name,
      NEW.description,
      NEW.long_description,
      array_to_string(coalesce(NEW.keywords, '{}'::text[]), ' ')
    )
  );
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_products_search_text ON public.products;
CREATE TRIGGER trg_products_search_text
  BEFORE INSERT OR UPDATE OF name, description, long_description, keywords
  ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.products_refresh_search_text();

-- Backfill inicial (uma única vez)
UPDATE public.products
   SET search_text = public.normalize_search(
     concat_ws(' ',
       name,
       description,
       long_description,
       array_to_string(coalesce(keywords, '{}'::text[]), ' ')
     )
   )
 WHERE search_text IS NULL;

-- Índice trigram para LIKE/similarity tolerantes a typos e sem acento
CREATE INDEX IF NOT EXISTS products_search_text_trgm
  ON public.products USING GIN (search_text gin_trgm_ops);