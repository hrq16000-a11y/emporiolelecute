CREATE TABLE IF NOT EXISTS public.internal_function_secrets (
  name text PRIMARY KEY,
  value text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.internal_function_secrets TO service_role;

ALTER TABLE public.internal_function_secrets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "internal_function_secrets_no_public_access" ON public.internal_function_secrets;
CREATE POLICY "internal_function_secrets_no_public_access"
  ON public.internal_function_secrets
  FOR ALL
  TO authenticated, anon
  USING (false)
  WITH CHECK (false);

INSERT INTO public.internal_function_secrets (name, value)
VALUES (
  'notify_admins',
  replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
)
ON CONFLICT (name) DO NOTHING;

CREATE OR REPLACE FUNCTION public.notify_admins_on_access_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_url    text;
  v_anon   text;
  v_email  text;
  v_secret text;
BEGIN
  IF NEW.status <> 'pending' THEN RETURN NEW; END IF;

  SELECT email INTO v_email FROM public.profiles WHERE id = NEW.user_id;
  SELECT value INTO v_secret FROM public.internal_function_secrets WHERE name = 'notify_admins';

  BEGIN
    v_url  := current_setting('app.supabase_url', true);
    v_anon := current_setting('app.supabase_anon_key', true);
    IF v_url IS NOT NULL AND v_anon IS NOT NULL THEN
      PERFORM net.http_post(
        url     := v_url || '/functions/v1/notify-admins-new-request',
        headers := jsonb_build_object(
          'Content-Type','application/json',
          'Authorization','Bearer ' || v_anon,
          'x-internal-secret', coalesce(v_secret, '')
        ),
        body    := jsonb_build_object(
          'user_id',      NEW.user_id,
          'email',        coalesce(v_email, NEW.user_email_snapshot),
          'requested_at', NEW.requested_at,
          'request_id',   NEW.id
        )
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN NEW;
END;
$function$;

DROP POLICY IF EXISTS "shipping_quote_cache_no_public_access" ON public.shipping_quote_cache;
CREATE POLICY "shipping_quote_cache_no_public_access"
  ON public.shipping_quote_cache
  FOR ALL
  TO authenticated, anon
  USING (false)
  WITH CHECK (false);