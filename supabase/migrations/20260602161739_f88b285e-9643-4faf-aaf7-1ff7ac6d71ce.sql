-- Versão interna (sem checagem de auth.uid) chamável por service_role (edges)
CREATE OR REPLACE FUNCTION public.rebuild_media_inventory_internal()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'storage', 'pg_catalog'
AS $$
DECLARE
  v_base      text := 'https://xfqffqxqiuqauefrrcxn.supabase.co/storage/v1/object/public/';
  v_active    int; v_archived int; v_missing int; v_total int;
BEGIN
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
  FROM refs WHERE url ~ '/storage/v1/object/';

  INSERT INTO public.media_assets AS m
    (img_ref, bucket, storage_path, public_url, content_type, size_bytes,
     entity_type, entity_id, field, ref_count, source, status, last_verified_at)
  SELECT public.gen_img_ref(coalesce(r.et,'file'), o.name), o.bucket_id, o.name,
    v_base || o.bucket_id || '/' || o.name,
    o.metadata->>'mimetype', nullif(o.metadata->>'size','')::bigint,
    r.et, r.eid, r.fld, coalesce(r.cnt,0), 'storage',
    CASE WHEN r.et IS NOT NULL THEN 'active' ELSE 'archived' END, now()
  FROM storage.objects o
  LEFT JOIN LATERAL (SELECT rr.et, rr.eid, rr.fld, count(*) OVER () cnt FROM _refs rr WHERE rr.bucket=o.bucket_id AND rr.path=o.name LIMIT 1) r ON true
  WHERE o.name IS NOT NULL AND o.name <> ''
  ON CONFLICT (bucket, storage_path) DO UPDATE SET
    public_url=excluded.public_url, content_type=excluded.content_type, size_bytes=excluded.size_bytes,
    entity_type=coalesce(excluded.entity_type,m.entity_type), entity_id=coalesce(excluded.entity_id,m.entity_id),
    field=coalesce(excluded.field,m.field), ref_count=excluded.ref_count, source='storage',
    status=CASE WHEN excluded.entity_type IS NOT NULL THEN 'active' ELSE 'archived' END,
    last_verified_at=now(), updated_at=now();

  INSERT INTO public.media_assets AS m
    (img_ref, bucket, storage_path, public_url, entity_type, entity_id, field, source, status, last_verified_at)
  SELECT DISTINCT ON (r.bucket, r.path)
    public.gen_img_ref(coalesce(r.et,'file'), r.path), r.bucket, r.path, r.url, r.et, r.eid, r.fld, 'storage','missing', now()
  FROM _refs r LEFT JOIN storage.objects o ON o.bucket_id=r.bucket AND o.name=r.path
  WHERE o.id IS NULL AND r.bucket IS NOT NULL
  ORDER BY r.bucket, r.path
  ON CONFLICT (bucket, storage_path) DO UPDATE SET status='missing', last_verified_at=now(), updated_at=now();

  SELECT count(*) FILTER (WHERE status='active'), count(*) FILTER (WHERE status='archived'),
         count(*) FILTER (WHERE status='missing'), count(*)
    INTO v_active, v_archived, v_missing, v_total FROM public.media_assets;

  RETURN jsonb_build_object('ok',true,'total',v_total,'active',v_active,'archived',v_archived,'missing',v_missing,'ran_at',now());
END;
$$;

REVOKE ALL ON FUNCTION public.rebuild_media_inventory_internal() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rebuild_media_inventory_internal() TO service_role;

-- Wrapper admin agora apenas valida e delega
CREATE OR REPLACE FUNCTION public.rebuild_media_inventory()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN public.rebuild_media_inventory_internal();
END;
$$;

-- Função que retorna SOMENTE os candidatos seguros a remoção pela GC:
-- arquivos sem uso (archived) E com backup já registrado (backed_up_at).
CREATE OR REPLACE FUNCTION public.media_gc_candidates(_min_age_days int DEFAULT 7)
RETURNS TABLE (img_ref text, bucket text, storage_path text, backed_up_at timestamptz)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT img_ref, bucket, storage_path, backed_up_at
  FROM public.media_assets
  WHERE status = 'archived'
    AND backed_up_at IS NOT NULL
    AND last_verified_at < now() - make_interval(days => greatest(_min_age_days, 1))
$$;

REVOKE ALL ON FUNCTION public.media_gc_candidates(int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.media_gc_candidates(int) TO service_role;