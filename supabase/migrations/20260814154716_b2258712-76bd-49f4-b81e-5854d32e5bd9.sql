-- Consolida agendamentos duplicados de sitemap (mantém apenas o diário + o guard)
SELECT cron.unschedule('submit-sitemap-weekly');
SELECT cron.unschedule('weekly-sitemap-submission');
SELECT cron.unschedule('submit-sitemap-12h');

-- Reduz frequência de jobs de alto consumo
SELECT cron.alter_job((SELECT jobid FROM cron.job WHERE jobname = 'seo-sitemap-auto-resubmit-15m'), schedule := '7 * * * *');
SELECT cron.alter_job((SELECT jobid FROM cron.job WHERE jobname = 'telemetry-alert-monitor-15m'), schedule := '23 * * * *');
SELECT cron.alter_job((SELECT jobid FROM cron.job WHERE jobname = 'instagram-sync-hourly'), schedule := '0 */6 * * *');
SELECT cron.alter_job((SELECT jobid FROM cron.job WHERE jobname = 'instagram-bulk-refresh-hourly'), schedule := '17 */6 * * *');

-- Validação diária com gate de diff (só reenvia quando algo mudou)
SELECT cron.schedule(
  'seo-daily-guard',
  '30 7 * * *',
  $$
  SELECT net.http_post(
    url := 'https://xfqffqxqiuqauefrrcxn.supabase.co/functions/v1/seo-daily-guard',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT value FROM public.internal_function_secrets WHERE key = 'service_role_key')
    ),
    body := '{"force": false}'::jsonb
  );
  $$
);