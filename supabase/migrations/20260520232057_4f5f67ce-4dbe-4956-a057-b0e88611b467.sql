-- Fix: has_role precisa de EXECUTE para anon/authenticated, senão RLS quebra em cascata
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO anon, authenticated, service_role;