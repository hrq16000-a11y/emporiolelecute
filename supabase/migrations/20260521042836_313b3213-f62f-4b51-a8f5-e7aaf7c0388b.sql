
CREATE TABLE IF NOT EXISTS public.cookie_consent_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  is_enabled boolean NOT NULL DEFAULT true,
  title text NOT NULL DEFAULT 'Sua privacidade importa 🍪',
  message text NOT NULL DEFAULT 'Usamos cookies para melhorar sua experiência e mostrar produtos relevantes. Aceite para liberar tudo ou recuse para o essencial.',
  accept_label text NOT NULL DEFAULT 'Aceitar',
  reject_label text NOT NULL DEFAULT 'Recusar',
  policy_label text NOT NULL DEFAULT 'Política de Privacidade',
  policy_url text NOT NULL DEFAULT '/politica-de-privacidade',
  delay_ms integer NOT NULL DEFAULT 1500,
  position text NOT NULL DEFAULT 'bottom' CHECK (position IN ('bottom','top')),
  variant text NOT NULL DEFAULT 'compact' CHECK (variant IN ('compact','full')),
  show_icon boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

INSERT INTO public.cookie_consent_config (id) VALUES ('00000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.cookie_consent_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Qualquer um lê config do banner"
ON public.cookie_consent_config FOR SELECT
USING (true);

CREATE POLICY "Admin atualiza config do banner"
ON public.cookie_consent_config FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(),'admin'))
WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_ccc_updated_at
BEFORE UPDATE ON public.cookie_consent_config
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
