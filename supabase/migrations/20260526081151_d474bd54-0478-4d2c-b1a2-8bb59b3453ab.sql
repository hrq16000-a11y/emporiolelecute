CREATE OR REPLACE FUNCTION public.save_product_full(_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_uid          uuid := auth.uid();
  v_is_admin     boolean;
  v_is_editor    boolean;
  v_id           uuid;
  v_expected     timestamptz;
  v_product      jsonb := coalesce(_payload->'product', '{}'::jsonb);
  v_occ_ids      uuid[] := COALESCE(ARRAY(SELECT (jsonb_array_elements_text(coalesce(_payload->'occasion_ids','[]'::jsonb)))::uuid), '{}'::uuid[]);
  v_tag_ids      uuid[] := COALESCE(ARRAY(SELECT (jsonb_array_elements_text(coalesce(_payload->'tag_ids','[]'::jsonb)))::uuid), '{}'::uuid[]);
  v_seg_ids      uuid[] := COALESCE(ARRAY(SELECT (jsonb_array_elements_text(coalesce(_payload->'segment_ids','[]'::jsonb)))::uuid), '{}'::uuid[]);
  v_row          public.products%ROWTYPE;
  v_req_ship     boolean;
  v_weight       numeric;
  v_len          numeric;
  v_wid          numeric;
  v_hei          numeric;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  v_is_admin  := public.has_role(v_uid, 'admin');
  v_is_editor := public.has_role(v_uid, 'editor');
  IF NOT (v_is_admin OR v_is_editor) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;

  IF coalesce(length(v_product->>'name'),0) = 0 THEN RAISE EXCEPTION 'Nome obrigatório' USING ERRCODE = '23514'; END IF;
  IF coalesce(length(v_product->>'slug'),0) = 0 THEN RAISE EXCEPTION 'Slug obrigatório' USING ERRCODE = '23514'; END IF;
  IF (v_product->>'price') IS NULL OR (v_product->>'price')::numeric < 0 THEN RAISE EXCEPTION 'Preço inválido' USING ERRCODE = '23514'; END IF;

  -- Validação: produtos com entrega física exigem peso e dimensões válidos.
  v_req_ship := COALESCE((v_product->>'requires_shipping')::boolean, true);
  v_weight   := NULLIF(v_product->>'weight','')::numeric;
  v_len      := NULLIF(v_product->>'length_cm','')::numeric;
  v_wid      := NULLIF(v_product->>'width_cm','')::numeric;
  v_hei      := NULLIF(v_product->>'height_cm','')::numeric;

  IF v_req_ship THEN
    IF v_weight IS NULL OR v_weight <= 0
       OR v_len IS NULL OR v_len <= 0
       OR v_wid IS NULL OR v_wid <= 0
       OR v_hei IS NULL OR v_hei <= 0 THEN
      RAISE EXCEPTION 'Produtos com entrega física exigem peso e dimensões (>0)'
        USING ERRCODE = '23514', HINT = 'requires_shipping_dims';
    END IF;
  END IF;

  v_id       := NULLIF(_payload->>'id','')::uuid;
  v_expected := NULLIF(_payload->>'expected_updated_at','')::timestamptz;

  IF v_id IS NULL THEN
    INSERT INTO public.products (
      name, slug, description, long_description, price, original_price,
      min_quantity, pix_discount, production_days, weight, category_id,
      badge, rating, images, features, keywords, is_active,
      personalization_enabled, personalization_label, personalization_placeholder,
      google_product_category, editorial_content, featured_weight, production_speed,
      pdp_badge_override, show_quick_summary, show_min_quantity,
      length_cm, width_cm, height_cm, requires_shipping,
      external_ref
    ) VALUES (
      v_product->>'name',
      v_product->>'slug',
      NULLIF(v_product->>'description',''),
      NULLIF(v_product->>'long_description',''),
      (v_product->>'price')::numeric,
      NULLIF(v_product->>'original_price','')::numeric,
      COALESCE((v_product->>'min_quantity')::int, 1),
      COALESCE((v_product->>'pix_discount')::int, 7),
      COALESCE((v_product->>'production_days')::int, 7),
      v_weight,
      NULLIF(v_product->>'category_id','')::uuid,
      NULLIF(v_product->>'badge',''),
      COALESCE((v_product->>'rating')::numeric, 5.0),
      COALESCE(ARRAY(SELECT jsonb_array_elements_text(v_product->'images')), '{}'::text[]),
      COALESCE(ARRAY(SELECT jsonb_array_elements_text(v_product->'features')), '{}'::text[]),
      COALESCE(ARRAY(SELECT jsonb_array_elements_text(v_product->'keywords')), '{}'::text[]),
      COALESCE((v_product->>'is_active')::boolean, true),
      COALESCE((v_product->>'personalization_enabled')::boolean, true),
      NULLIF(v_product->>'personalization_label',''),
      NULLIF(v_product->>'personalization_placeholder',''),
      NULLIF(v_product->>'google_product_category',''),
      NULLIF(v_product->>'editorial_content',''),
      COALESCE((v_product->>'featured_weight')::int, 0),
      NULLIF(v_product->>'production_speed',''),
      CASE WHEN v_product ? 'pdp_badge_override' AND v_product->'pdp_badge_override' <> 'null'::jsonb
           THEN v_product->'pdp_badge_override' ELSE NULL END,
      COALESCE((v_product->>'show_quick_summary')::boolean, false),
      COALESCE((v_product->>'show_min_quantity')::boolean, false),
      v_len,
      v_wid,
      v_hei,
      v_req_ship,
      ''
    )
    RETURNING * INTO v_row;
  ELSE
    IF v_expected IS NULL THEN RAISE EXCEPTION 'expected_updated_at obrigatório em update' USING ERRCODE = '23514'; END IF;

    UPDATE public.products SET
      name                          = v_product->>'name',
      slug                          = v_product->>'slug',
      description                   = NULLIF(v_product->>'description',''),
      long_description              = NULLIF(v_product->>'long_description',''),
      price                         = (v_product->>'price')::numeric,
      original_price                = NULLIF(v_product->>'original_price','')::numeric,
      min_quantity                  = COALESCE((v_product->>'min_quantity')::int, 1),
      pix_discount                  = COALESCE((v_product->>'pix_discount')::int, 7),
      production_days               = COALESCE((v_product->>'production_days')::int, 7),
      weight                        = v_weight,
      category_id                   = NULLIF(v_product->>'category_id','')::uuid,
      badge                         = NULLIF(v_product->>'badge',''),
      rating                        = COALESCE((v_product->>'rating')::numeric, 5.0),
      images                        = COALESCE(ARRAY(SELECT jsonb_array_elements_text(v_product->'images')), '{}'::text[]),
      features                      = COALESCE(ARRAY(SELECT jsonb_array_elements_text(v_product->'features')), '{}'::text[]),
      keywords                      = COALESCE(ARRAY(SELECT jsonb_array_elements_text(v_product->'keywords')), '{}'::text[]),
      is_active                     = COALESCE((v_product->>'is_active')::boolean, true),
      personalization_enabled       = COALESCE((v_product->>'personalization_enabled')::boolean, true),
      personalization_label         = NULLIF(v_product->>'personalization_label',''),
      personalization_placeholder   = NULLIF(v_product->>'personalization_placeholder',''),
      google_product_category       = NULLIF(v_product->>'google_product_category',''),
      editorial_content             = NULLIF(v_product->>'editorial_content',''),
      featured_weight               = COALESCE((v_product->>'featured_weight')::int, 0),
      production_speed              = NULLIF(v_product->>'production_speed',''),
      pdp_badge_override            = CASE WHEN v_product ? 'pdp_badge_override' AND v_product->'pdp_badge_override' <> 'null'::jsonb
                                            THEN v_product->'pdp_badge_override' ELSE NULL END,
      show_quick_summary            = COALESCE((v_product->>'show_quick_summary')::boolean, false),
      show_min_quantity             = COALESCE((v_product->>'show_min_quantity')::boolean, false),
      length_cm                     = v_len,
      width_cm                      = v_wid,
      height_cm                     = v_hei,
      requires_shipping             = v_req_ship
    WHERE id = v_id
      AND updated_at = v_expected
    RETURNING * INTO v_row;

    IF NOT FOUND THEN
      IF NOT EXISTS (SELECT 1 FROM public.products WHERE id = v_id) THEN
        RAISE EXCEPTION 'Produto não encontrado' USING ERRCODE = '23503';
      END IF;
      RAISE EXCEPTION 'stale_version' USING ERRCODE = '40001', HINT = 'stale_version';
    END IF;
  END IF;

  DELETE FROM public.product_occasions WHERE product_id = v_row.id AND NOT (occasion_id = ANY(v_occ_ids));
  INSERT INTO public.product_occasions (product_id, occasion_id)
  SELECT v_row.id, x FROM unnest(v_occ_ids) x ON CONFLICT (product_id, occasion_id) DO NOTHING;

  DELETE FROM public.product_tags WHERE product_id = v_row.id AND NOT (tag_id = ANY(v_tag_ids));
  INSERT INTO public.product_tags (product_id, tag_id)
  SELECT v_row.id, x FROM unnest(v_tag_ids) x ON CONFLICT (product_id, tag_id) DO NOTHING;

  DELETE FROM public.product_segments WHERE product_id = v_row.id AND NOT (segment_id = ANY(v_seg_ids));
  INSERT INTO public.product_segments (product_id, segment_id)
  SELECT v_row.id, x FROM unnest(v_seg_ids) x ON CONFLICT (product_id, segment_id) DO NOTHING;

  RETURN jsonb_build_object('id', v_row.id, 'slug', v_row.slug, 'updated_at', v_row.updated_at, 'row', to_jsonb(v_row));
END;
$function$;

REVOKE ALL ON FUNCTION public.save_product_full(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_product_full(jsonb) TO authenticated;