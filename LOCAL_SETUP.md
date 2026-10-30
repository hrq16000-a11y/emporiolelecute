# Rodando o Empório LeleCute 100% local (sem nuvem)

Guia rápido para desenvolver e testar sem depender de nenhum serviço externo.
Depois do primeiro `supabase start`, tudo funciona **offline**.

---

## 1. Pré-requisitos

| Ferramenta | Versão | Observação |
| --- | --- | --- |
| Docker Desktop | 4.x+ | precisa estar **rodando** antes de tudo |
| Node.js | 20+ | ou Bun 1.x |
| Supabase CLI | 1.200+ | `npm i -g supabase` ou `brew install supabase/tap/supabase` |

## 2. Subir o backend local

```bash
supabase start
```

O CLI baixa as imagens (só na primeira vez, precisa de internet) e sobe
Postgres, Auth, Storage, Realtime e o Studio:

- API: `http://127.0.0.1:54321`
- Studio: `http://127.0.0.1:54323`
- Inbucket (e-mails de teste): `http://127.0.0.1:54324`
- Postgres: `postgresql://postgres:postgres@127.0.0.1:54322/postgres`

Todas as migrações de `supabase/migrations/` são aplicadas em ordem e o
`supabase/seed.sql` roda em seguida.

## 3. Variáveis de ambiente

```bash
cp .env.example .env.local
```

O Vite prioriza `.env.local` sobre `.env`, então o frontend passa a apontar
para `http://127.0.0.1:54321` — **nunca** para produção. Para voltar à nuvem,
basta remover ou renomear o `.env.local`.

## 4. Rodar o frontend

```bash
npm install
npm run dev:local
```

`dev:local` pula a geração de sitemap (que exige rede) e sobe o Vite em
`http://localhost:8080`.

## 5. Edge Functions locais

```bash
npm run functions:serve
```

Equivale a `supabase functions serve --no-verify-jwt --env-file supabase/.env.local`.
Crie o arquivo de secrets (opcional — sem ele os mocks assumem):

```bash
printf 'LOCAL_MODE=true\n' > supabase/.env.local
```

### Mocks offline

Com `LOCAL_MODE=true` (ou `SUPABASE_URL` apontando para localhost), o helper
`supabase/functions/_shared/localEnv.ts` faz o bypass das integrações de
terceiros. Resend, IndexNow, Bing e Google Search Console **não são chamados**:
o código registra um `console.log('[local-mock] ...')` e devolve sucesso
simulado, então nenhum fluxo trava sem internet.

E-mails reais também podem ser inspecionados no Inbucket quando disparados
pelo Auth (magic link, recuperação de senha).

## 6. Dados de teste (seed)

O `supabase/seed.sql` é idempotente e cria:

- admin de teste — `admin@local.test` / senha `admin123` (papel `admin`)
- configurações básicas em `store_settings` (`seo_config`, `contact_info`,
  `payment_config`, `tracking_config` com tracking desligado, feature flags)
- 1 categoria, 1 ocasião e 2 produtos publicados para o catálogo não ficar vazio

Faça login em `http://localhost:8080/admin/login` com o admin acima.

## 7. Comandos úteis

| Comando | O que faz |
| --- | --- |
| `npm run dev:local` | Vite apontando para o Supabase local |
| `npm run supabase:start` / `:stop` | sobe / derruba o stack Docker |
| `npm run supabase:status` | mostra URLs e chaves locais |
| `npm run db:reset` | recria o banco do zero (migrações + seed) |
| `npm run db:diff` | gera uma nova migração a partir de alterações no Studio |
| `npm run functions:serve` | serve todas as Edge Functions localmente |
| `npm run test` | testes unitários (Vitest) |
| `npm run test:e2e` | testes end-to-end (Playwright) |

## 8. Problemas comuns

- **`supabase start` falha com porta em uso** → `supabase stop --no-backup` e tente de novo.
- **Frontend ainda bate em produção** → confirme que `.env.local` existe e
  reinicie o Vite (variáveis são lidas no boot).
- **Storage vazio** → imagens de produção não são baixadas; suba arquivos pelo
  Studio no bucket `product-images` ou use os placeholders do seed.
- **Função retorna 401** → use `--no-verify-jwt` (já incluso em `functions:serve`).
