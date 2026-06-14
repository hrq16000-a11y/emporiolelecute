-- Allow admins to LIST/READ objects in the product-images bucket.
-- A public bucket serves files via CDN, but the Storage list() API still
-- requires an explicit SELECT policy on storage.objects. Without it, the
-- admin "image library" picker comes back empty.
CREATE POLICY "Admins can list product images"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'product-images'
    AND has_role(auth.uid(), 'admin'::app_role)
  );