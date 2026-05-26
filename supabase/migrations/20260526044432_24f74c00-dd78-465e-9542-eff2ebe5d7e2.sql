
-- =============== shipping_settings (singleton) ===============
CREATE TABLE IF NOT EXISTS public.shipping_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  origin_zip_code text NOT NULL DEFAULT '',
  default_box_weight_kg numeric NOT NULL DEFAULT 0.150,
  default_box_length_cm numeric NOT NULL DEFAULT 16,
  default_box_width_cm numeric NOT NULL DEFAULT 11,
  default_box_height_cm numeric NOT NULL DEFAULT 6,
  handling_fee numeric NOT NULL DEFAULT 0,
  shipping_markup_percentage numeric NOT NULL DEFAULT 0,
  singleton boolean NOT NULL DEFAULT true UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.shipping_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage shipping_settings"
  ON public.shipping_settings FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.shipping_settings (origin_zip_code) VALUES ('') ON CONFLICT (singleton) DO NOTHING;

-- =============== shipping_providers ===============
CREATE TABLE IF NOT EXISTS public.shipping_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_name text NOT NULL,
  provider_code text NOT NULL UNIQUE, -- ex: 'melhor_envio', 'correios'
  is_active boolean NOT NULL DEFAULT false,
  api_key text,
  api_secret text,
  endpoint_url text,
  config_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.shipping_providers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage shipping_providers"
  ON public.shipping_providers FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.shipping_providers (provider_name, provider_code, is_active, endpoint_url)
VALUES
  ('Melhor Envio', 'melhor_envio', false, 'https://www.melhorenvio.com.br/api/v2/me/shipment/calculate'),
  ('Correios (estimado)', 'correios_estimate', true, NULL)
ON CONFLICT (provider_code) DO NOTHING;

-- =============== shipping_rules ===============
DO $$ BEGIN
  CREATE TYPE public.shipping_condition_type AS ENUM ('min_cart_value','specific_state','zip_code_range');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.shipping_discount_type AS ENUM ('free_shipping','fixed_discount','percentage_discount');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.shipping_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_name text NOT NULL,
  condition_type public.shipping_condition_type NOT NULL,
  condition_value jsonb NOT NULL DEFAULT '{}'::jsonb,
  discount_type public.shipping_discount_type NOT NULL,
  discount_value numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  priority integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.shipping_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage shipping_rules"
  ON public.shipping_rules FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- =============== shipping_audit_logs ===============
CREATE TABLE IF NOT EXISTS public.shipping_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  destination_zip text,
  cart_snapshot jsonb,
  provider_name text,
  error_message text,
  http_status integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.shipping_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read shipping_audit_logs"
  ON public.shipping_audit_logs FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_shipping_audit_logs_created_at ON public.shipping_audit_logs (created_at DESC);

-- Trigger para manter apenas os 50 logs mais recentes
CREATE OR REPLACE FUNCTION public.trim_shipping_audit_logs()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.shipping_audit_logs
  WHERE id IN (
    SELECT id FROM public.shipping_audit_logs
    ORDER BY created_at DESC
    OFFSET 50
  );
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_trim_shipping_audit_logs ON public.shipping_audit_logs;
CREATE TRIGGER trg_trim_shipping_audit_logs
AFTER INSERT ON public.shipping_audit_logs
FOR EACH STATEMENT EXECUTE FUNCTION public.trim_shipping_audit_logs();

-- =============== products: dimensões e flag de envio ===============
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS weight_kg numeric,
  ADD COLUMN IF NOT EXISTS length_cm numeric,
  ADD COLUMN IF NOT EXISTS width_cm numeric,
  ADD COLUMN IF NOT EXISTS height_cm numeric,
  ADD COLUMN IF NOT EXISTS requires_shipping boolean NOT NULL DEFAULT true;

-- =============== updated_at triggers ===============
DROP TRIGGER IF EXISTS trg_shipping_settings_updated ON public.shipping_settings;
CREATE TRIGGER trg_shipping_settings_updated BEFORE UPDATE ON public.shipping_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_shipping_providers_updated ON public.shipping_providers;
CREATE TRIGGER trg_shipping_providers_updated BEFORE UPDATE ON public.shipping_providers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_shipping_rules_updated ON public.shipping_rules;
CREATE TRIGGER trg_shipping_rules_updated BEFORE UPDATE ON public.shipping_rules
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
