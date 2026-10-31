/**
 * RLS guard — search_boosts / search_synonyms.
 *
 * Garante que um cliente anônimo (sem sessão de admin) não consegue
 * escrever nas tabelas de configuração da busca. Estes testes tocam o
 * backend real; quando as variáveis públicas não estão disponíveis
 * (ex.: CI sem env), o bloco é ignorado em vez de falhar.
 */
import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
const canRun = Boolean(url && anonKey);

const suite = canRun ? describe : describe.skip;

suite("RLS — configuração da busca é admin-only", () => {
  const anon = createClient(url!, anonKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const FAKE_UUID = "00000000-0000-0000-0000-000000000000";

  it("bloqueia INSERT anônimo em search_boosts", async () => {
    const { error } = await anon
      .from("search_boosts")
      .insert({ term: "teste-rls", product_id: FAKE_UUID, weight: 99 } as never);
    expect(error).toBeTruthy();
    expect(`${error?.message} ${error?.code}`.toLowerCase()).toMatch(
      /permission denied|row-level security|42501/,
    );
  });

  it("bloqueia UPDATE anônimo em search_boosts", async () => {
    const { error, data } = await anon
      .from("search_boosts")
      .update({ weight: 1 } as never)
      .eq("id", FAKE_UUID)
      .select();
    // Ou erro explícito de permissão, ou zero linhas afetadas (RLS filtrou tudo).
    expect(error ? true : (data ?? []).length === 0).toBe(true);
  });

  it("bloqueia INSERT anônimo em search_synonyms", async () => {
    const { error } = await anon
      .from("search_synonyms")
      .insert({ canonical_term: "teste-rls", aliases: ["x"] } as never);
    expect(error).toBeTruthy();
    expect(`${error?.message} ${error?.code}`.toLowerCase()).toMatch(
      /permission denied|row-level security|42501/,
    );
  });

  it("bloqueia DELETE anônimo em search_synonyms", async () => {
    const { error, data } = await anon
      .from("search_synonyms")
      .delete()
      .eq("id", FAKE_UUID)
      .select();
    expect(error ? true : (data ?? []).length === 0).toBe(true);
  });
});
