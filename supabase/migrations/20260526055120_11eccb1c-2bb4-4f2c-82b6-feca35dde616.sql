ALTER TABLE public.shipping_audit_logs
  ADD COLUMN IF NOT EXISTS event_type text NOT NULL DEFAULT 'provider_error',
  ADD COLUMN IF NOT EXISTS total_weight_kg numeric,
  ADD COLUMN IF NOT EXISTS melhor_envio_has_key boolean,
  ADD COLUMN IF NOT EXISTS estimated boolean;

CREATE INDEX IF NOT EXISTS idx_shipping_audit_event_type ON public.shipping_audit_logs (event_type);