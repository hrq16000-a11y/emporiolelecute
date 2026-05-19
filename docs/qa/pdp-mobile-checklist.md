# Checklist de QA Mobile — PDP Empório LeleCute

## Breakpoints obrigatórios
- iPhone SE: 320 × 568
- iPhone 13/14: 390 × 844
- Android Pixel: 393 × 851
- Android compacto: 360 × 800

## Layout e overflow
- A página não pode ter rolagem horizontal (`scrollWidth <= innerWidth`).
- Header, breadcrumb, galeria, thumbs, cards relacionados e CTA devem respeitar `max-width: 100%`.
- Nenhum texto deve cortar fora da tela; usar truncamento apenas em labels secundários.
- Thumbs da galeria podem rolar horizontalmente dentro da própria faixa, sem mover a página.

## Galeria
- Imagem principal aparece inteira e centralizada no primeiro viewport.
- Dots ficam dentro da imagem e não cobrem elementos essenciais.
- Thumbnails têm tamanho consistente no mobile e não ultrapassam a largura.
- Zoom abre em modal sem overflow horizontal; fechar, próxima e anterior permanecem acessíveis.

## Favorito + Badge PDP
- Botão de favoritar tem pelo menos 44 × 44 px.
- Favorito nunca sobrepõe nem é coberto pelo Badge da PDP.
- Favorito tem foco visível forte via teclado.
- Alternar favorito muda visualmente o estado e registra `pdp_favorite_toggle`.

## Informações e compra
- Título, rating, badges, preço, Pix, quantidade e CTAs ficam alinhados e sem quebra visual.
- Botão principal, favorito e compartilhar cabem na mesma linha ou se ajustam sem overflow.
- Campo de personalização e seletor de quantidade são tocáveis com conforto.

## WhatsApp e CTAs
- CTA WhatsApp abre sem deslocar layout.
- Sticky CTA aparece apenas após o CTA principal sair da viewport.
- Botão flutuante de WhatsApp não cobre thumbs, favorito, preço ou CTA principal.

## Cards relacionados
- Grids relacionados mantêm 2 colunas no mobile sem estourar a tela.
- Badges dos cards truncam corretamente.
- Imagens e botões dos cards não geram overflow.

## Automação
- Rodar `npm run test:e2e -- --project=mobile --project=android-mobile --project=small-mobile e2e/pdp-mobile.spec.ts`.
- Atualizar snapshots Playwright intencionalmente apenas quando o layout aprovado mudar.
