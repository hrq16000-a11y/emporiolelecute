
CREATE TABLE IF NOT EXISTS public.data_deletion_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text,
  whatsapp text,
  visitor_id text,
  reason text,
  status text NOT NULL DEFAULT 'pending',
  internal_notes text,
  ip text,
  user_agent text,
  processed_at timestamptz,
  processed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ddr_status ON public.data_deletion_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ddr_email ON public.data_deletion_requests(lower(email));

ALTER TABLE public.data_deletion_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin lê solicitações de exclusão"
ON public.data_deletion_requests FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin'));

CREATE POLICY "Admin atualiza solicitações de exclusão"
ON public.data_deletion_requests FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(),'admin'))
WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "Admin apaga solicitações de exclusão"
ON public.data_deletion_requests FOR DELETE TO authenticated
USING (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_ddr_updated_at
BEFORE UPDATE ON public.data_deletion_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
