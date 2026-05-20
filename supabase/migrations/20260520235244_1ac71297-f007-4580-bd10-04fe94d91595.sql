CREATE OR REPLACE FUNCTION public.audit_system_dump()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v jsonb := '{}'::jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- Tables + RLS status
  v := v || jsonb_build_object('tables', (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'schema', schemaname, 'name', tablename, 'rls_enabled', rowsecurity, 'force_rls', forcerowsecurity
    ) ORDER BY tablename), '[]'::jsonb)
    FROM pg_tables WHERE schemaname = 'public'
  ));

  -- Columns
  v := v || jsonb_build_object('columns', (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'table', table_name, 'column', column_name, 'type', data_type,
      'nullable', is_nullable, 'default', column_default
    ) ORDER BY table_name, ordinal_position), '[]'::jsonb)
    FROM information_schema.columns WHERE table_schema = 'public'
  ));

  -- RLS policies
  v := v || jsonb_build_object('policies', (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'schema', schemaname, 'table', tablename, 'name', policyname,
      'permissive', permissive, 'roles', roles, 'cmd', cmd,
      'using', qual, 'with_check', with_check
    ) ORDER BY tablename, policyname), '[]'::jsonb)
    FROM pg_policies WHERE schemaname = 'public'
  ));

  -- Functions
  v := v || jsonb_build_object('functions', (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'name', p.proname,
      'language', l.lanname,
      'security_definer', p.prosecdef,
      'returns', pg_get_function_result(p.oid),
      'args', pg_get_function_arguments(p.oid)
    ) ORDER BY p.proname), '[]'::jsonb)
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    JOIN pg_language l ON l.oid = p.prolang
    WHERE n.nspname = 'public' AND l.lanname IN ('plpgsql','sql')
  ));

  -- Triggers
  v := v || jsonb_build_object('triggers', (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'name', trigger_name, 'table', event_object_table,
      'event', event_manipulation, 'timing', action_timing, 'action', action_statement
    ) ORDER BY event_object_table, trigger_name), '[]'::jsonb)
    FROM information_schema.triggers WHERE trigger_schema = 'public'
  ));

  -- Indexes
  v := v || jsonb_build_object('indexes', (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'table', tablename, 'name', indexname, 'definition', indexdef
    ) ORDER BY tablename, indexname), '[]'::jsonb)
    FROM pg_indexes WHERE schemaname = 'public'
  ));

  -- Storage buckets
  v := v || jsonb_build_object('storage_buckets', (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', id, 'name', name, 'public', public, 'file_size_limit', file_size_limit,
      'allowed_mime_types', allowed_mime_types, 'created_at', created_at
    ) ORDER BY id), '[]'::jsonb)
    FROM storage.buckets
  ));

  -- Cron jobs
  BEGIN
    v := v || jsonb_build_object('cron_jobs', (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
        'jobid', jobid, 'jobname', jobname, 'schedule', schedule, 'command', command, 'active', active
      ) ORDER BY jobid), '[]'::jsonb)
      FROM cron.job
    ));
  EXCEPTION WHEN OTHERS THEN
    v := v || jsonb_build_object('cron_jobs', '[]'::jsonb);
  END;

  -- User roles
  v := v || jsonb_build_object('user_roles', (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'user_id', ur.user_id, 'role', ur.role, 'email', p.email, 'created_at', ur.created_at
    ) ORDER BY ur.role, p.email), '[]'::jsonb)
    FROM public.user_roles ur
    LEFT JOIN public.profiles p ON p.id = ur.user_id
  ));

  -- Profiles count + sample
  v := v || jsonb_build_object('profiles', (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', id, 'email', email, 'full_name', full_name, 'created_at', created_at
    ) ORDER BY created_at DESC), '[]'::jsonb)
    FROM public.profiles
  ));

  v := v || jsonb_build_object('generated_at', now());
  RETURN v;
END;
$$;

GRANT EXECUTE ON FUNCTION public.audit_system_dump() TO authenticated;