CREATE TABLE IF NOT EXISTS public.seo_submission_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel text NOT NULL CHECK (channel IN ('gsc','indexnow')),
  status text NOT NULL,
  ok boolean NOT NULL DEFAULT false,
  url_count integer NOT NULL DEFAULT 0,
  target text,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_seo_submission_log_created ON public.seo_submission_log (created_at DESC);
GRANT SELECT ON public.seo_submission_log TO authenticated;
GRANT ALL ON public.seo_submission_log TO service_role;
ALTER TABLE public.seo_submission_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view seo submission log" ON public.seo_submission_log
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.merchant_feed_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_count integer NOT NULL DEFAULT 0,
  errors integer NOT NULL DEFAULT 0,
  warnings integer NOT NULL DEFAULT 0,
  ready integer NOT NULL DEFAULT 0,
  checksum text,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_merchant_feed_snapshots_created ON public.merchant_feed_snapshots (created_at DESC);
GRANT SELECT ON public.merchant_feed_snapshots TO authenticated;
GRANT ALL ON public.merchant_feed_snapshots TO service_role;
ALTER TABLE public.merchant_feed_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view merchant feed snapshots" ON public.merchant_feed_snapshots
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS seo_title text;