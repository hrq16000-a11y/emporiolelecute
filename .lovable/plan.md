# Módulo de Cálculo de Frete E-commerce

Implementação completa de um sistema de frete configurável, com schema isolado, painel admin e edge function de cálculo. Tudo via banco de dados — zero hardcoded.

## Contexto atual

O projeto já tem:
- `supabase/functions/calculate-shipping/index.ts` (usa env vars `LELECUTE_ORIGIN_CEP` e `MELHOR_ENVIO_TOKEN` — **será refatorado para ler do banco**)
- Componentes de checkout em `QuoteForm.tsx` e `StickyAddToCart.tsx` que já consomem essa função

Vamos **migrar credenciais e parâmetros para o banco**, criar painel admin e enriquecer a lógica.

---

## 1. Schema (migration única)

**Novas tabelas:**

- `shipping_settings` (singleton, 1 linha): `origin_zip_code`, `default_box_weight_kg`, `default_box_length_cm`, `default_box_width_cm`, `default_box_height_cm`, `handling_fee`, `shipping_markup_percentage`
- `shipping_providers`: `provider_name`, `is_active`, `api_key`, `api_secret`, `endpoint_url`, `config_json` (extras)
- `shipping_rules`: `rule_name`, `condition_type` enum (`min_cart_value` | `specific_state` | `zip_code_range`), `condition_value` (jsonb flexível), `discount_type` enum (`free_shipping` | `fixed_discount` | `percentage_discount`), `discount_value`, `is_active`, `priority`
- `shipping_audit_logs`: `destination_zip`, `cart_snapshot` (jsonb), `provider_name`, `error_message`, `http_status`, `created_at` (retenção: trigger limita a 50 últimas linhas por delete cascata)

**Alteração em `products`:**
- Adicionar `weight_kg`, `length_cm`, `width_cm`, `height_cm`, `requires_shipping bool default true` (somente se ainda não existirem — verificar antes)

**RLS:** todas admin-only (read + write via `has_role(auth.uid(), 'admin')`). `shipping_settings` e `shipping_providers` (sem expor `api_key`/`api_secret`) podem ser lidos pela edge function via service role.

---

## 2. Edge Function `calculate-shipping` (refatorada)

Fluxo:
1. Carrega `shipping_settings` + `shipping_providers` ativos via service role
2. Valida CEPs origem/destino + `requires_shipping` dos itens
3. Calcula peso total (físico) e dimensões (fallback nas defaults)
4. `Promise.all` com timeout de 5s por provedor; falhas vão para `shipping_audit_logs` e o provedor é ignorado
5. Aplica `handling_fee` + `shipping_markup_percentage` em cada cotação
6. Aplica `shipping_rules` (min_cart_value / specific_state / zip_code_range) — se match de `free_shipping`, zera a opção mais barata
7. Ordena por preço, retorna `{ provider, service_name, price, estimated_delivery_days }[]`

CORS e validação Zod mantidos.

---

## 3. Painel Admin — `/admin/fretes`

Página com 4 abas (`Tabs` shadcn):

- **Origem e Padrões** — form único para `shipping_settings`
- **Provedores** — lista com toggle ativo/inativo + modal de edição (api_key/secret/endpoint)
- **Regras e Promoções** — CRUD com tabela + dialog (tipo de condição, valor, desconto)
- **Auditoria** — tabela read-only com últimos 50 logs de erro

Hook: `useShippingAdmin.ts` consolidando queries/mutations (React Query).

Rota adicionada em `AdminLayout`/router.

---

## 4. Frontend (Checkout)

Refatorar `QuoteForm.tsx` (já tem input CEP + cálculo):
- Máscara visual `00000-000`
- Skeleton durante loading
- Mensagem de erro padronizada: *"Não foi possível calcular o frete para este CEP. Verifique o número ou entre em contato com o suporte."*
- Opções em `RadioGroup` shadcn com nome do serviço, prazo em dias úteis, valor BRL

---

## Arquivos

**Novos:**
- `supabase/migrations/{timestamp}_shipping_module.sql`
- `src/pages/admin/AdminShipping.tsx`
- `src/components/admin/shipping/{SettingsTab,ProvidersTab,RulesTab,AuditTab,ProviderDialog,RuleDialog}.tsx`
- `src/hooks/useShippingAdmin.ts`

**Editados:**
- `supabase/functions/calculate-shipping/index.ts` (ler do banco, aplicar regras/markup, logar erros)
- `src/components/QuoteForm.tsx` (máscara + RadioGroup + skeleton + mensagem padrão)
- `src/App.tsx` ou router admin (rota `/admin/fretes`)
- `src/pages/admin/AdminLayout.tsx` (item de menu)

---

## Confirmação antes de executar

Antes de criar a migration eu vou checar quais colunas de `products` já existem (`weight_kg` provavelmente já está) para evitar conflito. Posso seguir?
