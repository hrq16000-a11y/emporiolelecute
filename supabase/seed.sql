-- =====================================================================
-- Seed local (Supabase CLI) — roda automaticamente após as migrações
-- em `supabase start` e `supabase db reset`.
--
-- 100% idempotente: pode rodar várias vezes sem duplicar nada.
-- NUNCA é aplicado em produção (o CLI só executa este arquivo localmente).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Usuário admin de teste — admin@local.test / admin123
-- ---------------------------------------------------------------------
do $$
declare
  v_user_id uuid := '00000000-0000-4000-a000-000000000001';
begin
  if not exists (select 1 from auth.users where email = 'admin@local.test') then
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data
    ) values (
      '00000000-0000-0000-0000-000000000000', v_user_id, 'authenticated', 'authenticated',
      'admin@local.test', crypt('admin123', gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Admin Local"}'::jsonb
    );

    insert into auth.identities (
      id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), v_user_id, v_user_id::text, 'email',
      format('{"sub":"%s","email":"admin@local.test","email_verified":true}', v_user_id)::jsonb,
      now(), now(), now()
    );
  else
    select id into v_user_id from auth.users where email = 'admin@local.test';
  end if;

  insert into public.profiles (id, email, full_name)
  values (v_user_id, 'admin@local.test', 'Admin Local')
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role)
  values (v_user_id, 'admin')
  on conflict (user_id, role) do nothing;
end $$;

-- ---------------------------------------------------------------------
-- 2. Configurações padrão da loja (store_settings)
-- ---------------------------------------------------------------------
insert into public.store_settings (key, value) values
  ('seo_config', jsonb_build_object(
    'site_name', 'Empório LeleCute (local)',
    'canonical_url', 'http://localhost:8080',
    'default_title', 'Empório LeleCute — papelaria e sabonetes artesanais',
    'default_description', 'Ambiente de desenvolvimento local.',
    'sitemap_notification_email', 'admin@local.test'
  )),
  ('contact_info', jsonb_build_object(
    'whatsapp', '5541992214299',
    'email', 'admin@local.test',
    'instagram', 'emporiolelecute',
    'facebook', 'emporiolelecute'
  )),
  ('payment_config', jsonb_build_object(
    'pix_discount_percent', 7,
    'max_installments', 3,
    'interest_free_installments', 3
  )),
  -- tracking desligado offline: evita chamadas a GA/Meta sem internet
  ('tracking_config', jsonb_build_object(
    'enabled', false,
    'ga4_id', null,
    'gtm_id', null,
    'meta_pixel_id', null,
    'google_ads_id', null,
    'disabled_paths', jsonb_build_array('/admin'),
    'enabled_paths', jsonb_build_array()
  )),
  ('feature_flags', jsonb_build_object(
    'chatbot_enabled', false,
    'pdp_reviews_expand_enabled', true
  ))
on conflict (key) do nothing;

-- ---------------------------------------------------------------------
-- 3. Catálogo mínimo para o app não iniciar vazio
-- ---------------------------------------------------------------------
insert into public.categories (name, slug, description, position, is_draft)
values ('Papelaria Personalizada', 'papelaria-personalizada',
        'Cadernos, agendas e kits personalizados.', 1, false)
on conflict (slug) do nothing;

insert into public.occasions (name, slug, description, position, is_draft)
values ('Aniversário', 'aniversario', 'Lembranças e kits para festas.', 1, false)
on conflict (slug) do nothing;

insert into public.products (name, slug, description, price, is_active, category_id)
select v.name, v.slug, v.description, v.price, true,
       (select id from public.categories where slug = 'papelaria-personalizada')
from (values
  ('Caderno Personalizado A5', 'caderno-personalizado-a5',
   'Caderno artesanal A5 com capa personalizada. Produto de exemplo (seed local).', 39.90::numeric),
  ('Kit Sabonetes Artesanais', 'kit-sabonetes-artesanais',
   'Trio de sabonetes artesanais com embalagem em linho. Produto de exemplo (seed local).', 54.00::numeric)
) as v(name, slug, description, price)
where not exists (select 1 from public.products p where p.slug = v.slug);
