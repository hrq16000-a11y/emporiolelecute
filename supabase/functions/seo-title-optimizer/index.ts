// Sugestões determinísticas de título SEO (<= 60 caracteres) para produtos
// com nome longo, e aplicação em lote em products.seo_title.
// Uso restrito a administradores autenticados. Sem IA.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const MAX = 60;

// Palavras de baixo valor semântico que podem sair do título sem perder busca.
const FILLERS = [
  "com", "para", "de", "da", "do", "das", "dos", "em", "e", "ou", "a", "o", "as", "os",
  "sua", "seu", "muito", "super", "lindo", "linda", "lindos", "lindas", "exclusivo",
  "exclusiva", "especial", "artesanal feito à mão", "feito à mão", "unidade", "un",
];

function shorten(name: string): string {
  const clean = name.replace(/\s+/g, " ").trim();
  if (clean.length <= MAX) return clean;

  // 1) remove tudo após separadores editoriais (– | — | - | :) mantendo o núcleo
  let base = clean.split(/\s+[–—|:]\s+/)[0].trim();
  if (base.length <= MAX && base.length >= 25) return base;

  // 2) remove parênteses e conteúdo entre eles
  base = clean.replace(/\s*\([^)]*\)\s*/g, " ").replace(/\s+/g, " ").trim();
  if (base.length <= MAX && base.length >= 25) return base;

  // 3) remove palavras de baixo valor a partir do fim
  const words = base.split(" ");
  while (words.join(" ").length > MAX && words.length > 4) {
    let removed = false;
    for (let i = words.length - 1; i >= 2; i--) {
      if (FILLERS.includes(words[i].toLowerCase())) {
        words.splice(i, 1);
        removed = true;
        break;
      }
    }
    if (!removed) break;
  }
  base = words.join(" ");
  if (base.length <= MAX) return base;

  // 4) corta na fronteira de palavra
  const cut = base.slice(0, MAX);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 30 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;.–—-]+$/, "");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
  const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData } = await userClient.auth.getUser();
  const user = userData?.user;
  if (!user) return json({ error: "Unauthorized" }, 401);
  const { data: isAdmin } = await admin.rpc("has_role", { _user_id: user.id, _role: "admin" });
  if (isAdmin !== true) return json({ error: "Forbidden" }, 403);

  let body: { action?: string; ids?: string[] } = {};
  try { body = await req.json(); } catch { /* ignore */ }
  const action = body.action === "apply" ? "apply" : "suggest";

  const { data: products, error } = await admin
    .from("products")
    .select("id,name,slug,seo_title")
    .eq("is_active", true)
    .order("name");
  if (error) return json({ error: error.message }, 500);

  const candidates = (products ?? [])
    .map((p) => {
      const current = (p.seo_title || p.name || "").trim();
      return {
        id: String(p.id),
        name: String(p.name ?? ""),
        slug: String(p.slug ?? ""),
        current,
        current_length: current.length,
        suggestion: shorten(String(p.name ?? "")),
        has_seo_title: !!p.seo_title,
      };
    })
    .map((c) => ({ ...c, suggestion_length: c.suggestion.length }))
    .filter((c) => c.current_length > MAX && c.suggestion.length <= MAX && c.suggestion !== c.current);

  if (action === "suggest") {
    return json({ max_length: MAX, total: candidates.length, candidates, ran_at: new Date().toISOString() });
  }

  const wanted = Array.isArray(body.ids) && body.ids.length
    ? candidates.filter((c) => body.ids!.includes(c.id))
    : candidates;

  const applied: { id: string; name: string; seo_title: string }[] = [];
  const failed: { id: string; error: string }[] = [];

  for (const c of wanted) {
    const { error: upErr } = await admin
      .from("products")
      .update({ seo_title: c.suggestion })
      .eq("id", c.id);
    if (upErr) failed.push({ id: c.id, error: upErr.message });
    else applied.push({ id: c.id, name: c.name, seo_title: c.suggestion });
  }

  return json({
    applied_count: applied.length,
    failed_count: failed.length,
    applied,
    failed,
    ran_at: new Date().toISOString(),
  });
});
