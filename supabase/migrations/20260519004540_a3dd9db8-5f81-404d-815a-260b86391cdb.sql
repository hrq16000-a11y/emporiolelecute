DROP POLICY IF EXISTS "Admins read elo7 review images" ON storage.objects;
DROP POLICY IF EXISTS "Admins write elo7 review images" ON storage.objects;
DROP POLICY IF EXISTS "Admins update elo7 review images" ON storage.objects;
DROP POLICY IF EXISTS "Admins delete elo7 review images" ON storage.objects;
DROP TABLE IF EXISTS public.elo7_reviews_audit CASCADE;