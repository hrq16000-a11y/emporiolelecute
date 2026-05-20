import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function sqlVal(v: unknown): string {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "NULL";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (Array.isArray(v)) {
    if (v.length === 0) return "'{}'";
    const items = v.map((x) => String(x).replace(/\\/g, "\\\\").replace(/"/g, '\\"')).map((x) => `"${x}"`).join(",");
    return `'{${items.replace(/'/g, "''")}}'`;
  }
  if (typeof v === "object") return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
  return `'${String(v).replace(/'/g, "''")}'`;
}

function makeInserts(table: string, rows: Record<string, unknown>[], dropColumns: string[] = []): string {
  if (!rows.length) return `-- (no rows for ${table})\n`;
  const cols = Object.keys(rows[0]).filter((c) => !dropColumns.includes(c));
  const colList = cols.map((c) => `"${c}"`).join(", ");
  const values = rows.map((r) => `(${cols.map((c) => sqlVal(r[c])).join(", ")})`).join(",\n  ");
  return `-- ${table} (${rows.length})\nINSERT INTO public.${table} (${colList}) VALUES\n  ${values}\nON CONFLICT DO NOTHING;\n\n`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId = claims.claims.sub as string;

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: isAdminRow } = await admin.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdminRow) {
      return new Response(JSON.stringify({ error: "Forbidden — admin only" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json().catch(() => ({}));
    const scope = body.scope ?? { catalog: true, images: true, orders: false, sql: true };
    const productRefs: string[] | null = Array.isArray(body.productRefs) && body.productRefs.length > 0
      ? body.productRefs.filter((x: unknown) => typeof x === "string")
      : null;
    const SENTINEL = ["00000000-0000-0000-0000-000000000000"];

    const result: Record<string, unknown> = {
      version: 1,
      exported_at: new Date().toISOString(),
      project_ref: SUPABASE_URL,
      scope,
      productRefs,
    };

    if (scope.catalog) {
      const products = productRefs
        ? await admin.from("products").select("*").in("external_ref", productRefs).order("created_at")
        : await admin.from("products").select("*").order("created_at");

      const productIds = (products.data ?? []).map((p) => p.id);
      const categoryIds = Array.from(new Set((products.data ?? []).map((p) => p.category_id).filter(Boolean)));
      const pidFilter = productIds.length ? productIds : SENTINEL;
      const cidFilter = categoryIds.length ? categoryIds : SENTINEL;

      const [categories, occasions, tags, kits, kitProducts, productTags, productOccasions, productSegments] = await Promise.all([
        productRefs
          ? admin.from("categories").select("*").in("id", cidFilter).order("position")
          : admin.from("categories").select("*").order("position"),
        admin.from("occasions").select("*").order("position"),
        admin.from("tags").select("*").order("name"),
        productRefs
          ? admin.from("kits").select("*, kit_products!inner(product_id)").in("kit_products.product_id", pidFilter).order("position")
          : admin.from("kits").select("*").order("position"),
        productRefs ? admin.from("kit_products").select("*").in("product_id", pidFilter) : admin.from("kit_products").select("*"),
        productRefs ? admin.from("product_tags").select("*").in("product_id", pidFilter) : admin.from("product_tags").select("*"),
        productRefs ? admin.from("product_occasions").select("*").in("product_id", pidFilter) : admin.from("product_occasions").select("*"),
        productRefs ? admin.from("product_segments").select("*").in("product_id", pidFilter) : admin.from("product_segments").select("*"),
      ]);

      const refOf = new Map<string, string>();
      for (const t of [products, categories, occasions, tags, kits]) {
        for (const r of (t.data ?? [])) refOf.set(r.id, r.external_ref);
      }

      const resolveJunction = (rows: Record<string, unknown>[] = [], aKey: string, bKey: string) =>
        rows.map((r) => ({
          [aKey + "_ref"]: refOf.get(r[aKey] as string) ?? null,
          [bKey + "_ref"]: refOf.get(r[bKey] as string) ?? null,
          ...Object.fromEntries(Object.entries(r).filter(([k]) => !["id", aKey, bKey].includes(k))),
        })).filter((r) => r[aKey + "_ref"] && r[bKey + "_ref"]);

      const productsOut = (products.data ?? []).map((p) => ({
        ...p,
        category_ref: p.category_id ? refOf.get(p.category_id) ?? null : null,
      }));

      const kitsClean = (kits.data ?? []).map(({ kit_products: _kp, ...rest }: Record<string, unknown>) => rest);

      result.catalog = {
        products: productsOut,
        categories: categories.data ?? [],
        occasions: occasions.data ?? [],
        tags: tags.data ?? [],
        kits: kitsClean,
        kit_products: resolveJunction(kitProducts.data ?? [], "kit_id", "product_id"),
        product_tags: resolveJunction(productTags.data ?? [], "product_id", "tag_id"),
        product_occasions: resolveJunction(productOccasions.data ?? [], "product_id", "occasion_id"),
        product_segments: resolveJunction(productSegments.data ?? [], "product_id", "segment_id"),
      };

      if (scope.sql) {
        let sql = `-- Backup gerado em ${new Date().toISOString()}\n-- Use external_ref como chave global ao reimportar\n`;
        if (productRefs) sql += `-- Escopo: ${productRefs.length} produto(s) selecionado(s)\n`;
        sql += `\n`;
        sql += makeInserts("categories", categories.data ?? [], ["id"]);
        sql += makeInserts("occasions", occasions.data ?? [], ["id"]);
        sql += makeInserts("tags", tags.data ?? [], ["id"]);
        sql += makeInserts("products", productsOut.map(({ category_id: _ci, ...rest }) => rest), ["id"]);
        sql += makeInserts("kits", kitsClean, ["id"]);
        result.sqlDump = sql;
      }
    }

    if (scope.images) {
      const imgs: { external_ref: string; idx: number; filename: string; signed_url: string; source_url: string }[] = [];
      const products = (result.catalog as { products?: { external_ref: string; images?: string[] }[] } | undefined)?.products
        ?? (productRefs
              ? (await admin.from("products").select("external_ref, images").in("external_ref", productRefs)).data
              : (await admin.from("products").select("external_ref, images")).data)
        ?? [];

      for (const p of products) {
        const list = (p.images ?? []) as string[];
        for (let i = 0; i < list.length; i++) {
          const url = list[i];
          if (!url) continue;
          // Extract bucket path from Supabase public URL
          const m = url.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/);
          if (!m) {
            imgs.push({ external_ref: p.external_ref, idx: i, filename: `${p.external_ref}__${String(i + 1).padStart(2, "0")}.bin`, signed_url: url, source_url: url });
            continue;
          }
          const [, bucket, path] = m;
          const ext = (path.match(/\.([a-zA-Z0-9]+)(?:\?|$)/)?.[1] ?? "jpg").toLowerCase();
          const { data: signed } = await admin.storage.from(bucket).createSignedUrl(path, 3600);
          imgs.push({
            external_ref: p.external_ref,
            idx: i,
            filename: `${p.external_ref}__${String(i + 1).padStart(2, "0")}.${ext}`,
            signed_url: signed?.signedUrl ?? url,
            source_url: url,
          });
        }
      }
      result.images = imgs;
    }

    if (scope.orders) {
      const [orders, items] = await Promise.all([
        admin.from("orders").select("*").order("created_at", { ascending: false }),
        admin.from("order_items").select("*"),
      ]);
      result.orders = { orders: orders.data ?? [], order_items: items.data ?? [] };
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("admin-backup-export error", e);
    return new Response(JSON.stringify({ error: String((e as Error)?.message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
