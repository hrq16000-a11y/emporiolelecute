# Fase 3 — Hardening Operacional Pós-Flip (SAFE MODE)

**Data:** 2026-05-18  
**Status:** Auditoria concluída. Nenhuma alteração estrutural, pública, de schema, rota, canonical, sitemap ou redirect aplicada.  
**Resultado executivo:** Sistema estável. Drift estrutural = 0. Catálogo saudável com 1 dívida cosmética isolada (slugs truncados em 55 chars). Nenhum risco crítico aberto.

---

## A. Relatório executivo

| Eixo | Estado | Severidade aberta | Observação |
|---|---|---|---|
| Namespace `/produto` | **CONSOLIDADO** | nenhuma | 11/11 invariantes drift OK. 6/6 testes SEO surface OK. |
| Coexistência `/produtos/:slug` legado | **OPERACIONAL** | nenhuma | `LegacyProductRedirect` 1-hop, `legacy_namespace_hit` observável. |
| Superfícies SEO (canonical, og:url, JSON-LD, breadcrumb, sitemap, merchant, robots, internal linking, share) | **DERIVADAS DE HELPER** | nenhuma | Confirmado por grep estruturado: zero literal `/produto(s)/${…}` fora de `src/lib/urls.ts` e `supabase/functions/_shared/urls.ts`. |
| Catálogo de slugs (58 total, 54 produtos ativos) | **SAUDÁVEL** | baixa (cosmética) | 0 long (>60), 0 short (<8), 0 repetitivos, 0 inativos, **0 aliases**. 10 slugs no teto 55 chars com sufixo hash visível (`...-ii6z`). |
| Resolver / `product_slugs` | **ESTÁVEL** | nenhuma | Sem aliases ⇒ sem chains, sem loops, sem flatten pendente. |
| Observabilidade Fase 2.3 | **SUFICIENTE** | baixa | Buffer 200 in-memory; sem leak; taxonomia limpa; sem sink server-side (intencional). |
| SEO automation (autopilot, control-plane, sitemap, merchant, prerender) | **SEGURO COM 1 OBS.** | média | `prerender/index.ts` contém HTML estático com `/produtos` (listagem — correto), mas NÃO renderiza páginas de produto individual via prefixo — sem risco de drift. |
| Performance / crawl | **OK** | nenhuma | Sitemap 54 produtos + estáticos. Replace duplo só ocorre se houver alias inativo (hoje: 0). |

---

## 1. Auditoria de estabilidade pós-flip

### 1.1 Hardcodes residuais

**Convenção crítica:** Existem DOIS namespaces distintos:
- `/produto/:slug` — **detalhe de produto** (canônico pós-flip). Único permitido para emitir via helper.
- `/produtos` (sem slug) — **listagem/catálogo**. NÃO faz parte do flip. Deve permanecer.

Grep estruturado (`rg "produtos/" — exclui produtos?, produtos", produtos<, produtos\``):

| Local | Tipo | Status |
|---|---|---|
| `src/App.tsx:273-274` | Rota legada `<Route path="/produtos/:slug" element={<LegacyProductRedirect/>}>` | **CORRETO** — coexistência. |
| `src/App.tsx:419,424,644` | `admin/produtos/...` | **CORRETO** — admin interno, fora de SEO. |
| `src/components/RedirectHandler.tsx:16` | Comentário `PRODUCT_NAMESPACES` | **CORRETO**. |
| `src/components/admin/SocialSeoPreviews.tsx:11` | Comentário JSDoc com exemplo `/produtos/` | **COSMÉTICO** — atualizar para `/produto/` (ação P2). |
| `src/pages/admin/AdminRedirects.tsx:76` | Placeholder do input — documenta migração | **CORRETO** (educativo). |
| `src/pages/admin/AdminTracking.tsx:88,99` | Wildcard `/produtos/*` em placeholder | **COSMÉTICO** — atualizar exemplo para `/produto/*`. |
| `src/lib/slugObservability.ts:51,53` / `src/lib/urls.ts:5,22` | Comentários históricos | **CORRETO**. |
| `supabase/migrations/20260517011539_…sql` | Migração antiga (Fase A, sentido inverso) | **HISTÓRICO IMUTÁVEL** — não tocar. |

**Conclusão:** **Zero hardcode de produto-detalhe** fora dos helpers. Todas as ocorrências restantes são (a) listagem `/produtos` (correto), (b) admin, (c) comentários ou (d) histórico. Auditoria automatizada (`scripts/audit-namespace-drift.ts`) reporta **11/11 OK**.

### 1.2 Superfícies SEO

| Superfície | Origem | Verificação |
|---|---|---|
| `<link rel="canonical">` | `urls.productCanonical(primarySlug)` em `ProductPage.tsx` | OK |
| `og:url` | idem | OK |
| `Product` JSON-LD | `urls.productAbsolute()` em `ProductStructuredData.tsx` | OK |
| `ItemList` JSON-LD | `urls.productAbsolute()` | OK |
| Breadcrumb URLs | `urls.productAbsolute()` | OK |
| `sitemap.xml` (estático) | gerado por `scripts/generate-sitemap.ts` ← edge `generate-sitemap` ← `productAbsolute()` em `_shared/urls.ts` | OK (sha256 bate com `.sitemap-source.json`) |
| `merchant-feed` | `productAbsolute()` edge | OK |
| `robots.txt` | aponta para `CANONICAL_ORIGIN/sitemap.xml` | OK |
| Internal linking | `urls.product()` via `linkOrchestrator`, `internalLinking`, ProductCard, BestSellers, CrossSell, Related* | OK |
| Share links (WhatsApp, copy-link) | `urls.productShare()` | OK |

---

## 2. Auditoria de catálogo e slugs

```
58 slugs totais | 58 primary | 0 aliases | 0 inativos
54 produtos ativos
0 long (>60) | 0 short (<8) | 0 com repetição interna (-X-X)
10 truncados no teto 55 chars com hash `-XXXX`
```

### 2.1 Truncamento semântico (única dívida real)

10 slugs colidem com limite de 55 chars do gerador. Resultado: corte mid-word + sufixo aleatório. Exemplos:

| Produto | Slug atual | Patologia |
|---|---|---|
| Lembrancinha Sabonete Fundo do Mar + Letra + Mini Coração | `…fundo-do-mar-letra-mini-cora-ii6z` | corta "Coração" → "cora" |
| Mini Vela na Latinha Personalizada com Mensagem Secreta | `…mensagem-se-y5yi` | corta "Secreta" → "se" |
| Sabonete Letra Brasão + Espirito Santo com Mini Terço | `…mini-terc-hxsv` | corta "Terço" |
| (mais 7 padrões similares) | | |

**Classificação:**
- **Saudável (48):** manter como estão.
- **Otimizar futuramente (10):** os truncados acima. Reescrita manual com slug semântico curto + alias do antigo via `product_slugs`. Baixa urgência: hash `-XXXX` não bloqueia indexação, apenas reduz CTR marginalmente em SERP.
- **Crítico (0).**
- **Não mexer (0).**

### 2.2 Demais critérios

| Critério | Achados |
|---|---|
| Duplicidade lexical | nenhuma |
| Slug stuffing / keywords artificiais | nenhuma |
| Inconsistência nome ↔ slug | apenas os 10 truncados |
| Aliases inúteis / nunca acessados | **N/A — zero aliases** |
| Potencial colisão futura | baixíssimo (hash de 4 chars + 55 chars de prefixo) |

---

## 3. Auditoria de rename safety

Simulações lógicas contra o modelo atual (`product_slugs` + resolver runtime):

| Cenário | Comportamento esperado | Resultado |
|---|---|---|
| Rename simples (A→B) | B vira primary, A vira alias inativo→ativo | OK — coberto por `productResolver.test.ts` |
| Rename encadeado (A→B→C) | flatten via resolver; ProductPage faz replace 1-hop guardado por `loop_prevented` | OK |
| Rename revertido (A→B→A) | A volta a primary; resolver continua aceitando B | OK |
| Alias manual ativo | resolver responde `alias_hit`, replace para primary | OK |
| Alias inativo | resolver responde `inactive_alias_attempt` → 404 | OK |
| Colisão (slug já existe em outro produto) | UNIQUE constraint em `product_slugs.slug` bloqueia no insert | OK (constraint DB) |
| Rollback parcial (rename desfeito mid-flight) | última escrita vence; resolver auto-corrige no próximo hit | OK |
| Rename concorrente (2 admins) | UNIQUE constraint + last-write-wins; sem corrupção | OK |

**Cache React Query:** invalidação por `["products"]` e `["product", slug]` em todos os mutate de admin → OK.  
**Sitemap pós-rename:** próximo `prebuild` (ou submit-sitemap edge) regenera com novo slug + audit JSON. OK.  
**Loops:** `LegacyProductRedirect` (replace 1) → ProductPage resolver (replace 2 se alias) → guard `loop_prevented` se replace voltaria a si mesmo. Limite teórico: 2 hops client. OK.

---

## 4. Hardening de observabilidade

Taxonomia atual (16 eventos) — auditada em `src/lib/slugObservability.ts`:

| Categoria | Eventos | Veredito |
|---|---|---|
| Hits válidos | `alias_hit`, `historical_hit` | sampling 20% — adequado |
| Replace | `replace_executed`, `loop_prevented` | OK |
| Falhas | `unknown_slug`, `slug_resolution_failed`, `inactive_alias_attempt` | OK |
| Inconsistências | `structural_inconsistency`, `slug_drift_detected`, `canonical_mismatch`, `redirect_chain_detected` | OK — severidade `error` |
| Namespace flip (Fase 2.2+) | `legacy_namespace_hit` sampling 25% | OK |
| Drift superfícies (Fase 2.1, inertes) | `canonical_namespace_mismatch`, `merchant_url_mismatch`, `sitemap_namespace_mismatch` | **Nunca emitidos hoje** (esperado pós-flip). **Manter como tripwire.** |

**Memory leak `window.__slugEvents`:** buffer cap 200 entries, splice na frente → **sem leak**.  
**Payload:** todos com `severity`, `source`, `ts` — consistente.  
**Sampling:** críticos 100%, alta-frequência 20–25%. Adequado.

**Recomendações SAFE (não aplicadas):**
- TTL: não necessário — ring buffer já limita.
- Namespace por origem: já existe (`source: "client"`). Quando houver edge logging, padronizar `source: "edge"`.
- Filtro debug/admin: adicionar `getSlugEventBuffer().filter(e=>e.severity==='error')` em `/admin/seo` — **proposta P2**.

---

## 5. Drift prevention permanente

| Mecanismo | Existe? | Localização | Cobertura |
|---|---|---|---|
| Grep automático | **SIM** | `scripts/audit-namespace-drift.ts` (11 invariantes) | helpers ↔ helpers, helpers ↔ sitemap marker, hardcodes |
| Snapshot de sitemap (hash) | **SIM** | `public/.sitemap-source.json` + drift test | sha256 + namespace |
| Validação de canonical | **SIM** | `src/lib/seoSurfaceDrift.test.ts` (6 testes) | canonical/og/JSON-LD via helper |
| Test de namespace | **SIM** | idem + `productResolver.test.ts` | helpers + resolver |
| Lint rule (eslint no-restricted-syntax para literal `/produto`) | **NÃO** | — | proposta P2 |
| Detecção CI de concatenação manual | **PARCIAL** | grep no script; não roda em CI | proposta P2 (add ao `.github/workflows/ci.yml`) |

**Helpers obrigatórios — gaps:** nenhum. Todos os call-sites públicos passam por `urls.*`/`productPath`/`productAbsolute`.

---

## 6. Auditoria de SEO Automation

| Função edge | Responsabilidade | Veredito | Risco |
|---|---|---|---|
| `generate-sitemap` | gera XML com markers de origem | **seguro** | nenhum |
| `merchant-feed` | XML/JSON Merchant Center | **seguro** | nenhum |
| `prerender` | HTML SSR para crawlers em rotas estáticas | **observação** | usa `productPath()` para detalhe; lista `/produtos` (listagem — correto); HTML head com `<a href=…/produtos>` correto |
| `seo-control-plane` | dashboard de indexação | **seguro** | usa `productPath()` |
| `seo-autopilot` | recomendações automáticas | **observação** | sem write em rotas/canonical — apenas sugere |
| `seo-sitemap-auto-resubmit` | resubmit semanal (pg_cron) | **seguro** | dispara após `generate-sitemap` |
| `submit-sitemap` | submit manual | **seguro** | idem |
| `seo-indexation-monitor` | observa GSC | **seguro** | read-only |

**Duplicação de responsabilidade:** baixa. `generate-sitemap` é fonte única; `submit-sitemap` / `auto-resubmit` apenas notificam Google.  
**Race conditions:** `auto-resubmit` semanal + `prebuild` local poderiam regenerar simultâneo — mas ambos derivam da mesma DB, output idempotente. Sem risco.  
**Loops automáticos:** nenhum detectado.  
**Reprocessamento inútil:** `auto-resubmit` roda mesmo sem mudanças — custo baixo (1 req/semana). Aceitável.  
**Dependências frágeis:** `prerender` depende de UA detection upstream (Cloudflare/Lovable hosting). Fora do escopo Fase 3.

Classificação:
- **Seguro:** 6 funções
- **Observação:** 2 (prerender, autopilot) — sem ação necessária
- **Dívida técnica:** 0
- **Risco operacional:** 0

---

## 7. Performance & crawl efficiency

| Métrica | Valor | Avaliação |
|---|---|---|
| Sitemap | 54 produtos + ~15 estáticos | leve |
| Hops em link interno → produto | 1 (link direto canonical) | ótimo |
| Hops em backlink legado (`/produtos/:slug`) | 2 client (Legacy replace → ProductPage) | aceitável (sem 301 server-side por escolha Fase 2.3) |
| Replace duplo (legado + alias) | só dispara se URL = legado E slug = alias | raro, e protegido por `loop_prevented` |
| Internal linking density | ProductCard + Related + CrossSell + Breadcrumb | adequada |
| Crawl waste | quase nulo — sitemap só emite `/produto/`; legado não está no sitemap | OK |

**Custo redirect client-side:** 1 render + 1 navigate replace = ~50ms. Negligível para usuário; invisível para Googlebot moderno (executa JS). Backlinks resolvem.

---

## B. Lista de ações futuras

### Vale fazer (P1 — próximo ciclo)
1. **Reescrita semântica dos 10 slugs truncados** com alias do antigo. Beneficia CTR em SERP. ETA: 30 min admin manual.

### Vale fazer (P2 — quando houver janela)
2. Atualizar comentários e placeholders cosméticos: `SocialSeoPreviews.tsx:11`, `AdminTracking.tsx:88,99`.
3. Adicionar `scripts/audit-namespace-drift.ts` como step no `.github/workflows/ci.yml` (já estável local).
4. ESLint rule `no-restricted-syntax` proibindo literal regex `/\/produtos?\/\$\{/` fora de `src/lib/urls.ts`.
5. Painel admin "SEO Health" expondo `getSlugEventBuffer()` filtrado por `severity=error`.

### Adiar (P3 — gatilho condicional)
6. Cloudflare Worker para 301 server-side em `/produtos/:slug`. **Gatilho:** se em D+30 GSC mostrar impressões legadas > 5% das totais, ou Merchant Center reportar URL mismatch.
7. Persistência server-side de eventos slug. **Gatilho:** volume > 10k events/dia ou necessidade de retroanálise multi-sessão.

### Não vale mexer / Nunca fazer
8. NÃO consolidar `/produtos` listagem em `/produto` — são namespaces semanticamente distintos.
9. NÃO remover rota legada `/produtos/:slug` — coexistência permanente é estratégia oficial Fase 2.3.
10. NÃO criar aliases preventivos em massa — gera ruído de resolver sem benefício.
11. NÃO migrar sitemap para 100% dinâmico — Strategy B (materializado) já decidida e estável.

---

## C. Plano saudável próximos ciclos

| Ordem | Área | Próximo passo concreto | Por quê |
|---|---|---|---|
| 1 | **Catálogo** | Reescrita dos 10 slugs truncados + aliases | dívida real isolada |
| 2 | **SEO editorial** | Expandir blog com 4-6 posts pillar mapeando hubs `/lembrancinhas-*` | tráfego orgânico segue branding pronto |
| 3 | **Conversão** | A/B no Sticky CTA e Quick Summary (`/admin/conversao`) | infra pronta, falta uso |
| 4 | **Branding** | Padronização visual em hero/testimonials com fotos artesanais reais | substituir placeholders externos antigos nas migrations |
| 5 | **Aquisição** | Revisar `/loja` (Google Ads landing) com base em GSC D+30 pós-flip | aproveitar consolidação de namespace |
| 6 | **Refinamento incremental** | Aplicar ações P2 acima sob demanda | sem urgência |

---

## D. SAFE MODE — confirmação

Nesta fase NÃO foram alterados: rotas, canonical, sitemap público (XML/source), redirects, schema, namespace, automações, persistência. Único arquivo criado: este documento.

**Critério de sucesso atingido:** sistema em modo estabilizado, drift detectável < 1 min via `bunx tsx scripts/audit-namespace-drift.ts`, catálogo classificado, próximos ciclos priorizados.
