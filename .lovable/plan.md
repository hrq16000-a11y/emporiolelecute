# Plano: Gestão completa em /admin/usuarios

## Escopo

1. **Migração de cadastro** (usuário ↔ cliente) em /admin/usuarios e /admin/clientes
2. **CRUD 100% gerenciável** de usuários em /admin/usuarios (criar, editar, desativar, resetar senha, atribuir papéis)
3. **Paginação e ordenação no backend** (busca, filtros e CSV via RPC paginada)
4. **CSV da auditoria** (role_promotion_audit) do usuário aberto, com filtros de data/tipo
5. **Filtros por WhatsApp/telefone e IP** (IP para visitantes)
6. **Drawer compartilhável** via querystring `?user=<id|email>` mantendo contexto ao recarregar

## Backend (migration SQL)

### Novas RPCs
- `list_all_users_paginated(_search, _role, _source, _whatsapp, _ip, _sort_key, _sort_dir, _limit, _offset)` → `{ total, rows }`
  - UNION das 4 fontes (auth, customers, visitors, orders) com filtros aplicados no SQL
  - Ordenação por: created_at, last_sign_in_at, email, full_name, source, role
- `create_managed_user(_email, _full_name, _whatsapp, _password, _roles[])` → cria via auth admin (edge function) + profile + roles
- `migrate_visitor_to_customer(_visitor_id)` → cria customer a partir de visitor (whatsapp/ip)
- `migrate_customer_to_user_link(_customer_id, _user_id)` → vincula customer existente a um auth user (preenche `user_id`/email)
- `promote_contact_to_customer(_source, _ref)` → converte contato de pedido em customer
- `list_user_audit(_user_id, _from, _to, _action, _limit, _offset)` → auditoria filtrada para CSV

### Campos adicionais expostos
- `whatsapp`, `phone`, `last_ip` (de visitors), `customer_id` link

## Edge Function
- `admin-create-user`: usa service role para `auth.admin.createUser` + insere profile/roles. Verifica `has_role(caller,'admin')`.

## Frontend

### `src/pages/admin/AdminUsers.tsx`
- Substituir client-side filter/sort/paginate por chamadas à RPC paginada
- Adicionar inputs: WhatsApp, IP, ordenação (select), tamanho de página
- Botão "Novo usuário" → modal (email, nome, whatsapp, senha gerada, papéis)
- Botão "Migrar para cliente" (quando source≠customer e há whatsapp/email)
- Botão "Vincular a usuário existente" no drawer (quando source=customer sem user_id)
- Drawer abre via `?user=<id>` (useSearchParams sync bidirecional)
- CSV agora chama RPC sem limite (server-side stream em lotes de 1000)
- Aba "Auditoria" no drawer com filtros (data início/fim, tipo) + botão "Exportar auditoria CSV"

### `src/pages/admin/AdminCustomers.tsx`
- Botão "Migrar para usuário" (envia convite/cria conta auth) ao lado de cada cliente
- Botão "Vincular a usuário existente" (combobox de auth users)

## Arquivos
- `supabase/migrations/<ts>_user_management_complete.sql` (RPCs)
- `supabase/functions/admin-create-user/index.ts` (edge)
- `supabase/config.toml` (verify_jwt=true para a nova função)
- `src/pages/admin/AdminUsers.tsx` (reescrita parcial)
- `src/pages/admin/AdminCustomers.tsx` (botões de migração)
- `src/components/admin/users/UserCreateDialog.tsx` (novo)
- `src/components/admin/users/UserAuditTab.tsx` (novo, dentro do drawer)

## Detalhes técnicos
- Sort whitelist server-side para evitar SQL injection
- Paginação default: 25/página, opções 25/50/100
- CSV gerado iterando páginas de 1000 no cliente, com toast de progresso
- Drawer state: `?user=<id>&tab=<perfil|auditoria>` via `useSearchParams`
- Migração visitor→customer requer pelo menos whatsapp OU email; preserva `last_ip` em `customer.notes`
