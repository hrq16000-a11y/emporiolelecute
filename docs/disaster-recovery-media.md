# Disaster Recovery — Backup de Mídia (Fase 1)

Documento técnico do ciclo **backup → restore** de mídia do Empório LeleCute.
Escopo: somente domínio de mídia (bucket `product-images`). Não toca catálogo,
auth, CMS, SEO, pedidos ou customers.

## Problema anterior (auditoria)

- O sistema tinha inventário (`media_assets`), restore (`MediaRestorePanel`),
  GC (`cleanup-orphan-product-images`) e manifesto (`admin-media-backup`),
  **mas nenhum backup físico dos binários**.
- `backed_up_at` era carimbado quando o **manifesto JSON** era gerado → **falso
  positivo**: o banco achava que havia backup, mas não havia arquivo nenhum.
- O restore dependia de um ZIP com binários que o sistema **nunca produzia**.
- Perda do bucket = perda definitiva das imagens.
- Veredito: **D) Não confiável para disaster recovery.**

## O que mudou nesta sprint

### 1. Export real de binários (ZIP autossuficiente)
- Painel `MediaExportPanel` (aba "Backup completo" em `/admin/media-backup`).
- Botão **"Gerar backup completo (ZIP)"**:
  1. `admin-media-backup` action `export_manifest` retorna todos os assets com
     binário físico (`status in active|archived`) + `public_url` + `size_bytes`.
  2. O navegador baixa cada binário, calcula **SHA-256** (Web Crypto) e adiciona
     ao ZIP em `files/<img_ref>.<ext>`.
  3. Monta `manifest.json` (version 2) com, por asset: `img_ref`, `storage_path`,
     `bucket`, `size_bytes`, `sha256`, `content_type`, `entity_type`, `field`,
     `public_url` e `file`.
  4. Gera e baixa `emporio-media-backup-<data>.zip`.
- **Todo** asset do manifesto possui binário correspondente dentro do ZIP. A
  restauração **não usa URLs** — lê o binário do próprio pacote.

### 2. Correção da semântica de `backed_up_at` (fim do falso positivo)
- `admin-media-backup` action `manifest` **não carimba mais** `backed_up_at`.
- `media-backup-cron` **não carimba mais** `backed_up_at` (auditoria não gera
  binários).
- `backed_up_at` só é preenchido por `confirm_backup`, e **somente quando o
  backup inteiro foi concluído** (`runComplete = nenhuma falha e exportados ==
  total`). Falha parcial → `backed_up_at` permanece nulo.
- Carimbos legados sem checksum foram limpos por migração de dados, então a
  cobertura passou a refletir a realidade (0% até o primeiro ZIP real).

### 3. Checksum SHA-256
- Calculado no momento do export, para cada binário (a partir dos exatos bytes
  que entram no ZIP).
- Persistido em `media_assets.checksum_sha256` via `confirm_backup`.
- Presente no `manifest.json` (`sha256` + `size_bytes` por asset).

### 4. Validação no restore
- Antes do upload, `MediaRestorePanel` valida cada item:
  1. existência do binário no ZIP;
  2. **tamanho** (`size_bytes` do manifesto vs. bytes reais);
  3. **checksum** SHA-256 recalculado vs. `sha256` do manifesto.
- Em divergência: o item **não é restaurado** e o erro é registrado em detalhe.

### 5. Proteção do GC
- `media_gc_candidates` agora exige `status='archived' AND backed_up_at IS NOT
  NULL AND checksum_sha256 IS NOT NULL` + idade mínima.
- Ou seja, só apaga o que tem **backup validado por integridade**. Remoção
  baseada apenas em manifesto tornou-se impossível.
- Em `dry_run` (padrão) hoje: **0 candidatos** — nada elegível sem backup real.

### 6. Auditoria de integridade + painel de cobertura
- `confirm_backup` registra cada execução em `media_backup_runs`
  (total, exportados, verificados, cobertura %, bytes, status complete/partial).
- Painel de cobertura (`coverage`) exibe: catalogados, exportados (backed_up),
  hashes válidos, cobertura %, itens faltantes e última validação.
- Backup só é marcado "completo" quando catalogados == verificados.

## Teste de Disaster Recovery (cenário: bucket vazio)

Premissa: banco preservado, `product-images` esvaziado.

1. Admin envia o ZIP gerado hoje em **Restaurar**.
2. `MediaRestorePanel` lê `manifest.json` e indexa `files/<img_ref>.<ext>`.
3. Para cada asset: valida existência + tamanho + checksum, depois faz `upload`
   (`upsert`) no `storage_path` original.
4. `relink` reescreve as URLs do banco a partir do catálogo (`img_ref`).

Resultado esperado:
- ZIP restaura **todos** os arquivos (224/224 quando a cobertura está em 100%).
- URLs públicas voltam a funcionar (mesmo `storage_path`).
- Produtos exibem imagens normalmente.
- **Nenhum download externo é necessário** — o ZIP é autossuficiente.

> Pré-condição: ter gerado pelo menos um ZIP completo (cobertura 100%) **antes**
> do incidente. A cobertura é monitorada no painel justamente para garantir isso.

## Evidência (estado verificado)
- `coverage`: 224 catalogados; após limpar o falso positivo, 0% até o primeiro
  ZIP real (com_checksum = 0).
- `export_manifest`: retorna os 224 assets com `public_url` + `size_bytes`.
- `cleanup-orphan-product-images` (dry_run): `candidates: 0` (GC protegido).

## Arquivos
- `supabase/functions/admin-media-backup/index.ts` — actions `export_manifest`,
  `confirm_backup`, `coverage`; `manifest` sem carimbo.
- `supabase/functions/media-backup-cron/index.ts` — remove carimbo de backup.
- `supabase/functions/cleanup-orphan-product-images/index.ts` — inalterado
  (depende do `media_gc_candidates` endurecido).
- `src/components/admin/MediaExportPanel.tsx` — export físico + cobertura.
- `src/components/admin/MediaRestorePanel.tsx` — validação de integridade.
- `src/lib/sha256.ts` — helpers SHA-256 / extensão.
- `src/pages/admin/AdminMediaBackup.tsx` — aba "Backup completo".
- Migração: tabela `media_backup_runs` + endurecimento de `media_gc_candidates`.
