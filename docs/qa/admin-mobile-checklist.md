# Checklist de QA Mobile — Painel Admin

## Breakpoints obrigatórios
- 320 × 568 (iPhone SE)
- 360 × 800 (Android compacto)
- 390 × 843 (iPhone 13/14)
- 768 × 1024 (iPad — transição lg)

## Regras gerais
- Nenhuma página admin pode gerar scroll horizontal global (`document.scrollWidth <= window.innerWidth`).
- Todos os botões e ícones interativos devem ter área de toque ≥ 44 × 44 px.
- Containers devem usar `min-w-0` quando dentro de flex/grid para não estourar a largura.

## Tabs (`TabsList`)
- Quando os triggers somam mais que a largura do viewport, a faixa rola horizontalmente sem mostrar scrollbar e sem cortar o último item.
- O trigger ativo deve ficar visível ao abrir a página (futuro: `scrollIntoView` no `data-state=active`).
- No desktop (≥768px), as tabs voltam a aparecer centralizadas sem rolagem.

## Tabelas
- `<Table>` do shadcn já vem com wrapper `overflow-auto`. Garantir que o pai não tenha `overflow-hidden`.
- Para tabelas com >5 colunas, considerar versão card-stack em `<md` (não obrigatório).

## Formulários
- Grid de campos: 1 coluna mobile, 2+ colunas a partir de `md:`.
- Labels acima do input (nunca à esquerda em mobile).
- Inputs com `h-10` mínimo; selects e date-pickers idem.
- Toolbars de ação (Salvar/Cancelar) viram barra fixa no rodapé em telas longas (`sticky bottom-0`).

## Sidebar/Drawer admin
- Drawer cobre 100% da largura ≤ 360px; ≥ 361px usar largura confortável.
- Backdrop deve fechar ao toque.
- Item ativo destacado e visível sem scroll quando possível.

## Automação sugerida
```bash
npm run test:e2e -- --project=mobile e2e/admin-overflow.spec.ts
```
(Spec ainda a criar — meta: para cada rota /admin/*, validar ausência de overflow horizontal.)
