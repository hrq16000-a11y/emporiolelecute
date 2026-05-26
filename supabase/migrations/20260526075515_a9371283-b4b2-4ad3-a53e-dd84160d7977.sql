ALTER TABLE public.shipping_settings
  ADD COLUMN IF NOT EXISTS pickup_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pickup_label text NOT NULL DEFAULT 'Retirada no ateliê',
  ADD COLUMN IF NOT EXISTS pickup_address text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS pickup_instructions text NOT NULL DEFAULT '';