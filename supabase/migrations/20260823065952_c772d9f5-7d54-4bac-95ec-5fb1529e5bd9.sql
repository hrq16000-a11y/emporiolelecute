-- 1) Fila de processamento assíncrono de imagens
CREATE TABLE IF NOT EXISTS public.image_processing_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket text NOT NULL DEFAULT 'product-images',
  storage_path text NOT NULL,
  public_url text,
  status text NOT NULL DEFAULT 'pending',
  attempts int NOT NULL DEFAULT 0,
  error text,
  source_bytes bigint,
  output_bytes bigint,
  width int,
  height int,
  placeholder text,
  variants jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

GRANT SELECT, INSERT, UPDATE ON public.image_processing_jobs TO authenticated;
GRANT ALL ON public.image_processing_jobs TO service_role;
ALTER TABLE public.image_processing_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins/editors manage image jobs"
ON public.image_processing_jobs FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'editor'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'editor'));

CREATE INDEX IF NOT EXISTS idx_image_jobs_status ON public.image_processing_jobs (status, created_at);

CREATE TRIGGER trg_image_jobs_updated_at
BEFORE UPDATE ON public.image_processing_jobs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.image_processing_jobs;
ALTER TABLE public.image_processing_jobs REPLICA IDENTITY FULL;

-- 2) Scan periódico de vulnerabilidades
CREATE TABLE IF NOT EXISTS public.security_scan_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL DEFAULT 'osv',
  trigger text NOT NULL DEFAULT 'cron',
  status text NOT NULL DEFAULT 'ok',
  packages_scanned int NOT NULL DEFAULT 0,
  total_findings int NOT NULL DEFAULT 0,
  critical_count int NOT NULL DEFAULT 0,
  high_count int NOT NULL DEFAULT 0,
  moderate_count int NOT NULL DEFAULT 0,
  low_count int NOT NULL DEFAULT 0,
  regression boolean NOT NULL DEFAULT false,
  alert_sent boolean NOT NULL DEFAULT false,
  alert_reason text,
  findings jsonb NOT NULL DEFAULT '[]'::jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.security_scan_runs TO authenticated;
GRANT ALL ON public.security_scan_runs TO service_role;
ALTER TABLE public.security_scan_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read security scans"
ON public.security_scan_runs FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_security_scan_created ON public.security_scan_runs (created_at DESC);

-- 3) Histórico de relatórios de Web Vitals (Lighthouse)
CREATE TABLE IF NOT EXISTS public.web_vitals_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  base_url text,
  notes text,
  pages jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, DELETE ON public.web_vitals_reports TO authenticated;
GRANT ALL ON public.web_vitals_reports TO service_role;
ALTER TABLE public.web_vitals_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage web vitals reports"
ON public.web_vitals_reports FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_web_vitals_reports_created ON public.web_vitals_reports (created_at DESC);