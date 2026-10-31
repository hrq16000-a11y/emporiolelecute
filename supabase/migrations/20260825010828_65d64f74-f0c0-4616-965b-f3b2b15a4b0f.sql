DROP TRIGGER IF EXISTS trg_occasions_mark_sitemap ON public.occasions;
CREATE TRIGGER trg_occasions_mark_sitemap
AFTER INSERT OR DELETE OR UPDATE ON public.occasions
FOR EACH STATEMENT EXECUTE FUNCTION public.mark_sitemap_dirty();