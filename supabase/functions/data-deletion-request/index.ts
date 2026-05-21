// Recebe solicitações públicas de exclusão de dados (LGPD).
// Insere na tabela data_deletion_requests usando service-role.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase().slice(0, 320) : null;
    const whatsapp = typeof body.whatsapp === "string" ? body.whatsapp.trim().slice(0, 40) : null;
    const visitor_id = typeof body.visitor_id === "string" ? body.visitor_id.slice(0, 80) : null;
    const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 2000) : null;

    if (!email && !whatsapp && !visitor_id) {
      return new Response(
        JSON.stringify({ error: "Informe ao menos e-mail, WhatsApp ou ID de visitante." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (email && !/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(email)) {
      return new Response(JSON.stringify({ error: "E-mail inválido." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ip =
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      null;
    const user_agent = req.headers.get("user-agent")?.slice(0, 500) ?? null;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { error } = await supabase.from("data_deletion_requests").insert({
      email,
      whatsapp,
      visitor_id,
      reason,
      ip,
      user_agent,
    });
    if (error) throw error;

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("data-deletion-request error", err);
    return new Response(JSON.stringify({ error: "Falha ao registrar solicitação." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
