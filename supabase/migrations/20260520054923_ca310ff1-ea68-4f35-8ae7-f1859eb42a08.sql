-- Bloco 3 — SAFE: adiciona is_draft às taxonomias públicas.
-- Default true => novos registros nascem invisíveis ao público até serem revisados.
ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS is_draft boolean NOT NULL DEFAULT true;

ALTER TABLE public.occasions
  ADD COLUMN IF NOT EXISTS is_draft boolean NOT NULL DEFAULT true;

ALTER TABLE public.segments
  ADD COLUMN IF NOT EXISTS is_draft boolean NOT NULL DEFAULT true;

-- Índices parciais para leituras públicas (sitemap, listagens):
CREATE INDEX IF NOT EXISTS idx_categories_public_visible
  ON public.categories (position)
  WHERE is_draft = false AND is_indexed = true;

CREATE INDEX IF NOT EXISTS idx_occasions_public_visible
  ON public.occasions (position)
  WHERE is_draft = false AND is_indexed = true;

CREATE INDEX IF NOT EXISTS idx_segments_public_visible
  ON public.segments (position)
  WHERE is_draft = false AND is_indexed = true;

-- Comentários documentando a regra de negócio (visível no schema)
COMMENT ON COLUMN public.categories.is_draft IS
  'Rascunho. Só fica visível ao público (sitemap/SEO/listagens) quando is_draft=false AND is_indexed=true.';
COMMENT ON COLUMN public.occasions.is_draft IS
  'Rascunho. Só fica visível ao público (sitemap/SEO/listagens) quando is_draft=false AND is_indexed=true.';
COMMENT ON COLUMN public.segments.is_draft IS
  'Rascunho. Só fica visível ao público (sitemap/SEO/listagens) quando is_draft=false AND is_indexed=true.';