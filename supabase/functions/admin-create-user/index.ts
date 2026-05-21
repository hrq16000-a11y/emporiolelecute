// Edge function: criação de usuário gerenciada por admin
// - Verifica JWT do chamador
// - Confirma que ele é admin via has_role
// - Cria usuário no auth com email_confirm=true (ou envia magic link)
// - Insere papéis (admin/editor) em user_roles
// - Atualiza profile com full_name e whatsapp (em notes/meta)
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return json({ error: "unauthorized" }, 401);
    }
    const token = authHeader.replace("Bearer ", "");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    // 1) Identifica chamador
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claims, error: cErr } = await userClient.auth.getClaims(token);
    if (cErr || !claims?.claims?.sub) return json({ error: "unauthorized" }, 401);
    const callerId = claims.claims.sub as string;

    // 2) Service client p/ verificar papel e mutar
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: isAdmin } = await admin.rpc("has_role", {
      _user_id: callerId,
      _role: "admin",
    });
    if (!isAdmin) return json({ error: "forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const email = String(body?.email || "").trim().toLowerCase();
    const fullName = String(body?.full_name || "").trim();
    const whatsapp = String(body?.whatsapp || "").trim();
    const password = String(body?.password || "");
    const roles: string[] = Array.isArray(body?.roles) ? body.roles : [];
    const sendInvite = !!body?.send_invite;

    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return json({ error: "email inválido" }, 400);
    }
    if (!sendInvite && password.length < 8) {
      return json({ error: "senha precisa ter 8+ caracteres ou marque enviar convite" }, 400);
    }

    // 3) cria ou convida
    let userId: string | null = null;
    if (sendInvite) {
      const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
        data: { full_name: fullName, whatsapp },
      });
      if (error) return json({ error: error.message }, 400);
      userId = data?.user?.id ?? null;
    } else {
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName, whatsapp },
      });
      if (error) return json({ error: error.message }, 400);
      userId = data?.user?.id ?? null;
    }
    if (!userId) return json({ error: "falha ao criar usuário" }, 500);

    // 4) profile (trigger handle_new_user já cria; só garantir full_name)
    if (fullName) {
      await admin.from("profiles").update({ full_name: fullName }).eq("id", userId);
    }

    // 5) papéis
    for (const r of roles) {
      if (!["admin", "editor", "customer"].includes(r)) continue;
      await admin.from("user_roles").upsert({ user_id: userId, role: r }, { onConflict: "user_id,role" });
    }

    return json({ success: true, user_id: userId, invited: sendInvite });
  } catch (e) {
    console.error("admin-create-user error", e);
    return json({ error: (e as Error).message || "internal" }, 500);
  }

  function json(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
