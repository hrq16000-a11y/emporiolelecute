import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface RobotsConfig {
  allow_indexing?: boolean;
  disallow_paths?: string[];
  disallow_query_params?: string[];
  blocked_category_slugs?: string[];
  custom_directives?: string;
  sitemap_url?: string;
}

const DEFAULTS: Required<RobotsConfig> = {
  allow_indexing: true,
  disallow_paths: ["/admin", "/admin/*", "/carrinho", "/rastrear"],
  disallow_query_params: ["ordem", "preco_min", "preco_max", "pagina", "busca", "search"],
  blocked_category_slugs: [],
  custom_directives: "",
  sitemap_url: "https://emporiolelecute.com.br/sitemap.xml",
};

function build(cfg: Required<RobotsConfig>): string {
  const lines: string[] = ["User-agent: *"];
  if (!cfg.allow_indexing) {
    lines.push("Disallow: /");
  } else {
    lines.push("Allow: /");
    for (const p of cfg.disallow_paths) lines.push(`Disallow: ${p}`);
    const params = Array.isArray(cfg.disallow_query_params) ? cfg.disallow_query_params : [];
    for (const param of params) {
      const clean = String(param || "").trim().replace(/[=*?&]/g, "");
      if (clean) lines.push(`Disallow: /*?${clean}=*`);
    }
    for (const slug of cfg.blocked_category_slugs) {
      lines.push(`Disallow: /produtos?categoria=${slug}`);
    }
    // Reforço explícito: Googlebot e Bingbot liberados para todo o conteúdo indexável.
    for (const bot of ["Googlebot", "Googlebot-Image", "Bingbot"]) {
      lines.push("");
      lines.push(`User-agent: ${bot}`);
      lines.push("Allow: /");
      for (const p of cfg.disallow_paths) lines.push(`Disallow: ${p}`);
    }
  }
  if (cfg.custom_directives.trim()) {
    lines.push("");
    lines.push(cfg.custom_directives.trim());
  }
  if (cfg.sitemap_url) {
    lines.push("");
    lines.push(`Sitemap: ${cfg.sitemap_url}`);
  }
  return lines.join("\n") + "\n";
}


Deno.serve(async (_req) => {
  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data } = await sb
      .from("store_settings")
      .select("value")
      .eq("key", "robots_config")
      .maybeSingle();
    const cfg = { ...DEFAULTS, ...((data?.value as RobotsConfig) ?? {}) };
    return new Response(build(cfg), {
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=300" },
    });
  } catch (e) {
    return new Response(build(DEFAULTS), {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
});
