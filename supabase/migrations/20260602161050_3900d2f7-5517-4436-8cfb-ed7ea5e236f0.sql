-- =====================================================================
-- ETAPA 1: Registro central de mídia (media_assets) + img_ref estável
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.media_assets (
  img_ref          text PRIMARY KEY,
  bucket           text NOT NULL,
  storage_path     text NOT NULL,
  public_url       text,
  content_type     text,
  size_bytes       bigint,
  checksum_sha256  text,
  width            int,
  height           int,
  entity_type      text,
  entity_id        text,
  field            text,
  ref_count        int NOT NULL DEFAULT 0,
  source           text NOT NULL DEFAULT 'storage',
  status           text NOT NULL DEFAULT 'active',
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  last_verified_at timestamptz,
  backed_up_at     timestamptz,
  CONSTRAINT media_assets_bucket_path_uniq UNIQUE (bucket, storage_path),
  CONSTRAINT media_assets_status_chk CHECK (status IN ('active','missing','archived')),
  CONSTRAINT media_assets_source_chk CHECK (source IN ('storage','src_assets','external'))
);

CREATE INDEX IF NOT EXISTS idx_media_assets_status ON public.media_assets (status);
CREATE INDEX IF NOT EXISTS idx_media_assets_entity ON public.media_assets (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_media_assets_bucket ON public.media_assets (bucket);

-- Grants (catálogo sensível: somente admin via RLS; service_role para edges/backup)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.media_assets TO authenticated;
GRANT ALL ON public.media_assets TO service_role;

ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage media_assets"
ON public.media_assets
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Trigger updated_at
CREATE TRIGGER trg_media_assets_updated_at
BEFORE UPDATE ON public.media_assets
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------
-- Gerador de img_ref legível e estável (não derivado do UID do storage)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.gen_img_ref(_prefix text, _hint text)
RETURNS text
LANGUAGE sql
VOLATILE
SET search_path TO 'public', 'pg_catalog'
AS $$
  SELECT coalesce(nullif(_prefix,''),'file') || '_' ||
         coalesce(nullif(left(public.normalize_slug(_hint), 40), ''), 'img') || '_' ||
         substr(md5(random()::text || clock_timestamp()::text), 1, 6)
$$;

-- ---------------------------------------------------------------------
-- ETAPA 2: Inventário completo (backfill) — cruza referências x storage
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rebuild_media_inventory()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'storage', 'pg_catalog'
AS $$
DECLARE
  v_base      text := 'https://xfqffqxqiuqauefrrcxn.supabase.co/storage/v1/object/public/';
  v_active    int;
  v_archived  int;
  v_missing   int;
  v_total     int;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- Reúne TODAS as referências de imagem que apontam para o storage
  CREATE TEMP TABLE _refs ON COMMIT DROP AS
  WITH refs AS (
    SELECT 'product'::text et, p.id::text eid, 'images'::text fld, img AS url
      FROM public.products p, unnest(p.images) img WHERE img IS NOT NULL
    UNION ALL SELECT 'occasion', o.id::text, 'image_url', o.image_url FROM public.occasions o WHERE o.image_url IS NOT NULL
    UNION ALL SELECT 'category', c.id::text, 'image_url', c.image_url FROM public.categories c WHERE c.image_url IS NOT NULL
    UNION ALL SELECT 'hero_slide', h.id::text, 'image_url', h.image_url FROM public.hero_slides h WHERE h.image_url IS NOT NULL
    UNION ALL SELECT 'hero_slide', h.id::text, 'image_desktop_url', h.image_desktop_url FROM public.hero_slides h WHERE h.image_desktop_url IS NOT NULL
    UNION ALL SELECT 'hero_slide', h.id::text, 'image_mobile_url', h.image_mobile_url FROM public.hero_slides h WHERE h.image_mobile_url IS NOT NULL
    UNION ALL SELECT 'kit', k.id::text, 'image_url', k.image_url FROM public.kits k WHERE k.image_url IS NOT NULL
    UNION ALL SELECT 'segment', s.id::text, 'image_url', s.image_url FROM public.segments s WHERE s.image_url IS NOT NULL
    UNION ALL SELECT 'collection', cl.id::text, 'image_url', cl.image_url FROM public.collections cl WHERE cl.image_url IS NOT NULL
    UNION ALL SELECT 'homepage_block', hb.id::text, 'image_url', hb.image_url FROM public.homepage_blocks hb WHERE hb.image_url IS NOT NULL
    UNION ALL SELECT 'blog_post', bp.id::text, 'cover_image', bp.cover_image FROM public.blog_posts bp WHERE bp.cover_image IS NOT NULL
    UNION ALL SELECT 'theme_hub', th.id::text, 'hero_image_url', th.hero_image_url FROM public.theme_hubs th WHERE th.hero_image_url IS NOT NULL
    UNION ALL SELECT 'product_review', pr.id::text, 'images', img FROM public.product_reviews pr, unnest(pr.images) img WHERE img IS NOT NULL
  )
  SELECT et, eid, fld, url,
    (regexp_match(url, '/storage/v1/object/(?:public|sign)/([^/?]+)/([^?]+)'))[1] AS bucket,
    (regexp_match(url, '/storage/v1/object/(?:public|sign)/([^/?]+)/([^?]+)'))[2] AS path
  FROM refs
  WHERE url ~ '/storage/v1/object/';

  -- 1) Upsert dos objetos reais do storage (origem da verdade física)
  INSERT INTO public.media_assets AS m
    (img_ref, bucket, storage_path, public_url, content_type, size_bytes,
     entity_type, entity_id, field, ref_count, source, status, last_verified_at)
  SELECT
    public.gen_img_ref(coalesce(r.et, 'file'), o.name),
    o.bucket_id,
    o.name,
    v_base || o.bucket_id || '/' || o.name,
    o.metadata->>'mimetype',
    nullif(o.metadata->>'size','')::bigint,
    r.et, r.eid, r.fld,
    coalesce(r.cnt, 0),
    'storage',
    CASE WHEN r.et IS NOT NULL THEN 'active' ELSE 'archived' END,
    now()
  FROM storage.objects o
  LEFT JOIN LATERAL (
    SELECT rr.et, rr.eid, rr.fld, count(*) OVER () AS cnt
    FROM _refs rr
    WHERE rr.bucket = o.bucket_id AND rr.path = o.name
    LIMIT 1
  ) r ON true
  WHERE o.name IS NOT NULL AND o.name <> ''
  ON CONFLICT (bucket, storage_path) DO UPDATE SET
    public_url       = excluded.public_url,
    content_type     = excluded.content_type,
    size_bytes       = excluded.size_bytes,
    entity_type      = coalesce(excluded.entity_type, m.entity_type),
    entity_id        = coalesce(excluded.entity_id, m.entity_id),
    field            = coalesce(excluded.field, m.field),
    ref_count        = excluded.ref_count,
    source           = 'storage',
    status           = CASE WHEN excluded.entity_type IS NOT NULL THEN 'active' ELSE 'archived' END,
    last_verified_at = now(),
    updated_at       = now();

  -- 2) Referências cujo arquivo NÃO existe mais no storage => 'missing'
  INSERT INTO public.media_assets AS m
    (img_ref, bucket, storage_path, public_url, entity_type, entity_id, field,
     source, status, last_verified_at)
  SELECT DISTINCT ON (r.bucket, r.path)
    public.gen_img_ref(coalesce(r.et, 'file'), r.path),
    r.bucket, r.path, r.url, r.et, r.eid, r.fld,
    'storage', 'missing', now()
  FROM _refs r
  LEFT JOIN storage.objects o ON o.bucket_id = r.bucket AND o.name = r.path
  WHERE o.id IS NULL AND r.bucket IS NOT NULL
  ORDER BY r.bucket, r.path
  ON CONFLICT (bucket, storage_path) DO UPDATE SET
    status           = 'missing',
    entity_type      = coalesce(m.entity_type, excluded.entity_type),
    entity_id        = coalesce(m.entity_id, excluded.entity_id),
    field            = coalesce(m.field, excluded.field),
    last_verified_at = now(),
    updated_at       = now();

  SELECT count(*) FILTER (WHERE status='active'),
         count(*) FILTER (WHERE status='archived'),
         count(*) FILTER (WHERE status='missing'),
         count(*)
    INTO v_active, v_archived, v_missing, v_total
  FROM public.media_assets;

  RETURN jsonb_build_object(
    'ok', true,
    'total', v_total,
    'active', v_active,
    'archived', v_archived,
    'missing', v_missing,
    'ran_at', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rebuild_media_inventory() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rebuild_media_inventory() TO authenticated, service_role;

-- ---------------------------------------------------------------------
-- Colunas image_ref (migração gradual; image_url legado vira fallback)
-- ---------------------------------------------------------------------
ALTER TABLE public.products    ADD COLUMN IF NOT EXISTS image_refs text[] DEFAULT '{}';
ALTER TABLE public.occasions   ADD COLUMN IF NOT EXISTS image_ref text;
ALTER TABLE public.categories  ADD COLUMN IF NOT EXISTS image_ref text;
ALTER TABLE public.hero_slides ADD COLUMN IF NOT EXISTS image_ref text;
ALTER TABLE public.kits        ADD COLUMN IF NOT EXISTS image_ref text;
ALTER TABLE public.segments    ADD COLUMN IF NOT EXISTS image_ref text;