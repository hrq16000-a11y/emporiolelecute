
-- 1) Campanhas de boost com janela de datas
ALTER TABLE public.search_boosts
  ADD COLUMN IF NOT EXISTS starts_at timestamptz,
  ADD COLUMN IF NOT EXISTS ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS campaign_label text;

-- 2) Log de auditoria de sinônimos e boosts
CREATE TABLE IF NOT EXISTS public.search_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity text NOT NULL,
  entity_id uuid,
  action text NOT NULL,
  actor_id uuid,
  actor_email text,
  before jsonb,
  after jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.search_audit_log TO authenticated;
GRANT ALL ON public.search_audit_log TO service_role;
ALTER TABLE public.search_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "search_audit_log_admin_read" ON public.search_audit_log;
CREATE POLICY "search_audit_log_admin_read" ON public.search_audit_log
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_search_audit_log_created_at ON public.search_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_search_audit_log_entity ON public.search_audit_log (entity, entity_id);

CREATE OR REPLACE FUNCTION public.log_search_config_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $$
DECLARE
  v_email text;
BEGIN
  BEGIN
    SELECT u.email INTO v_email FROM auth.users u WHERE u.id = auth.uid();
  EXCEPTION WHEN OTHERS THEN
    v_email := NULL;
  END;

  INSERT INTO public.search_audit_log (entity, entity_id, action, actor_id, actor_email, before, after)
  VALUES (
    TG_TABLE_NAME,
    COALESCE((to_jsonb(NEW)->>'id')::uuid, (to_jsonb(OLD)->>'id')::uuid),
    lower(TG_OP),
    auth.uid(),
    v_email,
    CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) ELSE NULL END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_search_boosts ON public.search_boosts;
CREATE TRIGGER trg_audit_search_boosts
  AFTER INSERT OR UPDATE OR DELETE ON public.search_boosts
  FOR EACH ROW EXECUTE FUNCTION public.log_search_config_change();

DROP TRIGGER IF EXISTS trg_audit_search_synonyms ON public.search_synonyms;
CREATE TRIGGER trg_audit_search_synonyms
  AFTER INSERT OR UPDATE OR DELETE ON public.search_synonyms
  FOR EACH ROW EXECUTE FUNCTION public.log_search_config_change();

-- 3) Índices de performance da busca
CREATE INDEX IF NOT EXISTS idx_products_search_text_trgm
  ON public.products USING gin (search_text gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_products_name_trgm
  ON public.products USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_products_active_featured
  ON public.products (is_active, featured_weight DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_products_active_price
  ON public.products (is_active, price);
CREATE INDEX IF NOT EXISTS idx_products_category_active
  ON public.products (category_id, is_active);
CREATE INDEX IF NOT EXISTS idx_search_boosts_lookup
  ON public.search_boosts (term_normalized, is_active, weight DESC);
