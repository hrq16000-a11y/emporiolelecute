ALTER TABLE public.shipping_settings
  ADD COLUMN IF NOT EXISTS free_shipping_enabled boolean NOT NULL DEFAULT true;