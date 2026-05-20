# Exportar/Importar admin com chave global

## Objetivo
Permitir backup e migração completa do catálogo + pedidos via painel admin, **independente de UUIDs**. A relação produto ↔ imagem ↔ taxonomias é preservada por um identificador estável chamado `external_ref`.

## 1. Chave global `external_ref`

Migração que adiciona coluna `external_ref TEXT UNIQUE NOT NULL` nas tabelas:
- `products`, `categories`, `occasions`, `tags`, `segments`, `kits`

Formato: `{tipo}_{slug-normalizado}` (ex: `prd_lembrancinha-sabonete-pezinho-coracao`, `cat_casamentos`). Humano-legível, estável, único.

Trigger `BEFORE INSERT`: se `external_ref` for nulo, gera automaticamente a partir do slug. Backfill imediato para todas as linhas existentes.

## 2. Página admin `/admin/exportar-importar`

UI com 2 abas:

**Exportar** — checkboxes:
- Catálogo (produtos + taxonomias + kits + relacionamentos)
- Imagens (do bucket `product-images`)
- Pedidos e clientes (com aviso de LGPD)
- SQL dump (INSERTs prontos)

Botão "Gerar backup" → chama edge function → recebe manifest JSON + URLs assinadas → monta `.zip` no navegador (JSZip) com:

```
backup-YYYY-MM-DD.zip
├── manifest.json         # versão, data, escopo
├── catalog.json          # produtos + taxonomias + relacionamentos por external_ref
├── orders.json           # opcional
├── catalog.sql           # INSERTs prontos (opcional)
└── images/
    ├── prd_pezinho-coracao__01.jpg
    ├── prd_pezinho-coracao__02.jpg
    └── ...
```

**Importar** — upload do ZIP:
- Lê manifest e mostra preview (X produtos, Y imagens, Z pedidos)
- Modo: "merge" (atualiza por external_ref, cria novos) ou "replace" (apaga tudo antes — com confirmação dupla)
- Faz upload das imagens primeiro, depois envia manifest para edge function que recria registros casando por external_ref

## 3. Edge functions

- `admin-backup-export` (POST, requer role admin)
  - Recebe `{ scope: { catalog, images, orders, sql } }`
  - Retorna JSON com `catalog`, `orders`, `sqlDump`, e `images: [{ external_ref, idx, signed_url, filename }]`
  - Usa service-role internamente

- `admin-backup-import` (POST, requer role admin)
  - Recebe `{ manifest, mode: 'merge'|'replace' }`
  - Resolve external_ref → UUID local existente ou cria novo
  - Mantém relacionamentos product↔category↔tag↔occasion↔segment
  - Atualiza array `products.images[]` com URLs públicas das imagens já uploadadas
  - Retorna relatório `{ created, updated, skipped, errors[] }`

## 4. Detalhes técnicos
- JSZip já costuma estar disponível; instalo se faltar
- Imagens trafegam direto cliente↔storage (signed upload URLs) para evitar limite de payload das edge functions
- Pedidos exportados omitem nada — mas UI mostra aviso LGPD claro antes do download
- Trigger automático: novo produto/categoria sem `external_ref` recebe um gerado a partir do slug

## Fora do escopo desta versão
- Versionamento de backups armazenados no Cloud (export é download direto)
- Diff visual antes do import (apenas contagens)
- Import incremental por arquivo individual

## Entrega
1 migração + 2 edge functions + 1 página admin + link no menu lateral admin.
