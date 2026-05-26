CREATE OR REPLACE FUNCTION public.mark_visitor_as_lead(_visitor_id uuid, _trigger text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.visitors%ROWTYPE;
BEGIN
  IF _visitor_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'missing_visitor_id');
  END IF;

  SELECT * INTO v_row FROM public.visitors WHERE visitor_id = _visitor_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'visitor_not_found');
  END IF;

  IF v_row.is_bot THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'bot_ignored');
  END IF;

  IF v_row.lead_status IN ('customer','lead') THEN
    RETURN jsonb_build_object('ok', true, 'noop', true, 'status', v_row.lead_status);
  END IF;

  UPDATE public.visitors
     SET lead_status = 'lead',
         lead_promoted_at = COALESCE(lead_promoted_at, now()),
         lead_trigger = COALESCE(_trigger, 'unknown')
   WHERE visitor_id = _visitor_id;

  RETURN jsonb_build_object('ok', true, 'status', 'lead', 'trigger', _trigger);
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_visitor_as_lead(uuid, text) TO anon, authenticated;