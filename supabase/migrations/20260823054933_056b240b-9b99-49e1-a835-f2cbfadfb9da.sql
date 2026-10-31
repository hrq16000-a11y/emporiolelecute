-- 1) PRODUCT VERSION HISTORY (field-level audit trail)
CREATE TABLE IF NOT EXISTS public.product_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL,
  version integer NOT NULL,
  operation text NOT NULL,
  snapshot jsonb NOT NULL,
  changed_fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  actor_id uuid,
  actor_email text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_versions_product ON public.product_versions(product_id, version DESC);

GRANT SELECT ON public.product_versions TO authenticated;
GRANT ALL ON public.product_versions TO service_role;

ALTER TABLE public.product_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can read product versions" ON public.product_versions;
CREATE POLICY "Staff can read product versions"
  ON public.product_versions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'editor'));

CREATE OR REPLACE FUNCTION public.track_product_version()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next    integer;
  v_old     jsonb := CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE '{}'::jsonb END;
  v_new     jsonb := to_jsonb(NEW);
  v_changed jsonb;
  v_email   text;
BEGIN
  SELECT COALESCE(MAX(version), 0) + 1 INTO v_next
  FROM public.product_versions WHERE product_id = NEW.id;

  SELECT COALESCE(jsonb_agg(k.key), '[]'::jsonb) INTO v_changed
  FROM jsonb_each(v_new) k
  WHERE k.key NOT IN ('updated_at', 'search_text')
    AND (v_old->k.key) IS DISTINCT FROM k.value;

  IF TG_OP = 'UPDATE' AND jsonb_array_length(v_changed) = 0 THEN
    RETURN NULL;
  END IF;

  SELECT email INTO v_email FROM public.profiles WHERE id = auth.uid();

  INSERT INTO public.product_versions (product_id, version, operation, snapshot, changed_fields, actor_id, actor_email)
  VALUES (NEW.id, v_next, lower(TG_OP), v_new, v_changed, auth.uid(), v_email);

  DELETE FROM public.product_versions pv
  WHERE pv.product_id = NEW.id
    AND pv.version <= v_next - 50;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_products_track_version ON public.products;
CREATE TRIGGER trg_products_track_version
  AFTER INSERT OR UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.track_product_version();

-- Revert helper (admin/editor only)
CREATE OR REPLACE FUNCTION public.revert_product_version(_version_id uuid, _fields text[] DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid  uuid := auth.uid();
  v_row  public.product_versions%ROWTYPE;
  v_snap jsonb;
  v_curr jsonb;
  v_key  text;
BEGIN
  IF v_uid IS NULL OR NOT (public.has_role(v_uid,'admin') OR public.has_role(v_uid,'editor')) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_row FROM public.product_versions WHERE id = _version_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Versão não encontrada' USING ERRCODE = 'P0002'; END IF;

  SELECT to_jsonb(p) INTO v_curr FROM public.products p WHERE p.id = v_row.product_id;
  IF v_curr IS NULL THEN RAISE EXCEPTION 'Produto não encontrado' USING ERRCODE = 'P0002'; END IF;

  v_snap := v_curr;
  FOR v_key IN SELECT jsonb_object_keys(v_row.snapshot) LOOP
    IF v_key IN ('id','created_at','updated_at','search_text') THEN CONTINUE; END IF;
    IF _fields IS NOT NULL AND NOT (v_key = ANY(_fields)) THEN CONTINUE; END IF;
    v_snap := jsonb_set(v_snap, ARRAY[v_key], v_row.snapshot->v_key);
  END LOOP;

  UPDATE public.products SET
    name = v_snap->>'name',
    slug = v_snap->>'slug',
    description = v_snap->>'description',
    price = NULLIF(v_snap->>'price','')::numeric,
    images = ARRAY(SELECT jsonb_array_elements_text(COALESCE(v_snap->'images','[]'::jsonb))),
    is_active = COALESCE((v_snap->>'is_active')::boolean, is_active),
    category_id = NULLIF(v_snap->>'category_id','')::uuid,
    updated_at = now()
  WHERE id = v_row.product_id;

  RETURN jsonb_build_object('ok', true, 'product_id', v_row.product_id, 'from_version', v_row.version);
END;
$$;

-- 2) SEARCH CACHE VERSION (auto invalidation)
CREATE OR REPLACE FUNCTION public.bump_search_cache_version()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.store_settings (key, value, updated_at)
  VALUES ('search_cache_version', jsonb_build_object('version', extract(epoch from now())::bigint, 'source', TG_TABLE_NAME), now())
  ON CONFLICT (key) DO UPDATE
    SET value = jsonb_build_object('version', extract(epoch from now())::bigint, 'source', TG_TABLE_NAME),
        updated_at = now();
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_products_bump_search ON public.products;
CREATE TRIGGER trg_products_bump_search
  AFTER INSERT OR UPDATE OR DELETE ON public.products
  FOR EACH STATEMENT EXECUTE FUNCTION public.bump_search_cache_version();

DROP TRIGGER IF EXISTS trg_categories_bump_search ON public.categories;
CREATE TRIGGER trg_categories_bump_search
  AFTER INSERT OR UPDATE OR DELETE ON public.categories
  FOR EACH STATEMENT EXECUTE FUNCTION public.bump_search_cache_version();

DROP TRIGGER IF EXISTS trg_boosts_bump_search ON public.search_boosts;
CREATE TRIGGER trg_boosts_bump_search
  AFTER INSERT OR UPDATE OR DELETE ON public.search_boosts
  FOR EACH STATEMENT EXECUTE FUNCTION public.bump_search_cache_version();

DROP TRIGGER IF EXISTS trg_synonyms_bump_search ON public.search_synonyms;
CREATE TRIGGER trg_synonyms_bump_search
  AFTER INSERT OR UPDATE OR DELETE ON public.search_synonyms
  FOR EACH STATEMENT EXECUTE FUNCTION public.bump_search_cache_version();

-- 3) WISHLIST
CREATE TABLE IF NOT EXISTS public.wishlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  personalization jsonb NOT NULL DEFAULT '{}'::jsonb,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_wishlists_user ON public.wishlists(user_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.wishlists TO authenticated;
GRANT ALL ON public.wishlists TO service_role;

ALTER TABLE public.wishlists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage their own wishlist" ON public.wishlists;
CREATE POLICY "Users manage their own wishlist"
  ON public.wishlists FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);