ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS google_product_category text;

UPDATE public.categories SET google_product_category = 'Health & Beauty > Personal Care > Cosmetics > Bath & Body > Bar Soap' WHERE slug = 'sabonetes' AND google_product_category IS NULL;
UPDATE public.categories SET google_product_category = 'Home & Garden > Decor > Home Fragrances > Candles' WHERE slug = 'velas' AND google_product_category IS NULL;
UPDATE public.categories SET google_product_category = 'Health & Beauty > Personal Care > Cosmetics > Bath & Body > Bath Additives' WHERE slug = 'escalda-pes' AND google_product_category IS NULL;
UPDATE public.categories SET google_product_category = 'Home & Garden > Decor > Home Fragrances > Potpourri' WHERE slug = 'saches-perfumados' AND google_product_category IS NULL;

CREATE OR REPLACE FUNCTION public.fill_product_google_category()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (NEW.google_product_category IS NULL OR btrim(NEW.google_product_category) = '')
     AND NEW.category_id IS NOT NULL THEN
    SELECT c.google_product_category INTO NEW.google_product_category
    FROM public.categories c WHERE c.id = NEW.category_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fill_product_google_category ON public.products;
CREATE TRIGGER trg_fill_product_google_category
BEFORE INSERT OR UPDATE OF category_id, google_product_category ON public.products
FOR EACH ROW EXECUTE FUNCTION public.fill_product_google_category();

UPDATE public.products p
SET google_product_category = c.google_product_category
FROM public.categories c
WHERE p.category_id = c.id
  AND c.google_product_category IS NOT NULL
  AND (p.google_product_category IS NULL OR btrim(p.google_product_category) = '');