CREATE TABLE IF NOT EXISTS public.payment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'mercadopago',
  payment_id text,
  event_id text,
  order_code text,
  provider_status text,
  applied_status text,
  result text NOT NULL DEFAULT 'received',
  error_message text,
  duration_ms integer,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS payment_events_idem_idx
  ON public.payment_events (provider, coalesce(payment_id,''), coalesce(event_id,''), coalesce(provider_status,''));
CREATE INDEX IF NOT EXISTS payment_events_created_idx ON public.payment_events (created_at DESC);
CREATE INDEX IF NOT EXISTS payment_events_order_idx ON public.payment_events (order_code);

GRANT SELECT ON public.payment_events TO authenticated;
GRANT ALL ON public.payment_events TO service_role;

ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view payment events"
ON public.payment_events FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));