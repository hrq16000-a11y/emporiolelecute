/**
 * Privacidade de dados de clientes.
 *
 * Confirma que dados de contato de pedidos (client_phone / client_contact)
 * não vazam por leitura pública. O acesso legítimo acontece apenas via
 * Edge Function autenticada (rastreio por código) ou sessão de admin.
 */
import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
const canRun = Boolean(url && anonKey);

const suite = canRun ? describe : describe.skip;

const isDenied = (error: { message?: string; code?: string } | null, rows: unknown[] | null) => {
  if (error) {
    return /permission denied|row-level security|does not exist|42501/i.test(
      `${error.message} ${error.code}`,
    );
  }
  // Sem erro só é aceitável se a RLS devolveu zero linhas.
  return (rows ?? []).length === 0;
};

suite("Privacidade — contatos de pedidos não são públicos", () => {
  const anon = createClient(url!, anonKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  it("não expõe client_phone em orders para anônimos", async () => {
    const { data, error } = await anon.from("orders").select("id, client_phone").limit(5);
    expect(isDenied(error, data as unknown[] | null)).toBe(true);
  });

  it("não expõe client_contact em orders para anônimos", async () => {
    const { data, error } = await anon.from("orders").select("id, client_contact").limit(5);
    expect(isDenied(error, data as unknown[] | null)).toBe(true);
  });

  it("não permite listagem de customers para anônimos", async () => {
    const { data, error } = await anon.from("customers").select("id, phone, email").limit(5);
    expect(isDenied(error, data as unknown[] | null)).toBe(true);
  });

  it("não permite listagem completa de orders para anônimos", async () => {
    const { data, error } = await anon.from("orders").select("id").limit(1);
    expect(isDenied(error, data as unknown[] | null)).toBe(true);
  });
});
