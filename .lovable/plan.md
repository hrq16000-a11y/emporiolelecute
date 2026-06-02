# Backup total + referência estável `img_ref` para todas as imagens

Objetivo: criar um registro central de mídia onde cada imagem tem uma chave própria e portável (`img_ref`), independente do UID/ID do storage do Lovable, com integridade verificável e exportação completa do cloud para um arquivo local seguro. E fechar a porta que apagou as imagens.

## Princípio central

Hoje cada tabela guarda a `image_url` "crua" do storage. Se o path/ID muda (ou o arquivo é apagado pelo GC), a referência morre. A correção é inverter a dependência: as entidades passam a apontar para um **`img_ref` estável**, e o `img_ref` resolve para a URL atual via um registro central. Assim a identidade da imagem nunca depende da infraestrutura.

```text
ANTES:  occasions.image_url  ── (URL crua, frágil) ──>  storage object (some → 404)
DEPOIS: occasions.image_ref ──> media_assets.img_ref ──> { storage_path, public_url, checksum }
                                       │
                                       └── manifest exportável (backup local externo)
```

## Etapa 1 — Tabela registro `media_assets`

Nova tabela `public.media_assets` (admin-only, RLS estrito):
- `img_ref` (text, PK) — chave estável e legível, ex.: `occ_cha-de-bebe_a1b2c3`. Gerada por nós, nunca reutilizada, **não derivada do UID do storage**.
- `bucket`, `storage_path` (path relativo dentro do bucket), `public_url`.
- `content_type`, `size_bytes`, `checksum_sha256` (integridade), `width`/`height` (quando aplicável).
- `entity_type` + `entity_id` (quem usa: `occasion`, `product`, `hero_slide`, `kit`, `category`, `segment`…), `field` (coluna de origem).
- `source` (`storage` | `src_assets` | `external`), `status` (`active` | `missing` | `archived`).
- `created_at`, `updated_at`, `last_verified_at`, `backed_up_at`.

Coluna opcional `image_ref` adicionada às tabelas que hoje usam imagem, para migração gradual (sem quebrar o `image_url` atual, que vira fallback).

## Etapa 2 — Backfill (inventário completo)

Função/edge que monta o inventário inicial:
1. Varre **todas** as tabelas com colunas de imagem (`products.images[]`, `occasions.image_url`, `hero_slides.image_url`, `kits`, `categories`, `segments`, `elo7-review-images` etc.).
2. Varre **os objetos reais** do storage (todos os buckets).
3. Cruza os dois: cada arquivo vira uma linha em `media_assets` com `img_ref` gerado, `checksum` calculado e `status`:
   - `active` (referenciado e existe no storage),
   - `missing` (referenciado mas o arquivo sumiu — vai listar exatamente as 8 ocasiões perdidas),
   - `archived` (existe no storage mas ninguém referencia — candidato real a limpeza, sem apagar).

Resultado: um mapa auditável de 100% das mídias e do que está são/quebrado.

## Etapa 3 — Export "cloud → local seguro"

Estender a página admin de Backup existente (`/admin/backup`, edge `admin-backup-export`) para um **export binário completo**:
- Edge function gera um **ZIP** contendo:
  - `/manifest.json` → todo o `media_assets` (img_ref → metadados + checksum).
  - `/files/<img_ref>.<ext>` → o binário de cada imagem, nomeado pelo `img_ref` (não pelo nome do storage). Assim o pacote é auto-suficiente e re-importável em qualquer ambiente.
- Download direto pelo admin e cópia para `/mnt/documents/` (artefato baixável).
- `backed_up_at` é carimbado em cada asset exportado.
- **Re-import**: rotina espelho que lê o manifest, re-sobe os binários e recria os `img_ref` — recuperação total mesmo após desastre.

## Etapa 4 — Resolver por `img_ref` no app

Helper único (`resolveImageRef(img_ref)`) que devolve a URL atual a partir de `media_assets`, com fallback para `image_url` legado. Componentes de imagem passam a aceitar `img_ref`. Migração incremental, sem big-bang.

## Etapa 5 — Fechar a porta (corrigir o GC)

A `cleanup-orphan-product-images` **não pode mais** decidir órfão olhando só `products.images`. Correções:
- Passa a consultar `media_assets` (todas as referências de todas as entidades) como allowlist.
- `dry_run` por padrão; deleção real exige flag explícita.
- Nunca apaga nada com `status <> 'archived'`.
- Antes de qualquer deleção, exige que o asset tenha `backed_up_at` recente (sem backup → não deleta).
- Log de auditoria de tudo que for removido.

## Ordem de execução proposta

1. Migration: `media_assets` + grants + RLS + colunas `image_ref`.
2. Backfill + checksums (inventário e diagnóstico do que está `missing`).
3. Export ZIP completo (primeiro backup seguro) — **antes** de mexer em qualquer limpeza.
4. Endurecer o GC.
5. (Depois, separado) Re-upload das 8 imagens de ocasião perdidas e correção do hero `/src/assets`.

## Notas técnicas

- `media_assets` é dado sensível de operação → RLS admin-only, `service_role` para edges; sem acesso `anon`.
- `checksum_sha256` permite detectar corrupção e deduplicar.
- `img_ref` legível + único via `gen_external_ref`-style (slug + sufixo aleatório), seguindo o padrão `external_ref` que o projeto já usa em products/categories/occasions.
- Export usa `service_role` para baixar binários ignorando RLS; ZIP em streaming para aguentar centenas de arquivos.
- Nenhuma correção de dados é feita nesta fase — primeiro inventariar e fazer backup, depois restaurar.

Quer que eu já comece pela Etapa 1 + 2 (criar o `media_assets` e rodar o inventário/backfill para listar exatamente o que está são e o que está perdido), ou prefere que eu priorize a Etapa 3 (gerar imediatamente o primeiro ZIP de backup do que ainda existe no cloud)?