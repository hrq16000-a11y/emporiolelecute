CREATE TABLE IF NOT EXISTS public.shipping_quote_cache (
  cache_key   text PRIMARY KEY,
  options     jsonb NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.shipping_quote_cache TO service_role;

ALTER TABLE public.shipping_quote_cache ENABLE ROW LEVEL SECURITY;

-- Sem políticas para anon/authenticated: acesso somente via service_role nas edge functions.

CREATE INDEX IF NOT EXISTS idx_shipping_quote_cache_created_at
  ON public.shipping_quote_cache (created_at DESC);