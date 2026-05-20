CREATE TABLE public.product_faqs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  question text NOT NULL,
  answer text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_product_faqs_product ON public.product_faqs(product_id, position) WHERE is_active;

ALTER TABLE public.product_faqs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view active product faqs"
ON public.product_faqs FOR SELECT
USING (is_active = true);

CREATE POLICY "Admins can manage product faqs"
ON public.product_faqs FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_product_faqs_updated_at
BEFORE UPDATE ON public.product_faqs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();