-- 1) Log persistente de alertas de SEO (e-mail)
CREATE TABLE IF NOT EXISTS public.seo_alert_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel text NOT NULL,
  target text NOT NULL,
  reason text NOT NULL,
  urls jsonb NOT NULL DEFAULT '[]'::jsonb,
  extra jsonb NOT NULL DEFAULT '{}'::jsonb,
  email_to text,
  sent boolean NOT NULL DEFAULT false,
  outcome text NOT NULL DEFAULT 'unknown',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.seo_alert_log TO authenticated;
GRANT ALL ON public.seo_alert_log TO service_role;
ALTER TABLE public.seo_alert_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view seo alert log" ON public.seo_alert_log;
CREATE POLICY "Admins can view seo alert log" ON public.seo_alert_log
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_seo_alert_log_created ON public.seo_alert_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_seo_alert_log_channel ON public.seo_alert_log (channel, created_at DESC);

-- 2) Snapshots diários do Google Search Console (série histórica)
CREATE TABLE IF NOT EXISTS public.seo_gsc_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date date NOT NULL,
  site_url text NOT NULL,
  page_type text NOT NULL DEFAULT 'all',
  clicks integer NOT NULL DEFAULT 0,
  impressions integer NOT NULL DEFAULT 0,
  ctr numeric NOT NULL DEFAULT 0,
  position numeric NOT NULL DEFAULT 0,
  indexed_count integer NOT NULL DEFAULT 0,
  excluded_count integer NOT NULL DEFAULT 0,
  top_queries jsonb NOT NULL DEFAULT '[]'::jsonb,
  coverage_issues jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (snapshot_date, site_url, page_type)
);

GRANT SELECT ON public.seo_gsc_snapshots TO authenticated;
GRANT ALL ON public.seo_gsc_snapshots TO service_role;
ALTER TABLE public.seo_gsc_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view gsc snapshots" ON public.seo_gsc_snapshots;
CREATE POLICY "Admins can view gsc snapshots" ON public.seo_gsc_snapshots
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_seo_gsc_snapshots_date ON public.seo_gsc_snapshots (snapshot_date DESC, page_type);