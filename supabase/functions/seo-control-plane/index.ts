// SEO Control Plane — server-side observability + guardrails.
// Runs diffs (DB ↔ sitemap ↔ prerender), simulates bots against the prerender
// edge function, classifies findings by severity + impact, persists one row
// in `seo_check_runs` with source='control_plane'.
//
// Triggered by: POST /seo-control-plane  (admin-only, JWT enforced in-code)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { productPath } from "../_shared/urls.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const ORIGIN = "https://emporiolelecute.com.br";
const PRERENDER_URL = `${SUPABASE_URL}/functions/v1/prerender`;
const PRERENDER_TIMEOUT_MS = 10_000;
const MAX_FINDINGS = 200;

const admin = createClient(SUPABASE_URL, SERVICE_KEY);

type Severity = "critical" | "warning" | "ok";
type Impact = "indexation" | "social_preview" | "data_integrity";

interface Finding {
  id: string;
  severity: Severity;
  impact: Impact;
  category: string;
  message: string;
  url?: string;
  evidence?: string;
}

// Routes the prerender function knows how to render (mirrors resolve() there).
const PRERENDER_HANDLED_PREFIXES = [
  "/", "/produtos", "/sobre", "/contato", "/blog",
  "/produto/", "/categoria/", "/ocasiao/", "/tag/", "/blog/",
  "/lembrancinhas-",
];

// Routes that must never be in the sitemap or prerendered.
const EXCLUDED_PREFIXES = [
  "/admin", "/carrinho", "/checkout", "/buscar", "/rastrear",
  "/loja", "/auth", "/login", "/orcamento",
];

const isExcluded = (path: string) =>
  EXCLUDED_PREFIXES.some((p) => path === p || path.startsWith(p + "/") || path.startsWith(p));

const hasPrerenderHandler = (path: string) =>
  PRERENDER_HANDLED_PREFIXES.some((p) =>
    p.endsWith("/") || p.endsWith("-") ? path.startsWith(p) : path === p,
  );

async function fetchWithTimeout(url: string, init: RequestInit = {}, ms = PRERENDER_TIMEOUT_MS) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

async function callPrerender(path: string, userAgent: string) {
  const url = `${PRERENDER_URL}?path=${encodeURIComponent(path)}`;
  const res = await fetchWithTimeout(url, {
    headers: {
      Authorization: `Bearer ${ANON_KEY}`,
      apikey: ANON_KEY,
      "User-Agent": userAgent,
    },
  });
  const html = await res.text();
  return {
    status: res.status,
    cacheControl: res.headers.get("cache-control") || "",
    html,
  };
}

function validateHtml(path: string, html: string, expectNoindex: boolean): Finding[] {
  const found: Finding[] = [];
  const has = (re: RegExp) => re.test(html);
  const isProduct = path.startsWith("/produto/");

  const titleMatch = html.match(/<title>([^<]*)<\/title>/i);
  if (!titleMatch || !titleMatch[1].trim()) {
    found.push({
      id: `html:title:${path}`, severity: "critical", impact: "indexation",
      category: "bot_simulation", message: "Title ausente ou vazio",
      url: path, evidence: titleMatch?.[1]?.slice(0, 80),
    });
  }

  if (!has(/<meta\s+name=["']description["']\s+content=["'][^"']+["']/i)) {
    found.push({
      id: `html:desc:${path}`, severity: "critical", impact: "indexation",
      category: "bot_simulation", message: "Meta description ausente", url: path,
    });
  }

  if (!has(/<link\s+rel=["']canonical["']\s+href=["'][^"']+["']/i)) {
    found.push({
      id: `html:canonical:${path}`, severity: "warning", impact: "indexation",
      category: "bot_simulation", message: "Canonical ausente", url: path,
    });
  }

  if (!has(/<meta\s+property=["']og:image["']\s+content=["'][^"']+["']/i)) {
    found.push({
      id: `html:og:${path}`, severity: "warning", impact: "social_preview",
      category: "bot_simulation", message: "OG image ausente", url: path,
    });
  }

  const ldMatches = [...html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)];
  let validLd = 0;
  for (const m of ldMatches) {
    try { JSON.parse(m[1]); validLd++; } catch { /* ignore */ }
  }
  if (validLd === 0) {
    found.push({
      id: `html:jsonld:${path}`,
      severity: isProduct ? "critical" : "warning",
      impact: "indexation",
      category: "bot_simulation",
      message: "Nenhum JSON-LD válido", url: path,
    });
  }

  const hasNoindex = /<meta\s+name=["']robots["']\s+content=["'][^"']*noindex/i.test(html);
  if (expectNoindex && !hasNoindex) {
    found.push({
      id: `html:noindex:${path}`, severity: "critical", impact: "indexation",
      category: "bot_simulation", message: "Rota inválida sem noindex (soft-404)", url: path,
    });
  }
  if (!expectNoindex && hasNoindex) {
    found.push({
      id: `html:unexpected_noindex:${path}`, severity: "warning", impact: "indexation",
      category: "bot_simulation", message: "Rota indexável marcada como noindex", url: path,
    });
  }

  return found;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const run_timestamp = new Date().toISOString();
  const findings: Finding[] = [];

  // --- Auth: only admins -----------------------------------------------------
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("missing auth");
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) throw new Error("unauthorized");
    const { data: isAdmin } = await admin.rpc("has_role", {
      _user_id: userData.user.id, _role: "admin",
    });
    if (!isAdmin) throw new Error("forbidden");
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message) }), {
      status: 401, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  // --- 1. Snapshot DB --------------------------------------------------------
  const [productsRes, catsRes, occRes, tagsRes, pagesRes, landingsRes] = await Promise.all([
    admin.from("products").select("slug,updated_at").eq("is_active", true).lte("updated_at", run_timestamp),
    // Bloco 3 SAFE: leitura pública só vê publicadas (is_draft=false). Tags não têm is_draft.
    admin.from("categories").select("slug,is_indexed,is_draft,updated_at").lte("updated_at", run_timestamp),
    admin.from("occasions").select("slug,is_indexed,is_draft,updated_at").lte("updated_at", run_timestamp),
    admin.from("tags").select("slug,is_indexed,updated_at").lte("updated_at", run_timestamp),
    admin.from("pages").select("slug,updated_at").lte("updated_at", run_timestamp),
    admin.from("occasion_landings").select("slug,updated_at").lte("updated_at", run_timestamp),
  ]);

  const dbPaths = new Set<string>();
  productsRes.data?.forEach((r: any) => r.slug && dbPaths.add(productPath(r.slug)));
  catsRes.data?.forEach((r: any) => r.is_indexed !== false && r.is_draft === false && r.slug && dbPaths.add(`/categoria/${r.slug}`));
  occRes.data?.forEach((r: any) => r.is_indexed !== false && r.is_draft === false && r.slug && dbPaths.add(`/ocasiao/${r.slug}`));
  tagsRes.data?.forEach((r: any) => r.is_indexed !== false && r.slug && dbPaths.add(`/tag/${r.slug}`));
  pagesRes.data?.forEach((r: any) => r.slug && dbPaths.add(`/${r.slug}`));
  landingsRes.data?.forEach((r: any) => r.slug && dbPaths.add(`/lembrancinhas-${r.slug}`));

  // --- 2. Snapshot Sitemap ---------------------------------------------------
  const sitemapPaths = new Set<string>();
  try {
    const res = await fetchWithTimeout(
      `${ORIGIN}/sitemap.xml?run=${encodeURIComponent(run_timestamp)}`,
      { headers: { "Cache-Control": "no-cache" } },
      8000,
    );
    if (!res.ok) throw new Error(`sitemap http ${res.status}`);
    const xml = await res.text();
    for (const m of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
      try {
        const u = new URL(m[1]);
        sitemapPaths.add(u.pathname.replace(/\/$/, "") || "/");
      } catch { /* ignore */ }
    }
  } catch (e) {
    findings.push({
      id: "sitemap:fetch_failed", severity: "warning", impact: "data_integrity",
      category: "sitemap", message: `Sitemap inacessível: ${(e as Error).message}`,
    });
  }

  // --- 3. Diffs --------------------------------------------------------------
  // 3a. DB ⇒ Sitemap
  for (const p of dbPaths) {
    if (!sitemapPaths.has(p)) {
      findings.push({
        id: `diff:missing_in_sitemap:${p}`, severity: "warning", impact: "data_integrity",
        category: "diff", message: "URL indexável no DB sem entrada no sitemap", url: p,
      });
      if (findings.length >= MAX_FINDINGS) break;
    }
  }
  // 3b. Sitemap ⇒ DB (orphans)
  for (const p of sitemapPaths) {
    if (isExcluded(p)) continue;
    const isStatic = ["/", "/produtos", "/sobre", "/contato", "/blog"].includes(p);
    if (isStatic) continue;
    if (!dbPaths.has(p)) {
      findings.push({
        id: `diff:orphan_in_sitemap:${p}`, severity: "warning", impact: "data_integrity",
        category: "diff", message: "URL no sitemap não corresponde a registro do DB", url: p,
      });
      if (findings.length >= MAX_FINDINGS) break;
    }
  }
  // 3c. Sitemap ⇒ Prerender handler
  for (const p of sitemapPaths) {
    if (!hasPrerenderHandler(p)) {
      findings.push({
        id: `diff:no_prerender:${p}`, severity: "critical", impact: "indexation",
        category: "diff", message: "Rota no sitemap sem handler de prerender", url: p,
      });
      if (findings.length >= MAX_FINDINGS) break;
    }
  }

  // --- 4. Bot simulation -----------------------------------------------------
  const pickRandom = <T,>(arr: T[], n: number): T[] => {
    const a = [...arr]; const out: T[] = [];
    while (out.length < n && a.length) {
      out.push(a.splice(Math.floor(Math.random() * a.length), 1)[0]);
    }
    return out;
  };

  const productSamples = pickRandom(productsRes.data || [], 5).map((r: any) => productPath(r.slug));
  const catSamples = pickRandom(catsRes.data?.filter((r: any) => r.is_indexed !== false && r.is_draft === false) || [], 3).map((r: any) => `/categoria/${r.slug}`);
  const landingSamples = pickRandom(landingsRes.data || [], 2).map((r: any) => `/lembrancinhas-${r.slug}`);

  const fixedRoutes = [
    "/", "/produtos",
    productSamples[0] || "/produto/inexistente",
    catSamples[0] || "/categoria/inexistente",
    "/rota-control-plane-invalida-xyz",
  ];

  const botUAs: Record<string, string> = {
    googlebot: "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    facebook: "facebookexternalhit/1.1",
    twitter: "Twitterbot/1.0",
    linkedin: "LinkedInBot/1.0",
  };

  const targets: Array<{ path: string; expectNoindex: boolean; bot: string }> = [];
  fixedRoutes.forEach((p, i) => targets.push({
    path: p, expectNoindex: p === "/rota-control-plane-invalida-xyz",
    bot: i === 0 ? "googlebot" : i === 1 ? "facebook" : i === 4 ? "googlebot" : "googlebot",
  }));
  productSamples.slice(1).forEach((p) => targets.push({ path: p, expectNoindex: false, bot: "googlebot" }));
  catSamples.slice(1).forEach((p) => targets.push({ path: p, expectNoindex: false, bot: "googlebot" }));
  landingSamples.forEach((p) => targets.push({ path: p, expectNoindex: false, bot: "facebook" }));

  const cacheStats: { hits: number; total: number; samples: string[] } = { hits: 0, total: 0, samples: [] };

  await Promise.all(targets.map(async (t) => {
    try {
      const r = await callPrerender(t.path, botUAs[t.bot]);
      cacheStats.total++;
      if (/max-age=\d+/.test(r.cacheControl) && !/max-age=0/.test(r.cacheControl)) {
        cacheStats.hits++;
      }
      if (cacheStats.samples.length < 3) cacheStats.samples.push(`${t.path} → ${r.cacheControl || "no-cache-header"}`);
      if (r.status !== 200) {
        findings.push({
          id: `bot:status:${t.path}`, severity: "critical", impact: "indexation",
          category: "bot_simulation", message: `Prerender retornou ${r.status}`, url: t.path,
        });
        return;
      }
      validateHtml(t.path, r.html, t.expectNoindex).forEach((f) => findings.push(f));
    } catch (e) {
      findings.push({
        id: `bot:timeout:${t.path}`, severity: "warning", impact: "indexation",
        category: "bot_simulation",
        message: `Prerender timeout/erro: ${(e as Error).message}`, url: t.path,
      });
    }
  }));

  // --- 5. Tally + persist ----------------------------------------------------
  const trimmed = findings.slice(0, MAX_FINDINGS);
  const errors = trimmed.filter((f) => f.severity === "critical").length;
  const warnings = trimmed.filter((f) => f.severity === "warning").length;
  const total =
    dbPaths.size + sitemapPaths.size + targets.length;
  const passed = Math.max(0, total - errors - warnings);

  const checksPayload = {
    run_timestamp,
    db_count: dbPaths.size,
    sitemap_count: sitemapPaths.size,
    bot_simulation_count: targets.length,
    cache: cacheStats,
    findings: trimmed,
  };

  const { data: runRow, error: runErr } = await admin
    .from("seo_check_runs")
    .insert({
      source: "control_plane",
      total, passed, errors, warnings,
      checks: checksPayload,
    })
    .select("id, ran_at")
    .single();

  if (runErr) {
    return new Response(JSON.stringify({ error: runErr.message, partial: checksPayload }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({
    id: runRow!.id,
    ran_at: runRow!.ran_at,
    summary: { total, passed, errors, warnings },
    cache: cacheStats,
    findings: trimmed,
  }), { headers: { ...cors, "Content-Type": "application/json" } });
});
