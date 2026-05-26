# Revisão Mobile-First — Plano em Ondas

Escopo amplo. Para entregar com qualidade e sem regressões, divido em **4 ondas** sequenciais. Cada onda = auditoria curta + correções + verificação no preview 390×843.

> Toda mudança é **frontend/presentation only** (Tailwind, breakpoints, semântica). Backend (RLS, edge functions, migrations) só será tocado se descobrirmos um bug funcional que afete mobile especificamente. Não há razão para o "backend" estar "não otimizado para mobile" — APIs são form-factor agnostic.

---

## Padrões aplicados em todas as ondas

- **Mobile-first**: classes base = mobile, `sm:` / `md:` / `lg:` adicionam desktop.
- **Tap targets ≥ 44×44 px** em qualquer botão/ícone interativo.
- **Sem overflow horizontal**: `overflow-x-hidden` em containers, `min-w-0` em flex children, `break-words` em textos longos.
- **Tabs com muitos itens**: scroll horizontal suave (`overflow-x-auto`, `snap-x`, `-mx-4 px-4`) em vez de quebrar/cortar.
- **Tabelas admin**: wrapper `overflow-x-auto` + versão card-stack opcional em `<md`.
- **Tipografia fluida**: `text-sm md:text-base`, títulos `text-xl md:text-3xl`.
- **Padding compacto mobile**: `p-3 md:p-6`, `gap-2 md:gap-4`.
- **Safe-area iOS**: `pb-[env(safe-area-inset-bottom)]` em barras fixas.
- **Imagens**: `aspect-*` + `object-cover`, `loading="lazy"` em listas.

---

## Onda 1 — Painel Admin (prioridade pelo print enviado)

**Alvos principais:**
- `AdminLayout` (sidebar/drawer, header)
- Páginas com Tabs longas: `/admin/conversao`, `/admin/fretes`, `/admin/seo`, `/admin/busca`, `/admin/produtos`
- Listagens-tabela: produtos, pedidos, cupons, redirects, tags, kits
- Formulários longos: produto, kit, página, blog

**Correções típicas:**
1. `TabsList` → wrapper rolável horizontal + indicador de overflow.
2. Tabelas → `overflow-x-auto` + larguras mínimas + sticky 1ª coluna quando fizer sentido.
3. Forms → grid 1 col mobile, 2+ cols `md:`. Labels acima dos inputs no mobile.
4. Toolbars/filtros → empilhar verticalmente <md, agrupar em `Sheet`/`Drawer` se >3 controles.
5. Cards de estatística (dashboard) → grid 2 cols mobile, 4 cols desktop.

## Onda 2 — PDP

**Alvos:** `ProductPage.tsx`, `StickyAddToCart`, galeria, reviews, FAQs, relacionados.

**Correções típicas:**
1. Reauditar contra `docs/qa/pdp-mobile-checklist.md` e rodar `e2e/pdp-mobile.spec.ts`.
2. Garantir que badges/favoritos não se sobrepõem.
3. Sticky CTA com safe-area + z-index correto.
4. Reviews list em coluna única + paginação compacta.
5. Relacionados em grid 2 cols mobile sem estourar.

## Onda 3 — Loja / Listagens / Busca

**Alvos:** `Loja.tsx`, `Buscar.tsx`, `Colecao.tsx`, `Ocasioes.tsx`, `KitPage.tsx`.

**Correções típicas:**
1. Filtros → `Sheet` lateral acionado por botão "Filtrar" no mobile.
2. Grid de produtos → 2 cols mobile (já é padrão; auditar gaps).
3. Paginação → controles compactos centralizados.
4. Ordenação → select full-width mobile.
5. Hero/landing `/loja` → compactar headlines e CTAs em mobile.

## Onda 4 — Checkout / Carrinho

**Alvos:** `Carrinho.tsx`, `ShippingCalculator`, modais de cadastro/login.

**Correções típicas:**
1. Linha de item → imagem menor, controles de quantidade empilhados se necessário.
2. Resumo do pedido → card sticky no rodapé mobile com total + CTA.
3. Inputs CEP/cidade/estado em grid responsivo.
4. Etapas (modelo → quantidade → frete → envio) com progresso visual mobile.

---

## Entrega

- Cada onda é commitada separadamente com QA visual no viewport 390×843 antes de avançar.
- Ao final, atualizo `docs/qa/pdp-mobile-checklist.md` e adiciono `docs/qa/admin-mobile-checklist.md`.
- Memória do projeto recebe uma regra Core: **"Toda nova tela admin precisa passar em 360px sem overflow."**

---

## Pergunta antes de começar

Posso iniciar pela **Onda 1 (Admin)** já que o print que você enviou é da `/admin/conversao`? Ou prefere outra ordem (ex.: PDP primeiro por impacto em conversão)?
