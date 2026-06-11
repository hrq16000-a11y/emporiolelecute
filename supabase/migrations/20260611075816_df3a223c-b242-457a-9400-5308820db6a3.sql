-- ============================================================
-- 1) Tabela de auditorias periódicas de mídia
-- ============================================================
CREATE TABLE IF NOT EXISTS public.media_audit_runs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ran_at timestamptz NOT NULL DEFAULT now(),
  total int NOT NULL DEFAULT 0,
  active int NOT NULL DEFAULT 0,
  archived int NOT NULL DEFAULT 0,
  missing int NOT NULL DEFAULT 0,
  missing_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  manifest jsonb,
  alerted boolean NOT NULL DEFAULT false,
  source text NOT NULL DEFAULT 'cron',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.media_audit_runs TO authenticated;
GRANT ALL ON public.media_audit_runs TO service_role;

ALTER TABLE public.media_audit_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view media audit runs"
ON public.media_audit_runs FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_media_audit_runs_ran_at ON public.media_audit_runs (ran_at DESC);

-- ============================================================
-- 2) Re-vínculo: reescreve URLs das entidades a partir do catálogo (img_ref)
--    Só reescreve assets 'active' (binário existe). Opcionalmente filtra por img_ref.
-- ============================================================
CREATE OR REPLACE FUNCTION public.media_relink_references(_img_refs text[] DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_updated int := 0;
  v_tmp int;
BEGIN
  -- occasions.image_url
  UPDATE public.occasions o
     SET image_url = m.public_url, image_ref = m.img_ref
    FROM public.media_assets m
   WHERE m.entity_type = 'occasion' AND m.field = 'image_url'
     AND m.entity_id = o.id::text AND m.status = 'active'
     AND (_img_refs IS NULL OR m.img_ref = ANY(_img_refs));
  GET DIAGNOSTICS v_tmp = ROW_COUNT; v_updated := v_updated + v_tmp;

  -- hero_slides (3 campos distintos -> 3 linhas no catálogo)
  UPDATE public.hero_slides h
     SET image_url = m.public_url
    FROM public.media_assets m
   WHERE m.entity_type = 'hero_slide' AND m.field = 'image_url'
     AND m.entity_id = h.id::text AND m.status = 'active'
     AND (_img_refs IS NULL OR m.img_ref = ANY(_img_refs));
  GET DIAGNOSTICS v_tmp = ROW_COUNT; v_updated := v_updated + v_tmp;

  UPDATE public.hero_slides h
     SET image_desktop_url = m.public_url, image_ref = m.img_ref
    FROM public.media_assets m
   WHERE m.entity_type = 'hero_slide' AND m.field = 'image_desktop_url'
     AND m.entity_id = h.id::text AND m.status = 'active'
     AND (_img_refs IS NULL OR m.img_ref = ANY(_img_refs));
  GET DIAGNOSTICS v_tmp = ROW_COUNT; v_updated := v_updated + v_tmp;

  UPDATE public.hero_slides h
     SET image_mobile_url = m.public_url
    FROM public.media_assets m
   WHERE m.entity_type = 'hero_slide' AND m.field = 'image_mobile_url'
     AND m.entity_id = h.id::text AND m.status = 'active'
     AND (_img_refs IS NULL OR m.img_ref = ANY(_img_refs));
  GET DIAGNOSTICS v_tmp = ROW_COUNT; v_updated := v_updated + v_tmp;

  -- categories / kits / segments
  UPDATE public.categories c
     SET image_url = m.public_url, image_ref = m.img_ref
    FROM public.media_assets m
   WHERE m.entity_type = 'category' AND m.field = 'image_url'
     AND m.entity_id = c.id::text AND m.status = 'active'
     AND (_img_refs IS NULL OR m.img_ref = ANY(_img_refs));
  GET DIAGNOSTICS v_tmp = ROW_COUNT; v_updated := v_updated + v_tmp;

  UPDATE public.kits k
     SET image_url = m.public_url, image_ref = m.img_ref
    FROM public.media_assets m
   WHERE m.entity_type = 'kit' AND m.field = 'image_url'
     AND m.entity_id = k.id::text AND m.status = 'active'
     AND (_img_refs IS NULL OR m.img_ref = ANY(_img_refs));
  GET DIAGNOSTICS v_tmp = ROW_COUNT; v_updated := v_updated + v_tmp;

  UPDATE public.segments s
     SET image_url = m.public_url, image_ref = m.img_ref
    FROM public.media_assets m
   WHERE m.entity_type = 'segment' AND m.field = 'image_url'
     AND m.entity_id = s.id::text AND m.status = 'active'
     AND (_img_refs IS NULL OR m.img_ref = ANY(_img_refs));
  GET DIAGNOSTICS v_tmp = ROW_COUNT; v_updated := v_updated + v_tmp;

  RETURN jsonb_build_object('ok', true, 'updated', v_updated);
END;
$$;

REVOKE ALL ON FUNCTION public.media_relink_references(text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.media_relink_references(text[]) TO service_role;

-- ============================================================
-- 3) Backfill da referência estável image_ref (qualquer status)
--    Liga cada entidade ao seu img_ref do catálogo, mesmo se o binário sumiu.
-- ============================================================
UPDATE public.occasions o
   SET image_ref = m.img_ref
  FROM public.media_assets m
 WHERE m.entity_type = 'occasion' AND m.field = 'image_url'
   AND m.entity_id = o.id::text AND o.image_ref IS NULL;

UPDATE public.hero_slides h
   SET image_ref = m.img_ref
  FROM public.media_assets m
 WHERE m.entity_type = 'hero_slide' AND m.field = 'image_desktop_url'
   AND m.entity_id = h.id::text AND h.image_ref IS NULL;

UPDATE public.categories c
   SET image_ref = m.img_ref
  FROM public.media_assets m
 WHERE m.entity_type = 'category' AND m.field = 'image_url'
   AND m.entity_id = c.id::text AND c.image_ref IS NULL;

UPDATE public.kits k
   SET image_ref = m.img_ref
  FROM public.media_assets m
 WHERE m.entity_type = 'kit' AND m.field = 'image_url'
   AND m.entity_id = k.id::text AND k.image_ref IS NULL;

UPDATE public.segments s
   SET image_ref = m.img_ref
  FROM public.media_assets m
 WHERE m.entity_type = 'segment' AND m.field = 'image_url'
   AND m.entity_id = s.id::text AND s.image_ref IS NULL;