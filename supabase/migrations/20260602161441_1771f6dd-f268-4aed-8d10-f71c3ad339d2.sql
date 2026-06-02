DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sandbox_exec') THEN
    GRANT SELECT ON public.media_assets TO sandbox_exec;
  END IF;
END $$;