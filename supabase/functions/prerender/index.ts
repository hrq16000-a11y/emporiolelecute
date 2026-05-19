// Edge prerender — serve crawler-friendly HTML for SPA routes.
// Designed to sit BEHIND a Cloudflare Worker that gates by User-Agent
// (only bots reach this function). See docs/PRERENDER_STRATEGY.md.
//
// Contract: GET /prerender?path=/produto/abc
// Returns: 200 text/html with full <head> (title/description/canonical/OG/
//   Twitter/JSON-LD) and a minimal readable <body> derived from real DB data.
// Unknown routes -> 200 + <meta name="robots" content="noindex,follow">
// (avoids soft-404 because the SPA also returns 200 for unknown paths).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { productPath } from "../_shared/urls.ts";

const ORIGIN = "https://emporiolelecute.com.br";
const SITE_NAME = "Empório LeleCute";
const DEFAULT_DESC =
  "Lembrancinhas artesanais personalizadas para maternidade, chá de bebê, batizado, casamento e aniversário.";
const DEFAULT_IMAGE = `${ORIGIN}/og-image.webp`;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

// --- helpers ---------------------------------------------------------------

const esc = (s: unknown) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const canonical = (path: string) => {
  const clean = path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
  return `${ORIGIN}${clean}`;
};

interface SeoPayload {
  title: string;
  description: string;
  image?: string;
  type?: string;
  jsonLd?: unknown[];
  h1: string;
  bodyHtml: string;
  noindex?: boolean;
  status?: number;
}

function renderHtml(path: string, seo: SeoPayload): string {
  const url = canonical(path);
  const img = seo.image || DEFAULT_IMAGE;
  const robots = seo.noindex ? "noindex,follow" : "index,follow";
  const type = seo.type || "website";
  const ldBlocks = (seo.jsonLd || [])
    .map(
      (ld) =>
        `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, "\\u003c")}</script>`,
    )
    .join("\n");

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="${robots}">
<title>${esc(seo.title)}</title>
<meta name="description" content="${esc(seo.description)}">
<link rel="canonical" href="${esc(url)}">
<meta property="og:type" content="${esc(type)}">
<meta property="og:site_name" content="${esc(SITE_NAME)}">
<meta property="og:title" content="${esc(seo.title)}">
<meta property="og:description" content="${esc(seo.description)}">
<meta property="og:url" content="${esc(url)}">
<meta property="og:image" content="${esc(img)}">
<meta property="og:locale" content="pt_BR">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(seo.title)}">
<meta name="twitter:description" content="${esc(seo.description)}">
<meta name="twitter:image" content="${esc(img)}">
<meta name="x-prerender" content="edge-bot">
${ldBlocks}
</head>
<body>
<header><a href="${ORIGIN}/">${SITE_NAME}</a></header>
<main>
<h1>${esc(seo.h1)}</h1>
${seo.bodyHtml}
</main>
<footer>
<nav aria-label="Rodapé">
<a href="${ORIGIN}/produtos">Produtos</a> ·
<a href="${ORIGIN}/sobre">Sobre</a> ·
<a href="${ORIGIN}/contato">Contato</a> ·
<a href="${ORIGIN}/blog">Blog</a>
</nav>
</footer>
</body>
</html>`;
}

const orgLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": `${ORIGIN}/#organization`,
  name: SITE_NAME,
  url: ORIGIN,
  logo: `${ORIGIN}/logo.png`,
  sameAs: ["https://instagram.com/emporiolelecute", "https://facebook.com/emporiolelecute"],
};

const breadcrumbLd = (items: { name: string; url: string }[]) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: items.map((it, i) => ({
    "@type": "ListItem",
    position: i + 1,
    name: it.name,
    item: it.url,
  })),
});

// --- route handlers --------------------------------------------------------

async function renderHome(): Promise<SeoPayload> {
  const { data: products } = await supabase
    .from("products")
    .select("name, slug, description, price, images")
    .eq("is_active", true)
    .limit(12);

  const items = (products || [])
    .map(
      (p) =>
        `<li><a href="${ORIGIN}/produto/${esc(p.slug)}">${esc(p.name)}</a> — R$ ${p.price}</li>`,
    )
    .join("");

  return {
    title: `${SITE_NAME} — Lembrancinhas Personalizadas`,
    description: DEFAULT_DESC,
    h1: `${SITE_NAME} — Lembrancinhas artesanais personalizadas`,
    bodyHtml: `<p>${esc(DEFAULT_DESC)}</p><h2>Produtos em destaque</h2><ul>${items}</ul>`,
    jsonLd: [
      orgLd,
      {
        "@context": "https://schema.org",
        "@type": "WebSite",
        "@id": `${ORIGIN}/#website`,
        url: ORIGIN,
        name: SITE_NAME,
        publisher: { "@id": `${ORIGIN}/#organization` },
        potentialAction: {
          "@type": "SearchAction",
          target: `${ORIGIN}/produtos?search={q}`,
          "query-input": "required name=q",
        },
      },
    ],
  };
}

async function renderProduct(slug: string): Promise<SeoPayload | null> {
  const { data: p } = await supabase
    .from("products")
    .select("name, slug, description, long_description, price, original_price, images, seo_noindex, category_id, rating")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();
  if (!p) return null;

  const img = p.images?.[0] ? `${p.images[0]}` : DEFAULT_IMAGE;
  const desc = (p.description || p.long_description || DEFAULT_DESC).slice(0, 300);

  return {
    title: `${p.name} | ${SITE_NAME}`,
    description: desc,
    image: img,
    type: "product",
    noindex: p.seo_noindex,
    h1: p.name,
    bodyHtml: `
<p>${esc(desc)}</p>
${img ? `<img src="${esc(img)}" alt="${esc(p.name)}" loading="eager">` : ""}
<p><strong>Preço:</strong> R$ ${p.price}</p>
<p><a href="${ORIGIN}/produto/${esc(p.slug)}">Ver detalhes e personalizar</a></p>`,
    jsonLd: [
      orgLd,
      {
        "@context": "https://schema.org",
        "@type": "Product",
        name: p.name,
        description: desc,
        image: p.images || [DEFAULT_IMAGE],
        sku: p.slug,
        brand: { "@type": "Brand", name: SITE_NAME },
        offers: {
          "@type": "Offer",
          url: canonical(productPath(p.slug)),
          priceCurrency: "BRL",
          price: Number(p.price),
          availability: "https://schema.org/InStock",
        },
        ...(p.rating
          ? { aggregateRating: { "@type": "AggregateRating", ratingValue: p.rating, reviewCount: 1 } }
          : {}),
      },
      breadcrumbLd([
        { name: "Início", url: ORIGIN },
        { name: "Produtos", url: `${ORIGIN}/produtos` },
        { name: p.name, url: canonical(productPath(p.slug)) },
      ]),
    ],
  };
}

async function renderTaxonomy(
  kind: "categoria" | "ocasiao" | "tag",
  slug: string,
): Promise<SeoPayload | null> {
  const table = kind === "categoria" ? "categories" : kind === "ocasiao" ? "occasions" : "tags";
  const { data: t } = await supabase
    .from(table)
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (!t) return null;

  // Fetch related products
  let products: { name: string; slug: string; price: number }[] = [];
  if (kind === "categoria") {
    const { data } = await supabase
      .from("products")
      .select("name, slug, price")
      .eq("category_id", t.id)
      .eq("is_active", true)
      .limit(24);
    products = data || [];
  } else {
    const join = kind === "ocasiao" ? "product_occasions" : "product_tags";
    const col = kind === "ocasiao" ? "occasion_id" : "tag_id";
    const { data: links } = await supabase.from(join).select("product_id").eq(col, t.id);
    const ids = (links || []).map((l: any) => l.product_id);
    if (ids.length) {
      const { data } = await supabase
        .from("products")
        .select("name, slug, price")
        .in("id", ids)
        .eq("is_active", true)
        .limit(24);
      products = data || [];
    }
  }

  const title = t.meta_title || `${t.name} | ${SITE_NAME}`;
  const desc = t.meta_description || t.description_seo || t.description || DEFAULT_DESC;
  const h1 = t.h1_override || t.name;
  const items = products
    .map(
      (p) =>
        `<li><a href="${ORIGIN}/produto/${esc(p.slug)}">${esc(p.name)}</a> — R$ ${p.price}</li>`,
    )
    .join("");

  return {
    title,
    description: desc,
    image: t.image_url || DEFAULT_IMAGE,
    noindex: t.is_indexed === false,
    h1,
    bodyHtml: `<p>${esc(desc)}</p><h2>Produtos</h2><ul>${items || "<li>Em breve</li>"}</ul>`,
    jsonLd: [
      orgLd,
      {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: title,
        description: desc,
        url: canonical(`/${kind}/${slug}`),
      },
      {
        "@context": "https://schema.org",
        "@type": "ItemList",
        itemListElement: products.map((p, i) => ({
          "@type": "ListItem",
          position: i + 1,
          url: canonical(productPath(p.slug)),
          name: p.name,
        })),
      },
      breadcrumbLd([
        { name: "Início", url: ORIGIN },
        { name: t.name, url: canonical(`/${kind}/${slug}`) },
      ]),
    ],
  };
}

async function renderProductList(): Promise<SeoPayload> {
  const { data: products } = await supabase
    .from("products")
    .select("name, slug, price")
    .eq("is_active", true)
    .limit(48);
  const items = (products || [])
    .map(
      (p) =>
        `<li><a href="${ORIGIN}/produto/${esc(p.slug)}">${esc(p.name)}</a> — R$ ${p.price}</li>`,
    )
    .join("");
  return {
    title: `Produtos | ${SITE_NAME}`,
    description: `Catálogo de lembrancinhas personalizadas — ${SITE_NAME}`,
    h1: "Todos os Produtos",
    bodyHtml: `<ul>${items}</ul>`,
    jsonLd: [
      orgLd,
      {
        "@context": "https://schema.org",
        "@type": "ItemList",
        itemListElement: (products || []).map((p, i) => ({
          "@type": "ListItem",
          position: i + 1,
          url: canonical(productPath(p.slug)),
          name: p.name,
        })),
      },
    ],
  };
}

async function renderStaticPage(slug: string): Promise<SeoPayload | null> {
  const { data: page } = await supabase
    .from("pages")
    .select("title, content, seo_title, seo_description, seo_canonical, slug")
    .eq("slug", slug)
    .maybeSingle();
  if (!page) return null;
  // Strip tags from content for description if needed
  const desc = page.seo_description || String(page.content || "").replace(/<[^>]+>/g, "").slice(0, 200);
  return {
    title: page.seo_title || `${page.title} | ${SITE_NAME}`,
    description: desc,
    h1: page.title,
    bodyHtml: String(page.content || ""),
    jsonLd: [orgLd, breadcrumbLd([
      { name: "Início", url: ORIGIN },
      { name: page.title, url: canonical(`/${page.slug}`) },
    ])],
  };
}

function renderNotFound(): SeoPayload {
  return {
    title: `Página não encontrada | ${SITE_NAME}`,
    description: "A página que você procura não existe.",
    h1: "Página não encontrada",
    bodyHtml: `<p>A página solicitada não existe. <a href="${ORIGIN}/">Voltar ao início</a>.</p>`,
    noindex: true,
  };
}

// --- router ---------------------------------------------------------------

async function resolve(path: string): Promise<SeoPayload> {
  const p = path.split("?")[0].replace(/\/+$/, "") || "/";

  if (p === "/" || p === "") return renderHome();
  if (p === "/produtos") return renderProductList();

  const m = p.match(/^\/(produto|categoria|ocasiao|tag)\/([^/]+)$/);
  if (m) {
    const [, kind, slug] = m;
    if (kind === "produto") return (await renderProduct(slug)) || renderNotFound();
    return (await renderTaxonomy(kind as any, slug)) || renderNotFound();
  }

  // Static institutional pages from `pages` table
  const sm = p.match(/^\/([a-z0-9-]+)$/);
  if (sm) {
    const page = await renderStaticPage(sm[1]);
    if (page) return page;
  }

  return renderNotFound();
}

// --- server ---------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const url = new URL(req.url);
    const path = url.searchParams.get("path") || "/";
    const seo = await resolve(path);
    const html = renderHtml(path, seo);
    return new Response(html, {
      status: 200,
      headers: {
        ...cors,
        "content-type": "text/html; charset=utf-8",
        "cache-control": "public, s-maxage=600, stale-while-revalidate=86400",
        "x-prerender-path": path,
        "x-prerender-noindex": seo.noindex ? "1" : "0",
      },
    });
  } catch (e) {
    console.error("prerender error", e);
    const html = renderHtml("/", renderNotFound());
    return new Response(html, {
      status: 200,
      headers: { ...cors, "content-type": "text/html; charset=utf-8", "x-prerender-error": "1" },
    });
  }
});
