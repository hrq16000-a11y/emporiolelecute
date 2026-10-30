
-- 1) Log de notificações de status
CREATE TABLE IF NOT EXISTS public.order_status_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL,
  order_code TEXT NOT NULL,
  status TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'email',
  success BOOLEAN NOT NULL DEFAULT false,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_osn_order ON public.order_status_notifications(order_id, status);

GRANT SELECT ON public.order_status_notifications TO authenticated;
GRANT ALL ON public.order_status_notifications TO service_role;

ALTER TABLE public.order_status_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view order status notifications" ON public.order_status_notifications;
CREATE POLICY "Admins can view order status notifications"
ON public.order_status_notifications FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 2) Segredo interno para o trigger chamar a edge function
INSERT INTO public.internal_function_secrets (name, value)
SELECT 'notify_order_status', encode(gen_random_bytes(32), 'hex')
WHERE NOT EXISTS (
  SELECT 1 FROM public.internal_function_secrets WHERE name = 'notify_order_status'
);

-- 3) Trigger: dispara e-mail quando o status muda
CREATE OR REPLACE FUNCTION public.notify_order_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_secret TEXT;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  SELECT value INTO v_secret FROM public.internal_function_secrets WHERE name = 'notify_order_status';
  IF v_secret IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := 'https://xfqffqxqiuqauefrrcxn.supabase.co/functions/v1/notify-order-status',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-internal-key', v_secret),
    body := jsonb_build_object(
      'order_code', NEW.order_code,
      'status', NEW.status,
      'previous_status', OLD.status
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_order_status_change ON public.orders;
CREATE TRIGGER trg_notify_order_status_change
AFTER UPDATE OF status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.notify_order_status_change();

-- 4) Posts reais do Instagram (@emporiolelecute)
INSERT INTO public.instagram_posts (image_url, alt_text, post_url, position, is_visible, shortcode)
SELECT * FROM (VALUES
  ('https://xfqffqxqiuqauefrrcxn.supabase.co/storage/v1/object/public/product-images/instagram/ig-1.jpg', 'Lembrancinha artesanal tema carrinho azul - Empório LeleCute', 'https://www.instagram.com/p/DbrcC2lR8fL/', 1, true, 'DbrcC2lR8fL'),
  ('https://xfqffqxqiuqauefrrcxn.supabase.co/storage/v1/object/public/product-images/instagram/ig-2.jpg', 'Lembrancinhas personalizadas tema astronauta - Empório LeleCute', 'https://www.instagram.com/p/DbeZRsGDYZK/', 2, true, 'DbeZRsGDYZK'),
  ('https://xfqffqxqiuqauefrrcxn.supabase.co/storage/v1/object/public/product-images/instagram/ig-3.jpg', 'Detalhes de lembrancinhas artesanais - Empório LeleCute', 'https://www.instagram.com/p/DbWxuZIAUyu/', 3, true, 'DbWxuZIAUyu'),
  ('https://xfqffqxqiuqauefrrcxn.supabase.co/storage/v1/object/public/product-images/instagram/ig-4.jpg', 'Caixinhas de lembrancinhas prontas para presente - Empório LeleCute', 'https://www.instagram.com/p/DbHHszwPI0f/', 4, true, 'DbHHszwPI0f'),
  ('https://xfqffqxqiuqauefrrcxn.supabase.co/storage/v1/object/public/product-images/instagram/ig-5.jpg', 'Sabonetes artesanais tema safari para festa infantil - Empório LeleCute', 'https://www.instagram.com/p/DbCAb-emXhm/', 5, true, 'DbCAb-emXhm'),
  ('https://xfqffqxqiuqauefrrcxn.supabase.co/storage/v1/object/public/product-images/instagram/ig-6.jpg', 'Lembrancinhas de primeiro aniversário - Empório LeleCute', 'https://www.instagram.com/p/Da1eXySx44N/', 6, true, 'Da1eXySx44N')
) AS v(image_url, alt_text, post_url, position, is_visible, shortcode)
WHERE NOT EXISTS (SELECT 1 FROM public.instagram_posts);
