
-- pdp_sections: CMS para ordenar/ocultar blocos da página de produto
CREATE TABLE IF NOT EXISTS public.pdp_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  description TEXT,
  is_visible BOOLEAN NOT NULL DEFAULT true,
  position INTEGER NOT NULL DEFAULT 0,
  editable_props JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pdp_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pdp_sections public read visible"
  ON public.pdp_sections FOR SELECT
  USING (is_visible = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "pdp_sections admin insert"
  ON public.pdp_sections FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "pdp_sections admin update"
  ON public.pdp_sections FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "pdp_sections admin delete"
  ON public.pdp_sections FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER pdp_sections_updated_at
  BEFORE UPDATE ON public.pdp_sections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auditoria
CREATE TABLE IF NOT EXISTS public.pdp_section_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_key TEXT NOT NULL,
  action TEXT NOT NULL,
  old_value JSONB,
  new_value JSONB,
  changed_by UUID,
  changed_by_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pdp_section_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pdp_section_audit admin read"
  ON public.pdp_section_audit FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.audit_pdp_sections()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_email text;
BEGIN
  IF v_uid IS NOT NULL THEN
    SELECT email INTO v_email FROM public.profiles WHERE id = v_uid;
  END IF;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.pdp_section_audit (section_key, action, new_value, changed_by, changed_by_email)
    VALUES (NEW.section_key, 'created',
            jsonb_build_object('is_visible', NEW.is_visible, 'position', NEW.position, 'label', NEW.label),
            v_uid, v_email);
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.pdp_section_audit (section_key, action, old_value, changed_by, changed_by_email)
    VALUES (OLD.section_key, 'deleted',
            jsonb_build_object('is_visible', OLD.is_visible, 'position', OLD.position, 'label', OLD.label),
            v_uid, v_email);
    RETURN OLD;
  END IF;

  IF NEW.is_visible IS DISTINCT FROM OLD.is_visible THEN
    INSERT INTO public.pdp_section_audit (section_key, action, old_value, new_value, changed_by, changed_by_email)
    VALUES (NEW.section_key, 'visibility_changed',
            jsonb_build_object('is_visible', OLD.is_visible),
            jsonb_build_object('is_visible', NEW.is_visible),
            v_uid, v_email);
  END IF;

  IF NEW.position IS DISTINCT FROM OLD.position THEN
    INSERT INTO public.pdp_section_audit (section_key, action, old_value, new_value, changed_by, changed_by_email)
    VALUES (NEW.section_key, 'reordered',
            jsonb_build_object('position', OLD.position),
            jsonb_build_object('position', NEW.position),
            v_uid, v_email);
  END IF;

  IF NEW.label IS DISTINCT FROM OLD.label
     OR NEW.description IS DISTINCT FROM OLD.description
     OR NEW.editable_props IS DISTINCT FROM OLD.editable_props THEN
    INSERT INTO public.pdp_section_audit (section_key, action, old_value, new_value, changed_by, changed_by_email)
    VALUES (NEW.section_key, 'edited',
            jsonb_build_object('label', OLD.label, 'description', OLD.description, 'editable_props', OLD.editable_props),
            jsonb_build_object('label', NEW.label, 'description', NEW.description, 'editable_props', NEW.editable_props),
            v_uid, v_email);
  END IF;

  RETURN NEW;
END $$;

CREATE TRIGGER pdp_sections_audit_trg
  AFTER INSERT OR UPDATE OR DELETE ON public.pdp_sections
  FOR EACH ROW EXECUTE FUNCTION public.audit_pdp_sections();

-- Seed inicial
INSERT INTO public.pdp_sections (section_key, label, description, position, is_visible) VALUES
  ('description',          'Descrição do produto',         'Texto principal/long description',                          10, true),
  ('cross_sell_complete',  'Complete o kit',               'Sugestões de produtos para complementar',                   20, true),
  ('bundle_belongs_to',    'Kits relacionados',            'Kits que incluem este produto',                             30, true),
  ('visual_composition',   'Composição visual',            'Fica lindo combinado com',                                  40, true),
  ('editorial',            'Conteúdo editorial',           'Texto editorial humano (quando preenchido no produto)',     50, true),
  ('reviews',              'Avaliações',                   'Avaliações verificadas e do site',                          60, true),
  ('faq',                  'Perguntas frequentes',         'FAQ específico do produto',                                 70, true),
  ('related_smart',        'Relacionados (inteligente)',   'Recomendações por taxonomia/similaridade',                  80, true)
ON CONFLICT (section_key) DO NOTHING;
