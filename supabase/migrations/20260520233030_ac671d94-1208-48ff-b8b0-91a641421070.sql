-- 1. Função geradora de external_ref a partir do slug
CREATE OR REPLACE FUNCTION public.gen_external_ref(_prefix text, _slug text, _fallback text DEFAULT NULL)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public', 'pg_catalog'
AS $$
  SELECT _prefix || '_' || COALESCE(
    NULLIF(public.normalize_slug(_slug), ''),
    NULLIF(public.normalize_slug(_fallback), ''),
    substr(md5(random()::text || clock_timestamp()::text), 1, 10)
  )
$$;

-- 2. Adicionar coluna em cada tabela
ALTER TABLE public.products    ADD COLUMN IF NOT EXISTS external_ref text;
ALTER TABLE public.categories  ADD COLUMN IF NOT EXISTS external_ref text;
ALTER TABLE public.occasions   ADD COLUMN IF NOT EXISTS external_ref text;
ALTER TABLE public.tags        ADD COLUMN IF NOT EXISTS external_ref text;
ALTER TABLE public.kits        ADD COLUMN IF NOT EXISTS external_ref text;

-- 3. Backfill com slugs existentes
UPDATE public.products   SET external_ref = public.gen_external_ref('prd', slug, name) WHERE external_ref IS NULL;
UPDATE public.categories SET external_ref = public.gen_external_ref('cat', slug, name) WHERE external_ref IS NULL;
UPDATE public.occasions  SET external_ref = public.gen_external_ref('occ', slug, name) WHERE external_ref IS NULL;
UPDATE public.tags       SET external_ref = public.gen_external_ref('tag', slug, name) WHERE external_ref IS NULL;
UPDATE public.kits       SET external_ref = public.gen_external_ref('kit', slug, name) WHERE external_ref IS NULL;

-- 4. Índices únicos
CREATE UNIQUE INDEX IF NOT EXISTS products_external_ref_key   ON public.products(external_ref);
CREATE UNIQUE INDEX IF NOT EXISTS categories_external_ref_key ON public.categories(external_ref);
CREATE UNIQUE INDEX IF NOT EXISTS occasions_external_ref_key  ON public.occasions(external_ref);
CREATE UNIQUE INDEX IF NOT EXISTS tags_external_ref_key       ON public.tags(external_ref);
CREATE UNIQUE INDEX IF NOT EXISTS kits_external_ref_key       ON public.kits(external_ref);

-- 5. NOT NULL
ALTER TABLE public.products   ALTER COLUMN external_ref SET NOT NULL;
ALTER TABLE public.categories ALTER COLUMN external_ref SET NOT NULL;
ALTER TABLE public.occasions  ALTER COLUMN external_ref SET NOT NULL;
ALTER TABLE public.tags       ALTER COLUMN external_ref SET NOT NULL;
ALTER TABLE public.kits       ALTER COLUMN external_ref SET NOT NULL;

-- 6. Trigger que gera external_ref se não vier preenchido (insert) ou se mudou o slug e quiserem rotacionar (não rotaciona automaticamente — só preenche se NULL)
CREATE OR REPLACE FUNCTION public.ensure_external_ref()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_catalog'
AS $$
DECLARE
  v_prefix text;
BEGIN
  IF NEW.external_ref IS NOT NULL AND length(trim(NEW.external_ref)) > 0 THEN
    RETURN NEW;
  END IF;
  v_prefix := CASE TG_TABLE_NAME
    WHEN 'products'   THEN 'prd'
    WHEN 'categories' THEN 'cat'
    WHEN 'occasions'  THEN 'occ'
    WHEN 'tags'       THEN 'tag'
    WHEN 'kits'       THEN 'kit'
    ELSE 'ref'
  END;
  NEW.external_ref := public.gen_external_ref(v_prefix, NEW.slug, NEW.name);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_products_external_ref   ON public.products;
DROP TRIGGER IF EXISTS trg_categories_external_ref ON public.categories;
DROP TRIGGER IF EXISTS trg_occasions_external_ref  ON public.occasions;
DROP TRIGGER IF EXISTS trg_tags_external_ref       ON public.tags;
DROP TRIGGER IF EXISTS trg_kits_external_ref       ON public.kits;

CREATE TRIGGER trg_products_external_ref   BEFORE INSERT ON public.products   FOR EACH ROW EXECUTE FUNCTION public.ensure_external_ref();
CREATE TRIGGER trg_categories_external_ref BEFORE INSERT ON public.categories FOR EACH ROW EXECUTE FUNCTION public.ensure_external_ref();
CREATE TRIGGER trg_occasions_external_ref  BEFORE INSERT ON public.occasions  FOR EACH ROW EXECUTE FUNCTION public.ensure_external_ref();
CREATE TRIGGER trg_tags_external_ref       BEFORE INSERT ON public.tags       FOR EACH ROW EXECUTE FUNCTION public.ensure_external_ref();
CREATE TRIGGER trg_kits_external_ref       BEFORE INSERT ON public.kits       FOR EACH ROW EXECUTE FUNCTION public.ensure_external_ref();

GRANT EXECUTE ON FUNCTION public.gen_external_ref(text, text, text) TO authenticated, service_role;