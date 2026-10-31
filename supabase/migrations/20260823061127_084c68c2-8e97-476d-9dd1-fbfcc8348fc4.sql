CREATE TABLE public.wishlist_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  token text NOT NULL UNIQUE,
  title text,
  is_public boolean NOT NULL DEFAULT true,
  product_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.wishlist_shares TO authenticated;
GRANT SELECT ON public.wishlist_shares TO anon;
GRANT ALL ON public.wishlist_shares TO service_role;

ALTER TABLE public.wishlist_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their wishlist share"
  ON public.wishlist_shares FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Public wishlist shares are readable"
  ON public.wishlist_shares FOR SELECT
  TO anon, authenticated
  USING (is_public = true);

CREATE INDEX idx_wishlist_shares_token ON public.wishlist_shares(token);

CREATE TRIGGER trg_wishlist_shares_updated
  BEFORE UPDATE ON public.wishlist_shares
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();