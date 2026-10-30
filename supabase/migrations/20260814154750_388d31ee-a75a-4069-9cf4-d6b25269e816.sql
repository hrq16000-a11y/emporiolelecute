ALTER TABLE public.theme_hubs
  ADD COLUMN IF NOT EXISTS authority_manipulation boolean NOT NULL DEFAULT false;

ALTER TABLE public.combination_pages_registry
  ADD COLUMN IF NOT EXISTS authority_manipulation boolean NOT NULL DEFAULT false;