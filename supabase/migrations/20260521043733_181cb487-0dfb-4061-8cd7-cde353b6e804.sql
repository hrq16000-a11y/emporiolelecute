-- ============================================================
-- 1) Listar todos os usuários com papéis + vínculo com clientes
-- ============================================================
CREATE OR REPLACE FUNCTION public.list_all_users(_search text DEFAULT NULL, _role text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_search text := nullif(trim(coalesce(_search,'')), '');
  v_role   text := nullif(_role, 'all');
  v_rows   jsonb;
BEGIN
  IF v_caller IS NULL OR NOT public.has_role(v_caller, 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.created_at DESC), '[]'::jsonb)
    INTO v_rows
  FROM (
    SELECT
      p.id              AS user_id,
      p.email,
      p.full_name,
      p.created_at,
      u.last_sign_in_at,
      u.email_confirmed_at,
      coalesce(
        (SELECT array_agg(ur.role::text ORDER BY ur.role::text)
           FROM public.user_roles ur WHERE ur.user_id = p.id),
        '{}'::text[]
      ) AS roles,
      (SELECT c.id FROM public.customers c
        WHERE lower(coalesce(c.email,'')) = lower(coalesce(p.email,''))
        LIMIT 1) AS linked_customer_id,
      (SELECT count(*) FROM public.visitors v
        WHERE lower(coalesce(v.whatsapp_phone,'')) <> ''
          AND v.customer_id IS NOT NULL
          AND v.customer_id IN (
            SELECT id FROM public.customers c
             WHERE lower(coalesce(c.email,'')) = lower(coalesce(p.email,''))
          )
      ) AS linked_visitors
    FROM public.profiles p
    LEFT JOIN auth.users u ON u.id = p.id
    WHERE (v_search IS NULL OR
           lower(coalesce(p.email,''))     LIKE '%'||lower(v_search)||'%' OR
           lower(coalesce(p.full_name,'')) LIKE '%'||lower(v_search)||'%')
      AND (
        v_role IS NULL OR
        (v_role = 'none' AND NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p.id))
        OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p.id AND ur.role::text = v_role)
      )
  ) t;

  RETURN jsonb_build_object('rows', v_rows);
END $$;

-- ============================================================
-- 2) Atualizar papel (adicionar/remover)
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_user_role(_user_id uuid, _role text, _action text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_caller_email text;
  v_target_email text;
  v_role public.app_role;
BEGIN
  IF v_caller IS NULL OR NOT public.has_role(v_caller, 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'user_id obrigatório';
  END IF;
  IF _action NOT IN ('add','remove') THEN
    RAISE EXCEPTION 'action inválida (use add ou remove)';
  END IF;

  BEGIN
    v_role := _role::public.app_role;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'role inválida: %', _role;
  END;

  IF _action = 'remove' AND v_role = 'admin' AND _user_id = v_caller THEN
    RAISE EXCEPTION 'Você não pode remover seu próprio papel de admin.';
  END IF;

  SELECT email INTO v_caller_email FROM public.profiles WHERE id = v_caller;
  SELECT email INTO v_target_email FROM public.profiles WHERE id = _user_id;
  IF v_target_email IS NULL THEN
    RAISE EXCEPTION 'Usuário não encontrado';
  END IF;

  IF _action = 'add' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (_user_id, v_role)
    ON CONFLICT (user_id, role) DO NOTHING;

    INSERT INTO public.role_promotion_audit
      (promoted_by, promoted_by_email, target_user_id, target_email, role, status, message)
    VALUES (v_caller, v_caller_email, _user_id, v_target_email, v_role::text, 'success',
            'Papel "'||v_role::text||'" adicionado via painel de usuários.');
  ELSE
    DELETE FROM public.user_roles WHERE user_id = _user_id AND role = v_role;

    INSERT INTO public.role_promotion_audit
      (promoted_by, promoted_by_email, target_user_id, target_email, role, status, message)
    VALUES (v_caller, v_caller_email, _user_id, v_target_email, v_role::text, 'revoked',
            'Papel "'||v_role::text||'" removido via painel de usuários.');
  END IF;

  RETURN jsonb_build_object('success', true);
END $$;