-- Adiciona valores faltantes no enum app_role
-- O código (save_product_full, AdminUsers, RPCs de auditoria) usa 'editor' e 'customer'
-- mas o enum só tinha 'admin' e 'user'. Sem IF NOT EXISTS para ser idempotente em re-execuções.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'app_role' AND e.enumlabel = 'editor'
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'editor';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'app_role' AND e.enumlabel = 'customer'
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'customer';
  END IF;
END$$;