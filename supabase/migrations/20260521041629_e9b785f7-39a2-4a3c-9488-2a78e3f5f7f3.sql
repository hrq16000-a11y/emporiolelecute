
-- 1) customers
CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text,
  phone text,
  whatsapp text,
  city text,
  state text,
  source text,
  status text NOT NULL DEFAULT 'active',
  tags text[] DEFAULT '{}'::text[],
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX customers_email_uniq ON public.customers (lower(email)) WHERE email IS NOT NULL;
CREATE INDEX customers_phone_idx ON public.customers (phone) WHERE phone IS NOT NULL;
CREATE INDEX customers_whatsapp_idx ON public.customers (whatsapp) WHERE whatsapp IS NOT NULL;
CREATE INDEX customers_name_trgm ON public.customers USING gin (name gin_trgm_ops);
CREATE TRIGGER customers_updated_at BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "customers_admin_all" ON public.customers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 2) visitors
CREATE TABLE public.visitors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id text NOT NULL UNIQUE,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  whatsapp_phone text,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at  timestamptz NOT NULL DEFAULT now(),
  ip inet, ip_country text, ip_region text, ip_city text,
  ip_lat numeric, ip_lon numeric, ip_isp text, ip_asn text, ip_timezone text,
  user_agent text, device_type text, os_name text, os_version text,
  browser_name text, browser_version text, device_brand text, device_model text,
  screen_w int, screen_h int, viewport_w int, viewport_h int,
  pixel_ratio numeric, color_depth int, language text, languages text[],
  timezone text, touch_support boolean,
  gps_lat numeric, gps_lon numeric, gps_accuracy numeric, gps_captured_at timestamptz,
  first_referrer text, first_landing_path text,
  utm_source text, utm_medium text, utm_campaign text, utm_term text, utm_content text,
  total_pageviews int NOT NULL DEFAULT 0,
  total_sessions  int NOT NULL DEFAULT 0,
  total_time_seconds int NOT NULL DEFAULT 0,
  consent_status text NOT NULL DEFAULT 'pending',
  consent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX visitors_last_seen_idx ON public.visitors (last_seen_at DESC);
CREATE INDEX visitors_customer_id_idx ON public.visitors (customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX visitors_whatsapp_idx ON public.visitors (whatsapp_phone) WHERE whatsapp_phone IS NOT NULL;
CREATE INDEX visitors_ip_idx ON public.visitors (ip);
CREATE TRIGGER visitors_updated_at BEFORE UPDATE ON public.visitors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
ALTER TABLE public.visitors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "visitors_admin_read" ON public.visitors FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 3) visitor_sessions
CREATE TABLE public.visitor_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id text NOT NULL REFERENCES public.visitors(visitor_id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at   timestamptz,
  duration_seconds int NOT NULL DEFAULT 0,
  pages_count int NOT NULL DEFAULT 0,
  ip inet, landing_path text, referrer text,
  utm_source text, utm_medium text, utm_campaign text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX visitor_sessions_visitor_idx ON public.visitor_sessions (visitor_id, started_at DESC);
ALTER TABLE public.visitor_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "visitor_sessions_admin_read" ON public.visitor_sessions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 4) visitor_pageviews
CREATE TABLE public.visitor_pageviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id text NOT NULL REFERENCES public.visitors(visitor_id) ON DELETE CASCADE,
  session_id uuid REFERENCES public.visitor_sessions(id) ON DELETE SET NULL,
  path text NOT NULL,
  title text,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  referrer text,
  time_on_page_seconds int NOT NULL DEFAULT 0,
  scroll_depth_pct int,
  viewed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX visitor_pageviews_visitor_idx ON public.visitor_pageviews (visitor_id, viewed_at DESC);
CREATE INDEX visitor_pageviews_product_idx ON public.visitor_pageviews (product_id) WHERE product_id IS NOT NULL;
CREATE INDEX visitor_pageviews_path_idx ON public.visitor_pageviews (path);
ALTER TABLE public.visitor_pageviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "visitor_pageviews_admin_read" ON public.visitor_pageviews FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 5) cookie_consents
CREATE TABLE public.cookie_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id text NOT NULL,
  accepted boolean NOT NULL,
  categories jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip inet, user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX cookie_consents_visitor_idx ON public.cookie_consents (visitor_id, created_at DESC);
ALTER TABLE public.cookie_consents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cookie_consents_admin_read" ON public.cookie_consents FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 6) View customer_overview
CREATE OR REPLACE VIEW public.customer_overview AS
SELECT
  c.id, c.name, c.email, c.phone, c.whatsapp, c.city, c.state,
  c.status, c.tags, c.source, c.notes, c.created_at, c.updated_at,
  COALESCE(o.total_orders, 0)  AS total_orders,
  COALESCE(o.total_spent,  0)  AS total_spent,
  o.last_order_at,
  COALESCE(v.visit_count, 0)   AS visit_count,
  v.last_seen_at
FROM public.customers c
LEFT JOIN (
  SELECT lower(customer_email) AS email,
         count(*) AS total_orders, sum(total) AS total_spent,
         max(created_at) AS last_order_at
  FROM public.orders
  WHERE customer_email IS NOT NULL
  GROUP BY lower(customer_email)
) o ON o.email = lower(c.email)
LEFT JOIN (
  SELECT customer_id, count(*) AS visit_count, max(last_seen_at) AS last_seen_at
  FROM public.visitors
  WHERE customer_id IS NOT NULL
  GROUP BY customer_id
) v ON v.customer_id = c.id;
