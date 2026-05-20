# Nomes de Arquivo + Alt Text — Padrão SEO

Padrão único para **toda imagem** publicada (catálogo, PDP, banner, blog, redes). Garante SEO, acessibilidade e organização interna.

---

## 1. Nome do arquivo

### Fórmula
```
{slug-produto}--{contexto}--{n}.{ext}
```

- **slug-produto:** kebab-case, sem acento, sem espaço, idêntico ao slug do produto no admin
- **contexto:** uma das palavras controladas abaixo
- **n:** índice 01, 02, 03… (zero-padded)
- **ext:** `.webp` preferido; `.jpg` aceito; `.png` só p/ transparência

### Contextos permitidos
| Tag        | Significado                                      |
|------------|--------------------------------------------------|
| `still`    | Still-life editorial (Frame A)                   |
| `life`     | Lifestyle silencioso (Frame B)                   |
| `macro`    | Close-up de textura (Frame C)                    |
| `pack`     | Embalagem / kit montado                          |
| `detalhe`  | Detalhe específico (selo, fita, personalização)  |
| `banner`   | Banner de campanha / hero                        |
| `social`   | Feed Instagram / Pinterest                       |

### Exemplos válidos
```
sabonete-artesanal-lavanda--still--01.webp
sabonete-artesanal-lavanda--life--02.webp
escalda-pes-sache-personalizado--macro--01.webp
kit-banho-relax--pack--01.webp
hero-dia-das-maes-2026--banner--01.webp
```

### Proibido
- Espaços, acentos, maiúsculas, caracteres especiais
- `IMG_1234.jpg`, `foto1.png`, `WhatsApp Image…`
- Nomes vagos: `produto.jpg`, `final-final.jpg`

---

## 2. Alt text (atributo `alt`)

### Fórmula
```
{Nome do produto} — {contexto curto}, {detalhe sensorial ou paleta}
```

- **Português correto**, com acento
- **80–125 caracteres** (sweet spot SEO + screen reader)
- Nunca começar com "Foto de…" / "Imagem de…"
- Incluir 1 palavra-chave de busca (nome do produto ou categoria)
- Descrever **o que se vê**, não o que se imagina

### Exemplos

| Tipo     | Alt                                                                                          |
|----------|----------------------------------------------------------------------------------------------|
| still    | `Sabonete artesanal de lavanda sobre linho cru, com flor seca lateral e luz natural difusa`  |
| life     | `Mão segurando sache de escalda-pés ao lado de vela acesa e xícara em bancada de madeira`    |
| macro    | `Detalhe da textura do sabonete artesanal: relevo cremoso em tons creme e rosa queimado`     |
| pack     | `Kit banho relax embalado em papel kraft com fita coral e selo Empório LeleCute`             |
| banner   | `Coleção Dia das Mães: composição editorial em tons areia e madeira clara, com saches`       |

### Decorativas (banners apenas estéticos sem produto identificável)
```html
<img alt="" role="presentation" />
```

---

## 3. Metadados de banner (admin)

Ao subir banner no admin, preencher:

- **Title:** mesmo padrão de alt, encurtado (≤60 caracteres)
- **Alt:** alt completo conforme regra acima
- **Slug interno:** `banner-{campanha}-{ano}-{n}`

---

## 4. Checklist rápido por imagem

- [ ] Nome no padrão `slug--contexto--nn.ext`?
- [ ] WebP otimizado (<200 KB para 1080px)?
- [ ] Alt em português, 80–125 caracteres?
- [ ] Alt descreve o que aparece (não interpreta)?
- [ ] Inclui nome do produto ou categoria?
- [ ] Sem "foto de…" / "imagem de…"?

Se "não" em qualquer item → renomear / reescrever antes de publicar.
