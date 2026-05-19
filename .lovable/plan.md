# Auditoria & remoção completa de "Elo7"

## Inventário encontrado

**Banco (Lovable Cloud)**

- `product_reviews`: **118 avaliações com `source = 'elo7'**` (único source em uso hoje).
- `store_settings.social_links`: chave `elo7` apontando para `elo7.com.br/emporiolelecute`.
- Não existem mais tabelas `elo7_reviews_audit` nem colunas `elo7_link` (migrations antigas já removidas).
- Bucket de Storage `elo7-review-images` (pode estar vazio, mas existe).

**Código (16 arquivos)**


| Arquivo                                      | O que tem                                           |
| -------------------------------------------- | --------------------------------------------------- |
| `src/components/ProductReviews.tsx`          | Badge "elo7" no card (linha 150)                    |
| `src/hooks/useProductReviews.ts`             | Comentário "verificadas (Elo7/compra real)"         |
| `src/pages/admin/AdminImport.tsx`            | Texto "integração com o Elo7 foi removida"          |
| `src/pages/admin/AdminProductReviews.tsx`    | `'elo7'` na lista `SOURCES` + comentário            |
| `src/pages/admin/AdminReviewsRealAudit.tsx`  | Página inteira de auditoria Elo7                    |
| `src/components/admin/ProductReviewForm.tsx` | Opção `elo7` no select de origem                    |
| `src/lib/executiveNavigation.ts`             | Item de menu "Reviews Elo7 (Auditoria)"             |
| `supabase/functions/chat/index.ts`           | Regra no prompt mencionando "Elo7"                  |
| `src/integrations/supabase/types.ts`         | Tipos da extinta `elo7_reviews_audit` (auto-gerado) |
| `docs/slugs-phase-3-hardening-audit.md`      | Menção histórica                                    |
| 6 migrations em `supabase/migrations/*`      | Histórico — **NÃO alterar** (imutáveis)             |


## Plano de execução

### 1. Banco

Migration única que:

- Atualiza `product_reviews.source = 'site'` onde `source = 'elo7'` (preserva as 118 avaliações reais, só troca o rótulo).
- Remove a chave `elo7` de `store_settings.social_links` (jsonb).
- Dropa o bucket `elo7-review-images` e suas policies (se vazio).
- Dropa tabela `elo7_reviews_audit` se ainda existir (idempotente).

> Migrations antigas ficam intocadas (são imutáveis e já foram aplicadas no passado).

### 2. Frontend / Admin

- `**ProductReviews.tsx**`: remover o badge "elo7" (linha 150) — fica só "Compra verificada" quando `verified=true`.
- `**AdminProductReviews.tsx**`: remover `'elo7'` de `SOURCES` e atualizar comentário.
- `**ProductReviewForm.tsx**`: remover opção `elo7` do select.
- `**useProductReviews.ts**`: ajustar comentário (sem citar Elo7).
- `**AdminImport.tsx**`: trocar texto para mensagem neutra ("Cadastre os produtos manualmente.").
- `**executiveNavigation.ts**`: remover item "Reviews Elo7 (Auditoria)".
- `**AdminReviewsRealAudit.tsx**`: deletar arquivo + remover rota correspondente.
- `**chat/index.ts` (edge function)**: trocar regra para "NUNCA mencione, recomende ou direcione para marketplaces externos…" (sem nomear Elo7).
- `**docs/slugs-phase-3-hardening-audit.md**`: remover linha que cita Elo7.

### 3. Tipos

`src/integrations/supabase/types.ts` é regenerado automaticamente após a migration dropar a tabela — não editar manualmente.

### 4. Memória do projeto

Atualizar `mem://index.md` removendo qualquer referência à Elo7 (não há nenhuma hoje, mas confirmo).

## Resultado final

- Zero ocorrências de "elo7" no código vivo (`rg -i elo7 src supabase/functions`).
- 118 avaliações preservadas com `source='site'`.
- Painel admin sem rota/menu/opção Elo7.
- Chat AI sem citar Elo7.

**Confirma para eu executar?  sim, sem quebrar nada.**

&nbsp;