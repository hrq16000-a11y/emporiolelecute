import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

type Row = Record<string, unknown>;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: corsHeaders });

  const report = {
    created: { categories: 0, occasions: 0, tags: 0, products: 0, kits: 0 },
    updated: { categories: 0, occasions: 0, tags: 0, products: 0, kits: 0 },
    junctions: { kit_products: 0, product_tags: 0, product_occasions: 0, product_segments: 0 },
    errors: [] as string[],
  };

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

    const body = await req.json();
    const mode = body.mode === "replace" ? "replace" : "merge";
    const manifest = body.manifest as {
      catalog?: {
        products?: Row[]; categories?: Row[]; occasions?: Row[]; tags?: Row[]; kits?: Row[];
        kit_products?: Row[]; product_tags?: Row[]; product_occasions?: Row[]; product_segments?: Row[];
      };
      images?: Record<string, string[]>; // external_ref -> [public urls] (uploaded by client beforehand)
      orders?: { orders?: Row[]; order_items?: Row[] };
    };

    if (!manifest?.catalog) {
      return new Response(JSON.stringify({ error: "Missing manifest.catalog" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (mode === "replace") {
      // Cuidado: apaga todo o catálogo. Junctions caem por CASCADE.
      await admin.from("kit_products").delete().gte("created_at", "1900-01-01");
      await admin.from("product_tags").delete().gte("created_at", "1900-01-01").catch(() => {});
      await admin.from("product_occasions").delete().gte("created_at", "1900-01-01").catch(() => {});
      await admin.from("product_segments").delete().gte("created_at", "1900-01-01").catch(() => {});
      await admin.from("kits").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await admin.from("products").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await admin.from("tags").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await admin.from("occasions").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await admin.from("categories").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    }

    // Helper: upsert taxonomy by external_ref
    const upsertTaxonomy = async (
      table: "categories" | "occasions" | "tags" | "kits",
      rows: Row[],
    ): Promise<Map<string, string>> => {
      const refToId = new Map<string, string>();
      if (!rows.length) return refToId;
      const existing = await admin.from(table).select("id, external_ref");
      const exMap = new Map((existing.data ?? []).map((r) => [r.external_ref as string, r.id as string]));
      for (const r of rows) {
        const ref = r.external_ref as string;
        if (!ref) continue;
        const { id: _id, created_at: _ca, updated_at: _ua, ...rest } = r as Row & { id?: string; created_at?: string; updated_at?: string };
        const localId = exMap.get(ref);
        if (localId) {
          const { error } = await admin.from(table).update(rest).eq("external_ref", ref);
          if (error) report.errors.push(`${table} update ${ref}: ${error.message}`);
          else { refToId.set(ref, localId); report.updated[table]++; }
        } else {
          const { data, error } = await admin.from(table).insert(rest).select("id").maybeSingle();
          if (error) report.errors.push(`${table} insert ${ref}: ${error.message}`);
          else if (data) { refToId.set(ref, data.id as string); report.created[table]++; }
        }
      }
      return refToId;
    };

    const c = manifest.catalog;
    const catRefMap = await upsertTaxonomy("categories", c.categories ?? []);
    const occRefMap = await upsertTaxonomy("occasions", c.occasions ?? []);
    const tagRefMap = await upsertTaxonomy("tags", c.tags ?? []);

    // Products: resolve category_id from category_ref, apply imported image URLs if provided
    const prodRefMap = new Map<string, string>();
    {
      const existing = await admin.from("products").select("id, external_ref");
      const exMap = new Map((existing.data ?? []).map((r) => [r.external_ref as string, r.id as string]));
      for (const p of (c.products ?? [])) {
        const ref = p.external_ref as string;
        if (!ref) continue;
        const { id: _id, created_at: _ca, updated_at: _ua, category_ref, search_text: _st, ...rest } = p as Row & { id?: string; created_at?: string; updated_at?: string; category_ref?: string; search_text?: string };
        if (category_ref) {
          const catId = catRefMap.get(category_ref) ?? (await admin.from("categories").select("id").eq("external_ref", category_ref).maybeSingle()).data?.id;
          if (catId) rest.category_id = catId;
        }
        if (!rest.category_id) {
          report.errors.push(`product ${ref}: sem category_id resolvível (category_ref=${category_ref ?? "null"})`);
          continue;
        }
        // Override images com URLs carregadas pelo client (se houver)
        const imgOverride = manifest.images?.[ref];
        if (imgOverride && imgOverride.length > 0) rest.images = imgOverride;

        const localId = exMap.get(ref);
        if (localId) {
          const { error } = await admin.from("products").update(rest).eq("external_ref", ref);
          if (error) report.errors.push(`products update ${ref}: ${error.message}`);
          else { prodRefMap.set(ref, localId); report.updated.products++; }
        } else {
          const { data, error } = await admin.from("products").insert(rest).select("id").maybeSingle();
          if (error) report.errors.push(`products insert ${ref}: ${error.message}`);
          else if (data) { prodRefMap.set(ref, data.id as string); report.created.products++; }
        }
      }
    }

    const kitRefMap = await upsertTaxonomy("kits", c.kits ?? []);

    // Junctions
    const insertJunction = async (
      table: "kit_products" | "product_tags" | "product_occasions" | "product_segments",
      rows: Row[],
      aKey: string, aMap: Map<string, string>,
      bKey: string, bMap: Map<string, string>,
    ) => {
      if (!rows.length) return;
      const payload = rows.map((r) => {
        const aRef = r[`${aKey}_ref`] as string | undefined;
        const bRef = r[`${bKey}_ref`] as string | undefined;
        if (!aRef || !bRef) return null;
        const a = aMap.get(aRef);
        const b = bMap.get(bRef);
        if (!a || !b) return null;
        const { [`${aKey}_ref`]: _ar, [`${bKey}_ref`]: _br, id: _id, ...extra } = r as Row;
        return { [aKey]: a, [bKey]: b, ...extra };
      }).filter(Boolean) as Row[];
      if (!payload.length) return;
      const { error } = await admin.from(table).upsert(payload, { onConflict: `${aKey},${bKey}`, ignoreDuplicates: true });
      if (error) report.errors.push(`${table}: ${error.message}`);
      else report.junctions[table] += payload.length;
    };

    await insertJunction("kit_products",     c.kit_products     ?? [], "kit_id",     kitRefMap, "product_id", prodRefMap);
    await insertJunction("product_tags",     c.product_tags     ?? [], "product_id", prodRefMap, "tag_id",     tagRefMap);
    await insertJunction("product_occasions",c.product_occasions?? [], "product_id", prodRefMap, "occasion_id",occRefMap);
    // product_segments: segment refs não migrados — skip silenciosamente se não houver mapa
    // (mantido fora; pode ser implementado quando segments tiver tabela própria)

    return new Response(JSON.stringify({ ok: true, mode, report }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("admin-backup-import error", e);
    report.errors.push(String((e as Error)?.message ?? e));
    return new Response(JSON.stringify({ ok: false, report }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
