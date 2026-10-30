REVOKE EXECUTE ON FUNCTION public.track_product_version() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bump_search_cache_version() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.revert_product_version(uuid, text[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.revert_product_version(uuid, text[]) TO authenticated;