# Playbook de Assinatura Visual — Empório LeleCute

Três gestos repetíveis que assinam toda a interface e toda a fotografia.
Regra de ouro: **no máximo dois gestos por tela ou por foto**. Três é excesso.

Tokens usados (definidos em `src/index.css`): `--primary` (coral),
`--secondary` (areia), `--muted`, `--border`. Nunca usar hex direto.

---

## Gesto 1 — Sombra lateral (luz de janela)

Sombra suave deslocada no eixo X, nunca centralizada. Simula luz natural
entrando por uma janela à esquerda.

- UI: `shadow-[8px_10px_28px_-14px_hsl(var(--foreground)/0.28)]` em cards,
  imagens de PDP e blocos de destaque. Hover aprofunda: `-12px` no blur.
- Foto: fonte de luz única, difusa, a ~45° pela esquerda; sombra projetada
  visível à direita do objeto, sem preto puro (usar rebatedor).

Onde aplicar: `ProductCard`, galeria da PDP, cards de kits, blocos da home.
Onde não aplicar: dentro de tabelas do admin e em ícones pequenos.

## Gesto 2 — Dobra de linho (textura de fundo)

Fundo em tecido natural com uma dobra sutil que cria uma linha diagonal
discreta atrás do conteúdo.

- UI: faixa de seção com `bg-secondary/40` + separador diagonal via
  `before:` (`before:absolute before:inset-x-0 before:h-px before:bg-border/70
  before:rotate-[-0.6deg]`). Uma dobra por seção, no topo.
- Foto: linho/algodão cru como base, uma única dobra atravessando o quadro,
  nunca cruzando o produto.

Onde aplicar: separação entre seções da home, hero de landing, banner de
ocasiões.
Onde não aplicar: PDP acima da dobra (compete com o produto) e checkout.

## Gesto 3 — Fita coral 5 mm

Um único traço coral de 5 mm (≈ `4px`–`5px`) como marcador de hierarquia.

- UI: `border-l-[5px] border-primary` em títulos de seção, blocos de citação
  e estados ativos; ou `h-[5px] w-10 rounded-full bg-primary` como eyebrow
  (ver `SectionEyebrow`).
- Foto: fita de cetim coral de 5 mm amarrada ou repousada no enquadramento,
  ocupando no máximo 10% do quadro.

Onde aplicar: eyebrow de seção, título de PDP, badge de kit, CTA secundário.
Onde não aplicar: mais de uma vez na mesma dobra de tela.

---

## Aplicação por página

| Página | Gestos |
| --- | --- |
| Home | Dobra de linho (separadores) + fita coral (eyebrows) |
| Catálogo `/produtos` | Sombra lateral nos cards |
| PDP `/produto/:slug` | Sombra lateral na galeria + fita coral no título |
| Kits / Coleções | Fita coral no badge + sombra lateral |
| Carrinho / Checkout | Nenhum gesto decorativo (foco em conversão) |
| Admin | Nenhum gesto decorativo |

## Checklist antes de publicar

- [ ] No máximo dois gestos por tela.
- [ ] Sombra sempre deslocada no eixo X (nunca `shadow-lg` genérica).
- [ ] Coral só como acento — nunca como fundo de área grande.
- [ ] Cores vindas de tokens, sem hex ou `text-white`/`bg-black`.
- [ ] Em mobile, a dobra de linho não gera scroll horizontal.
- [ ] Fotos seguem também `docs/direcao-fotografica.md`.
