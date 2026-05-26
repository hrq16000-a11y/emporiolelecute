CREATE POLICY "Public can read shipping_settings"
ON public.shipping_settings
FOR SELECT
TO anon, authenticated
USING (true);