CREATE TABLE public.media_backup_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ran_at timestamptz NOT NULL DEFAULT now(),
  total_assets integer NOT NULL DEFAULT 0,
  exported_count integer NOT NULL DEFAULT 0,
  verified_count integer NOT NULL DEFAULT 0,
  coverage_pct numeric(5,2) NOT NULL DEFAULT 0,
  bytes_total bigint NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'partial',
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.media_backup_runs TO authenticated;
GRANT ALL ON public.media_backup_runs TO service_role;

ALTER TABLE public.media_backup_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view media backup runs"
  ON public.media_backup_runs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_media_backup_runs_updated_at
  BEFORE UPDATE ON public.media_backup_runs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Harden GC: only delete archived assets that are backed up AND integrity-verified (checksum present)
CREATE OR REPLACE FUNCTION public.media_gc_candidates(_min_age_days integer DEFAULT 7)
 RETURNS TABLE(img_ref text, bucket text, storage_path text, backed_up_at timestamp with time zone)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT img_ref, bucket, storage_path, backed_up_at
  FROM public.media_assets
  WHERE status = 'archived'
    AND backed_up_at IS NOT NULL
    AND checksum_sha256 IS NOT NULL
    AND last_verified_at < now() - make_interval(days => greatest(_min_age_days, 1))
$function$;