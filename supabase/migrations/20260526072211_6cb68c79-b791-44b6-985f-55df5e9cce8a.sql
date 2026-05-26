CREATE TABLE public.social_proof_settings (
  id boolean PRIMARY KEY DEFAULT true,
  is_enabled boolean NOT NULL DEFAULT true,
  initial_delay_ms integer NOT NULL DEFAULT 6000,
  visible_ms integer NOT NULL DEFAULT 9000,
  interval_ms integer NOT NULL DEFAULT 18000,
  position text NOT NULL DEFAULT 'bottom-left',
  show_on_mobile boolean NOT NULL DEFAULT true,
  show_on_desktop boolean NOT NULL DEFAULT true,
  min_rating integer NOT NULL DEFAULT 4,
  pool_size integer NOT NULL DEFAULT 60,
  require_verified boolean NOT NULL DEFAULT false,
  excluded_paths text[] NOT NULL DEFAULT ARRAY['/admin','/acesso-restrito','/rastrear']::text[],
  included_paths text[] NOT NULL DEFAULT ARRAY[]::text[],
  dismiss_persistence text NOT NULL DEFAULT 'session',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT social_proof_singleton CHECK (id = true),
  CONSTRAINT social_proof_position_valid CHECK (position IN ('bottom-left','bottom-right','top-left','top-right')),
  CONSTRAINT social_proof_dismiss_valid CHECK (dismiss_persistence IN ('session','never'))
);

ALTER TABLE public.social_proof_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Social proof settings are public readable"
ON public.social_proof_settings FOR SELECT
USING (true);

CREATE POLICY "Only admins can insert social proof settings"
ON public.social_proof_settings FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can update social proof settings"
ON public.social_proof_settings FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can delete social proof settings"
ON public.social_proof_settings FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_social_proof_settings_updated_at
BEFORE UPDATE ON public.social_proof_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.social_proof_settings (id) VALUES (true) ON CONFLICT DO NOTHING;