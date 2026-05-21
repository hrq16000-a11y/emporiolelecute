
# Estabilização do SAVE — AdminProductForm

## Pré-requisitos validados

Consultei `pg_constraint` direto no banco:

- `product_occasions(product_id, occasion_id)` — **PK composta ✅** + FKs `ON DELETE CASCADE`
- `product_tags(product_id, tag_id)` — **PK composta ✅** + FKs `ON DELETE CASCADE`
- `product_segments(product_id, segment_id)` — **PK composta ✅** + FKs `ON DELETE CASCADE`

→ **Não há necessidade** de auditar duplicatas históricas nem criar constraints. Diff incremental com `ON CONFLICT DO NOTHING` é seguro.

Outros pontos verificados:

- `products.updated_at` existe e é mantido por trigger (`update_updated_at_column`)
- Padrão de referência `create_order_with_items(_order jsonb, _items jsonb)` já estabelecido — RPC nova seguirá a mesma estrutura (`SECURITY DEFINER`, `SET search_path = public`, validação de papel no topo, transação implícita do bloco PL/pgSQL)
- Roles disponíveis: `admin`, `editor` (via `has_role()`)
- Toast/navigate duplicados confirmados em `AdminProductForm.tsx` linhas 358-368
- `useEffect` de hidratação (linhas 117-145) **rehidrata em toda mudança de referência** de `existingProduct` — bug P0
- `useUpdateProductTags` invalida apenas `['product_tags', id]`; `useUpdateProductSegments` invalida `['products']` + `['product']`; nenhum invalida `['product-by-id-or-slug']` (novo do ciclo anterior)

## Arquivos impactados

| Arquivo | Mudança |
|---|---|
| `src/pages/admin/AdminProductForm.tsx` | Remove toast/navigate dup, funde badge/flags no payload (Fase 1), troca cadeia de mutations por `useSaveProductFull` (Fase 2), guard de hidratação |
| `src/hooks/useProducts.ts` | Adiciona `useSaveProductFull` + mapeamento de erros tipados |
| `supabase/migrations/*` | Cria RPC `save_product_full(_payload jsonb)` |

Sem mudanças em: `useTags`, `useSegments`, `ImageUploader`, rotas, UI pública.

---

## FASE 1 — Quick wins (client-side, sem migração)

### 1A. Toast + navigate duplicados
Remover o bloco duplicado em `handleSubmit` (linhas 363-368). Mantém uma única chamada de cada.

### 1B. Fundir UPDATE redundante de badge/flags
`pdp_badge_override`, `show_quick_summary`, `show_min_quantity` passam para dentro de `productData` (o payload já enviado ao `useUpdateProduct`/`useCreateProduct`). Elimina o `supabase.from('products').update(...).eq('id', productId)` da linha 348.

Ganho: −1 RTT, −1 trigger de `updated_at`, −1 ponto de falha.

### 1C. Guard de hidratação (bug P0)
Trocar `useEffect(existingProduct)` por hidratação **única**:

```ts
const hydratedRef = useRef(false);
useEffect(() => {
  if (hydratedRef.current) return;          // já hidratou — refetch não sobrescreve
  if (!existingProduct || !isEditing) return;
  hydratedRef.current = true;
  setFormData({ ...mapDbToForm(existingProduct) });
  // setKeywordsInput, setSelectedOccasions, etc. continuam aqui
}, [existingProduct, isEditing]);
```

Após save bem-sucedido, o estado local já reflete o que foi enviado — refetch valida no servidor mas não pisa no form. Para "Salvar e ir para próximo produto", `hydratedRef.current = false` é resetado quando `id` muda (use `useEffect` dependente de `id` para resetar).

### 1D. Invalidação completa no client (interim)
Enquanto a RPC ainda não existe, ajustar o `onSuccess` da cadeia atual para invalidar:

- `['products']`
- `['product-by-id-or-slug', routeParam]`
- `['product', slug]`
- `['product_tags', id]`

---

## FASE 2 — RPC transacional `save_product_full`

### Assinatura

```sql
save_product_full(_payload jsonb) RETURNS jsonb
-- SECURITY DEFINER, SET search_path = public
-- Retorna: { id, slug, updated_at, row }
```

Validação no topo:
```sql
IF auth.uid() IS NULL THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
IF NOT (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'editor'))
   THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
```

### Payload (jsonb)

```jsonc
{
  "id": "uuid | null",                  // null = create
  "expected_updated_at": "iso | null",  // null em create; obrigatório em update
  "product": { /* todos os campos de products, incl. badge/flags */ },
  "occasion_ids": ["uuid", ...],
  "tag_ids":      ["uuid", ...],
  "segment_ids":  ["uuid", ...]
}
```

### Lock otimista (update)

```sql
UPDATE public.products
   SET (...) = (...), updated_at = now()
 WHERE id = _id AND updated_at = _expected_updated_at
RETURNING * INTO v_row;

IF NOT FOUND THEN
  RAISE EXCEPTION 'stale_version'
    USING ERRCODE = '40001', HINT = 'stale_version';
END IF;
```

### Diff incremental dos pivôs

Padrão único reusado para `occasions`, `tags`, `segments`:

```sql
-- DELETE seletivo (só o que saiu)
DELETE FROM public.product_occasions
 WHERE product_id = v_id
   AND occasion_id NOT IN (SELECT unnest(_occ_ids));

-- INSERT seletivo (idempotente via PK composta)
INSERT INTO public.product_occasions (product_id, occasion_id)
SELECT v_id, x FROM unnest(_occ_ids) x
ON CONFLICT (product_id, occasion_id) DO NOTHING;
```

Bloco PL/pgSQL = transação implícita → rollback total em qualquer erro.

### Códigos de erro mapeados no client

| ERRCODE | HINT | UX |
|---|---|---|
| `40001` | `stale_version` | Modal "outro admin editou — recarregar?" |
| `23505` | (slug) | Inline: "slug em uso" |
| `23503` | — | Toast: "Referência inválida (categoria/tag removida)" |
| `42501` | — | Toast: "Sem permissão" |
| `23514` | — | Toast: "Slug reservado ou inválido" |
| outro | — | Toast genérico + console.error |

### Hook `useSaveProductFull`

Mutation única que chama `supabase.rpc('save_product_full', { _payload })`. No `onSuccess`:

```ts
qc.invalidateQueries({ queryKey: ['products'] });
qc.invalidateQueries({ queryKey: ['product-by-id-or-slug', data.slug] });
qc.invalidateQueries({ queryKey: ['product', data.slug] });
qc.invalidateQueries({ queryKey: ['product_tags', data.id] });
```

`AdminProductForm.handleSubmit` passa a montar **um único payload** e chamar `useSaveProductFull`. Remove imports `useUpdateProduct`, `useUpdateProductTags`, `useUpdateProductSegments` e o bloco de `supabase.from('product_occasions')...`.

---

## Fora de escopo (NÃO faremos agora)

- Staging bucket / cleanup de uploads órfãos
- Autosave server-side
- Optimistic UI
- Realtime / websocket sync
- Outbox / event sourcing
- Save por seção

---

## Riscos

1. **`expected_updated_at` ausente no primeiro save** após abrir tela → garantir que `existingProduct.updated_at` é capturado no momento da hidratação e re-lido após save bem-sucedido (o RPC retorna o novo `updated_at`).
2. **Editor sem permissão de UPDATE em pivôs via RLS** — `SECURITY DEFINER` bypassa RLS; checagem de papel no topo da RPC é a única barreira → testar com usuário `editor`.
3. **Trigger `enforce_product_category`** dispara se `category_id` IS NULL → RPC deve validar antes e devolver mensagem clara.
4. **`hydratedRef` + troca de URL** (UUID → slug canônico que já fizemos) — resetar o ref quando `id` muda, não quando `routeParam` muda, para não disparar com o redirect canônico.

## QA manual obrigatório

1. Editar produto, salvar, conferir que pivôs (tags/segmentos/ocasiões) refletem exatamente o selecionado.
2. Abrir mesmo produto em 2 abas, salvar na aba 1, salvar na aba 2 → aba 2 recebe modal "stale_version".
3. Editar campo → enquanto refetch acontece em background → confirmar que valor digitado não some.
4. Slug duplicado → toast inline correto.
5. Login como `editor` → save funciona; como visitante → 42501.
6. Criar produto novo (sem id) → ok, sem `expected_updated_at`.
7. Salvar com tag/ocasião/segmento removido por outro admin → 23503 com mensagem clara.

## Ordem de entrega

1. **Migração** (RPC + grants).
2. **Quick wins** (1A–1D) no mesmo PR — já consertam P0 mesmo antes do client adotar a RPC.
3. **Hook `useSaveProductFull`** + swap em `handleSubmit`.
4. Remover hooks órfãos (`useUpdateProductTags`/`useUpdateProductSegments`) **somente** após confirmar que nenhum outro consumidor os usa (vou grep antes de remover).
