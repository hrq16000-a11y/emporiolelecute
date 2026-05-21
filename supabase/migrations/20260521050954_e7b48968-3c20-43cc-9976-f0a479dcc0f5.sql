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

  -- Proteção absoluta: o papel de admin nunca pode ser removido
  IF _action = 'remove' AND v_role = 'admin' THEN
    RAISE EXCEPTION 'O papel de admin não pode ser removido. Administradores mantêm acesso total permanentemente.';
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
    VALUES (v_caller, v_caller_email, _user_id, v_target_email, v_role::text, 'success',
            'Papel "'||v_role::text||'" removido via painel de usuários.');
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;