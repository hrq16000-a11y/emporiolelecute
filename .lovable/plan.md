## Objetivo
Unificar a ficha técnica de Visitante / Cliente / Usuário em um único Drawer rico, restaurar e tornar globais os filtros de localização, e blindar a busca/idempotência no backend — sem quebrar a UI atual.

---

## 1. Amarração de Dados (backend)

**1.1 Linkar visitantes a customers/users automaticamente**
- Trigger `link_visitor_to_customer`: ao gravar `whatsapp_phone` ou consent com email em `visitors`, faz lookup em `customers` (por `whatsapp` normalizado ou `email`) e popula `visitors.customer_id`. Idempotente.
- Backfill: rodar uma vez para visitantes existentes.

**1.2 RPC `get_unified_profile(_kind text, _id text)`** (SECURITY DEFINER, admin-only)
- Aceita `kind ∈ ('visitor','customer','user')` e o id correspondente (visitor_id / customer.id / auth.users.id).
- Retorna JSONB único com:
  - `identity`: nome, email, whatsapp, telefone (preferindo `customers` → `visitors.whatsapp_phone`).
  - `infra`: ip, country, region, city, isp, asn, timezone, device (brand/model/type), os, browser, lang, screen, gps (com coalesce de `ip_lat/lon` → `gps_lat/lon`).
  - `commerce`: first_referrer, first_landing_path, utm_source/medium/campaign/term/content, lead_status, lead_trigger, lead_promoted_at.
  - `aggregates`: total_pageviews, total_sessions, total_time_seconds, total_orders, total_spent.
  - `visitor_ids[]`: todos os visitor_id ligados àquele customer/user (para herdar histórico).
- Garante INNER JOIN lógico: customer/user que tem visitor_id vinculado **herda** todo histórico de telemetria.

**1.3 RPC `get_unified_timeline(_visitor_ids text[], _limit int)`**
- Une pageviews de **todos** os visitor_ids do mesmo customer, ordenados por (visitor_id, step_index, viewed_at). Resolve a "amnésia": cliente cadastrado segue vendo o passado anônimo.

**1.4 Idempotência de `mark_visitor_as_lead`**
- Adicionar guard: se `lead_status='lead'` E `lead_trigger=_trigger` E `lead_promoted_at > now() - interval '30 seconds'` → no-op silencioso (retorna true sem `INSERT` em pageviews nem novo `step_index`).

**1.5 Índices de busca (evita full table scan)**
- `idx_visitors_ip_text` em `(ip::text)`
- `idx_visitors_city_lower` em `lower(ip_city)`
- `idx_visitors_device_model_lower` em `lower(device_model)`
- `idx_customers_search_lower` em `lower(name)`, `lower(email)`, `phone`, `whatsapp`, `lower(city)` (GIN trgm onde fizer sentido).

---

## 2. Frontend — Drawer Unificado

**2.1 Novo componente `src/components/admin/UnifiedProfileDrawer.tsx`**
- Props: `{ kind: 'visitor'|'customer'|'user', id: string, open, onClose }`
- Usa `Sheet` (lateral, side="right", `sm:max-w-2xl`), consistente entre `/admin/clientes` e `/admin/usuarios`.
- Internamente chama `supabase.rpc('get_unified_profile', { _kind, _id })` + `get_unified_timeline`.
- Seções:
  1. **Contato** (destaque): WhatsApp clicável (`wa.me/...`), e-mail (mailto), telefone, badges de lead/cliente/bot.
  2. **Infraestrutura**: grid com fallback `Não detectado` para todo campo nulo.
  3. **Origem comercial**: referrer + chips de UTM.
  4. **Timeline atômica**: stepper vertical do RPC unificado, mostrando visitor_id quando muda (vínculos múltiplos), `step_index`, `time_on_page_seconds`, scroll, CTA, event_type. Footer com `total_time_seconds` formatado.
- Substitui o `Dialog` atual de visitante em `AdminCustomers.tsx` e o `Sheet` de usuário em `AdminUsers.tsx` para o tab "perfil" (mantém auditoria como segunda aba quando `kind='user'`).

**2.2 Roteamento por URL (já existe, expandir)**
- `?drawer=visitor|customer|user&id=...` em ambas as telas. `adminWorkspaceStore` continua reabrindo após troca de rota.

---

## 3. Frontend — Filtros Globais e Persistentes

**3.1 `AdminCustomers.tsx`**
- A barra de filtros (Data, Hora, Dispositivo, SO, **País, Estado, Cidade**, Buscar, Ordenar) já está acima das Tabs — auditoria visual confirma colunas faltantes em viewports estreitos. Aplicar `flex-wrap` + min-widths controlados nos selects de localização para garantir visibilidade em 1482px e abaixo.
- Search agora também filtra customers por nome/email/whatsapp/cidade (já faz) e visitors por IP/cidade/dispositivo/SO (já faz). Persistir `country/region/city` em `adminWorkspaceStore` via `patchRoute('/admin/clientes', { ... })` no `onChange` do filtro.
- Restauração: ao montar, hidratar `visitorFilters` a partir do store **antes** do `searchParams`, evitando reset ao trocar de tab.

**3.2 Cascata de localização**
- Quando `country` seleciona, regions/cities filtram suas opções por país (client-side a partir de `locationOptionsQ`, que passa a retornar tuplas `{country, region, city}` em vez de sets isolados).

---

## 4. Tratamento de Nulos (UI)

Helper `displayOrFallback(value, fallback='Não detectado')` usado em todo `Info` do Drawer. GPS/lat/lon usa `coalesce(gps_lat, ip_lat)` e mostra `—` apenas em campos puramente numéricos sem fallback semântico.

---

## 5. Arquivos impactados

```
NOVO  supabase/migrations/<ts>_unified_profile.sql
       ├─ trigger link_visitor_to_customer + backfill
       ├─ RPCs get_unified_profile, get_unified_timeline
       ├─ guard idempotência em mark_visitor_as_lead
       └─ índices de busca

NOVO  src/components/admin/UnifiedProfileDrawer.tsx
EDIT  src/pages/admin/AdminCustomers.tsx
       ├─ trocar Dialog de visitante por UnifiedProfileDrawer
       ├─ hidratação filtros via store antes de searchParams
       ├─ locationOptionsQ retorna tuplas para cascata
       └─ garantir flex-wrap dos filtros globais
EDIT  src/pages/admin/AdminUsers.tsx
       └─ tab "perfil" do Sheet usa UnifiedProfileDrawer (kind='user')
EDIT  src/stores/adminWorkspaceStore.ts
       └─ adicionar `filters?: Record<string, any>` por rota
EDIT  src/components/admin/customers/VisitorFilters.tsx
       └─ cascata country→region→city
EDIT  src/integrations/supabase/types.ts (auto-gerado após migration)
```

---

## 6. Ordem de execução

1. Rodar migration (trigger, RPCs, índices, guard, backfill).
2. Criar `UnifiedProfileDrawer.tsx`.
3. Estender `adminWorkspaceStore` com `filters`.
4. Refatorar `AdminCustomers.tsx` (drawer + hidratação + cascata).
5. Refatorar `AdminUsers.tsx` (drawer unificado no tab perfil).
6. Ajustes finos em `VisitorFilters.tsx`.
7. Verificar tipos / build.

Sem mudanças em UI pública, sem alterar lógica de pedidos/CRM existente.
