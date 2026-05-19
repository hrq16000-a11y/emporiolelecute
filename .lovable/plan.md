## Objetivo
Permitir gerenciamento 100% no admin de (1) ordem/visibilidade das seções da Página de Produto (PDP) e (2) ordenação/filtros da lista de pedidos.

## Parte 1 — CMS de seções da PDP

Espelhar o padrão já consolidado de `home_sections`.

**Banco** (`supabase/migrations/...`):
- Tabela `pdp_sections` com `section_key` (unique), `label`, `description`, `position` (int), `is_visible` (bool), `editable_props` (jsonb), timestamps.
- RLS: leitura pública (apenas visíveis), escrita só admin via `has_role`.
- Trigger de auditoria igual `audit_home_sections` -> `pdp_section_audit`.
- Seed inicial com as seções existentes na ordem atual:
  1. `description` — Descrição do produto
  2. `cross_sell_complete` — Complete o kit
  3. `bundle_belongs_to` — Kits aos quais este produto pertence
  4. `visual_composition` — Composição visual
  5. `editorial` — Conteúdo editorial
  6. `reviews` — Avaliações
  7. `faq` — Perguntas frequentes
  8. `related_smart` / `related_by_taxonomy` — Relacionados

**Frontend**:
- `src/hooks/usePdpSections.ts` — fetch + cache (react-query) + realtime.
- `src/lib/pdpSectionsRegistry.tsx` — registry mapeando `section_key` -> componente render `(ctx) => JSX`, recebendo `dbProduct`, `product`, etc.
- Refatorar bloco principal de `src/pages/ProductPage.tsx` (linhas ~915-1050) para iterar `pdpSections` ordenadas por `position` e renderizar via registry, respeitando `is_visible`.

**Admin**:
- Nova rota `/admin/pdp-sections` (`src/pages/admin/AdminPdpSections.tsx`) — lista drag-and-drop (dnd-kit já presente no projeto), toggle de visibilidade, edição de label/descrição, preview ao vivo.
- Entrada no menu lateral do admin.

## Parte 2 — Ordenação/filtros da lista de pedidos

`src/pages/admin/AdminOrders.tsx`:
- Adicionar dropdown "Ordenar por": Mais recente (default), Mais antigo, Maior valor, Menor valor, Cliente A-Z, Status.
- Persistir escolha em localStorage (`admin.orders.sort`).
- Manter filtros existentes (status, busca). Sem mudança de schema.

## Detalhes técnicos
- Reutilizar componentes shadcn já usados em `AdminHomeSections` (Card, Switch, Button, drag handle).
- Auditoria: mesma estratégia de `home_section_audit` para rastreabilidade.
- Cache invalidation no client após mutação via react-query.

## Entregáveis
- 1 migração (tabela + RLS + trigger + seed)
- 1 hook, 1 registry, refactor de `ProductPage.tsx`
- 1 página admin nova + entrada no menu
- Sort dropdown em `AdminOrders.tsx`

## Fora de escopo
- Edição inline do conteúdo textual de cada seção (já existe via campos do produto/FAQ/avaliações).
- Mudanças visuais nas próprias seções.
