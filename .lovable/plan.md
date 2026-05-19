# Disable "Complete o kit" + expand PDP Badge

## 1. Desabilitar "Complete o kit" agora (já gerenciável)

A seção `cross_sell_complete` já é controlada por `pdp_sections` (admin → **/admin/pdp-sections**). Basta marcá-la como invisível. Admin já edita label/posição/visibilidade — nada a construir.

**Execução:** `UPDATE pdp_sections SET is_visible=false WHERE section_key='cross_sell_complete'`.

## 2. Live preview do Badge no admin

Na aba **Configuração** do `/admin/conversao`, dentro do card "Badge da PDP", renderizar um mock de imagem do produto (placeholder) 320×320 com o Badge sobreposto usando o mesmo componente/tons da PDP real. Atualiza em tempo real conforme o admin edita (label / tone / showIcon / position / offsets).

## 3. Override por produto

**DB:** nova coluna `products.pdp_badge_override jsonb` (nullable = usa configuração global). Estrutura:

```json
{ "enabled": true, "label": "Promo de inverno", "tone": "coral",
  "showIcon": false, "position": "top-right", "offsetX": 16, "offsetY": 16 }
```

RLS já existente em `products` cobre.

**Admin (form de produto):** novo card colapsável "Badge personalizado da PDP" com toggle "Sobrescrever configuração global" + mesmos campos do badge global + mini-preview.

**Resolução em runtime:** `effectiveBadge = product.pdp_badge_override?.enabled ? product.pdp_badge_override : ctaConfig.pdpBadge`.

## 4. Posição + offsets

Expandir `PdpBadgeConfig` (global e override):

- `position`: `top-left | top-right | bottom-left | bottom-right` (default `top-left`).
- `offsetX`: int 0–80 (default 16).
- `offsetY`: int 0–80 (default 16).

Schema Zod + UI de admin (select de posição + 2 inputs numéricos).
Render na PDP usa `style={{ top/left/right/bottom: offsetY/offsetX }}` conforme posição.

## 5. Tracking (impressões + cliques)

**DB:** nova tabela `pdp_badge_events`:

```
id, event_name ('impression' | 'click'),
product_id (nullable), badge_label, tone, position,
source ('global' | 'product_override'),
session_id, user_agent, created_at
```

- RLS: `INSERT` aberto a anônimos (igual `pdp_funnel_events`), `SELECT` só admin.
- Índices em `(event_name, created_at)` e `(product_id, created_at)`.

**Função `pdp_badge_stats(_from, _to)**` (SECURITY DEFINER, admin-only) retornando:

- total de impressões / cliques
- CTR global
- top 10 produtos por cliques
- breakdown por `tone` e `position`

**Frontend:**

- `useBadgeTracker(product, effectiveBadge)`: dispara `impression` 1× por sessão+produto quando o badge fica visível (IntersectionObserver), e `click` quando clicado (badge vira `<button>` que abre o WhatsApp/CTA padrão da PDP).
- Wrappers usam `navigator.sendBeacon` + fallback fetch.

**Admin:** nova aba **"Badge da PDP"** dentro de `/admin/conversao` com 4 KPI cards (impressões, cliques, CTR, top produtos) consumindo `pdp_badge_stats`.

## Arquivos

**Migration** (1): coluna `pdp_badge_override`, tabela `pdp_badge_events` + RLS + função `pdp_badge_stats` + índices.

**Hooks/lib (3):**

- `src/hooks/useConversionCtaConfig.ts` — adicionar `position`/`offsetX`/`offsetY` ao schema.
- `src/hooks/useBadgeTracker.ts` (novo) — impressões + cliques.
- `src/hooks/useBadgeStats.ts` (novo) — admin metrics.

**Componentes (1):**

- `src/components/PdpBadge.tsx` (novo) — extrai render do badge (já usado direto na PDP) com tracking embutido; aceita `effectiveBadge` + `productId` + `onClick`.

**Páginas (3):**

- `src/pages/ProductPage.tsx` — substituir bloco do badge por `<PdpBadge ... />`, resolver override.
- `src/pages/admin/AdminConversionCTA.tsx` — preview ao vivo no card, novos campos (position/offsets), nova aba "Badge".
- `src/pages/admin/AdminProductForm.tsx` (ou equivalente) — card de override por produto.

## Fora de escopo

- A/B de badges (pode vir depois).
- Badge animado/SVG custom (mantemos só ícone caminhão opcional).
- Edição inline na PDP pública.

Confirma para executar tudo (item 1 + 2 + 3 + 4 + 5)? 1 por 1, 1 por vez. sem quebrar nada.

&nbsp;