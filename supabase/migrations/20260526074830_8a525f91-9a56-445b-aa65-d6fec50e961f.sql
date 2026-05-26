ALTER TABLE public.shipping_settings ADD COLUMN IF NOT EXISTS free_shipping_threshold numeric NOT NULL DEFAULT 299;

-- Popula com valor existente de store_settings se houver
DO $$
DECLARE
  existing numeric;
BEGIN
  SELECT (value->>'free_shipping_threshold')::numeric
  INTO existing
  FROM public.store_settings
  WHERE key = 'shipping_policy'
  AND value->>'free_shipping_threshold' IS NOT NULL
  AND (value->>'free_shipping_threshold')::numeric > 0
  LIMIT 1;
  
  IF existing IS NOT NULL THEN
    UPDATE public.shipping_settings
    SET free_shipping_threshold = existing
    WHERE free_shipping_threshold = 299;
  END IF;
END $$;