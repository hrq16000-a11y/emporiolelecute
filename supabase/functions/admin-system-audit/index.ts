import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Tabelas administrativas / de configuração que devem ir no dump completo
const CONFIG_TABLES = [
  "site_settings", "menu_items", "footer_settings", "footer_links",
  "hero_slides", "testimonials", "faqs", "institutional_pages",
  "home_sections", "pdp_sections", "pdp_badges",
  "seo_settings", "seo_url_status", "redirects", "reserved_slugs",
  "contact_info", "payment_config", "shipping_config",
  "search_synonyms", "search_boosts", "search_query_log",
  "conversion_cta_settings", "coupons",
  "role_promotion_audit", "admin_access_requests", "admin_audit_timeline",
  "home_section_audit", "pdp_section_audit",
  "tracking_email_log", "pdp_funnel_events", "pdp_badge_events",
];

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
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden — admin only" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 1) Metadados do banco via função SECURITY DEFINER
    const { data: meta, error: metaErr } = await admin.rpc("audit_system_dump");
    if (metaErr) throw new Error("audit_system_dump: " + metaErr.message);

    // 2) Dump de tabelas de configuração
    const configs: Record<string, unknown[]> = {};
    for (const t of CONFIG_TABLES) {
      const { data, error } = await admin.from(t).select("*").limit(5000);
      if (error) {
        configs[t] = [{ __error: error.message }];
      } else {
        configs[t] = data ?? [];
      }
    }

    // 3) Contas de usuários do auth (paginado)
    const users: unknown[] = [];
    let page = 1;
    while (true) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
      if (error || !data?.users?.length) break;
      for (const u of data.users) {
        users.push({
          id: u.id,
          email: u.email,
          phone: u.phone,
          created_at: u.created_at,
          last_sign_in_at: u.last_sign_in_at,
          email_confirmed_at: u.email_confirmed_at,
          providers: u.app_metadata?.providers ?? [u.app_metadata?.provider],
          banned_until: (u as unknown as { banned_until?: string }).banned_until ?? null,
        });
      }
      if (data.users.length < 200) break;
      page++;
      if (page > 50) break; // safety cap
    }

    // 4) Inventário de segredos (apenas nomes)
    const allEnv = Object.keys(Deno.env.toObject()).sort();
    const systemPrefixes = ["SUPABASE_", "DENO_", "_", "HOME", "PATH", "PWD", "LANG", "TZ", "HOSTNAME"];
    const projectSecrets = allEnv.filter((k) => !systemPrefixes.some((p) => k.startsWith(p) || k === p));

    // 5) Inventário de edge functions
    const edgeFunctions = [
      "admin-backup-export", "admin-backup-import", "admin-system-audit",
      "send-tracking-email", "track-order", "merchant-feed", "sitemap-generate",
      "notify-role-change", "send-product-inquiry",
    ];

    // Relatório markdown
    const m = meta as Record<string, unknown>;
    const tablesCount = (m.tables as unknown[])?.length ?? 0;
    const policiesCount = (m.policies as unknown[])?.length ?? 0;
    const functionsCount = (m.functions as unknown[])?.length ?? 0;
    const triggersCount = (m.triggers as unknown[])?.length ?? 0;
    const indexesCount = (m.indexes as unknown[])?.length ?? 0;
    const bucketsCount = (m.storage_buckets as unknown[])?.length ?? 0;
    const cronCount = (m.cron_jobs as unknown[])?.length ?? 0;
    const rolesCount = (m.user_roles as unknown[])?.length ?? 0;
    const profilesCount = (m.profiles as unknown[])?.length ?? 0;
    const rlsDisabled = ((m.tables as { name: string; rls_enabled: boolean }[]) ?? []).filter((t) => !t.rls_enabled);

    const report = `# Auditoria do Sistema — Empório Lelé Cute

**Gerado em:** ${new Date().toISOString()}
**Solicitado por:** ${claims.claims.email ?? userId}

## Resumo

| Item | Quantidade |
| ---- | ---------- |
| Tabelas (public) | ${tablesCount} |
| Tabelas SEM RLS | ${rlsDisabled.length} ${rlsDisabled.length ? "⚠️" : "✅"} |
| Políticas RLS | ${policiesCount} |
| Funções SQL/plpgsql | ${functionsCount} |
| Triggers | ${triggersCount} |
| Índices | ${indexesCount} |
| Buckets de Storage | ${bucketsCount} |
| Tarefas agendadas (cron) | ${cronCount} |
| Papéis atribuídos | ${rolesCount} |
| Perfis cadastrados | ${profilesCount} |
| Contas de usuário | ${users.length} |
| Edge Functions ativas | ${edgeFunctions.length} |
| Segredos configurados (nomes) | ${projectSecrets.length} |

${rlsDisabled.length ? `\n## ⚠️ Tabelas sem RLS\n\n${rlsDisabled.map((t) => "- " + t.name).join("\n")}\n` : ""}

## Arquivos neste pacote

- \`schema/policies.json\` — todas as políticas RLS (USING / WITH CHECK)
- \`schema/tables.json\` — lista de tabelas com status de RLS
- \`schema/columns.json\` — todas as colunas, tipos e defaults
- \`schema/functions.json\` — funções SQL/plpgsql com assinaturas
- \`schema/triggers.json\` — todos os triggers
- \`schema/indexes.json\` — todos os índices
- \`schema/storage_buckets.json\` — buckets e suas permissões
- \`schema/cron_jobs.json\` — tarefas agendadas
- \`config/\` — dump JSON das ${CONFIG_TABLES.length} tabelas de configuração
- \`users/auth_users.json\` — contas de autenticação ⚠️ LGPD
- \`users/user_roles.json\` — atribuições de papel
- \`users/profiles.json\` — perfis públicos
- \`secrets_inventory.json\` — nomes de segredos (sem valores)
- \`edge_functions.json\` — inventário de funções de borda
- \`report.md\` — este relatório

## ⚠️ Atenção LGPD

Este pacote contém dados pessoais (emails, nomes, IDs).
Armazene em local seguro com acesso restrito e exclua quando não for mais necessário.
`;

    return new Response(JSON.stringify({
      generated_at: new Date().toISOString(),
      report,
      schema: meta,
      config: configs,
      users,
      secrets_inventory: projectSecrets,
      edge_functions: edgeFunctions,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("admin-system-audit", e);
    return new Response(JSON.stringify({ error: String((e as Error)?.message ?? e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
