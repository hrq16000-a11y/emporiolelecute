// Rotina de teste de notificação (Web Push + fallback de e-mail).
// Uso restrito a administradores autenticados.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { sendWebPush } from "../_shared/webpush.ts";

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

interface Step {
  step: string;
  status: "success" | "error" | "skipped";
  detail: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // --- Auth: precisa ser admin ---
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

  let body: { email?: string; order_code?: string; send_email_fallback?: boolean } = {};
  try { body = await req.json(); } catch { /* ignore */ }

  const email = String(body.email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: "E-mail inválido" }, 400);
  }
  const orderCode = String(body.order_code || "TESTE01").trim().toUpperCase().slice(0, 20);
  const allowEmailFallback = body.send_email_fallback !== false;

  const steps: Step[] = [];

  // --- 1. Configuração VAPID ---
  const vapidPublic = Deno.env.get("VAPID_PUBLIC_KEY") || "";
  const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY") || "";
  const vapidSubject = Deno.env.get("VAPID_SUBJECT") || "mailto:emporiolelecute@gmail.com";
  const vapidReady = Boolean(vapidPublic && vapidPrivate);
  steps.push({
    step: "Chaves VAPID",
    status: vapidReady ? "success" : "error",
    detail: vapidReady ? "Chaves configuradas no servidor." : "VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY ausentes.",
  });

  // --- 2. Preferências ---
  const { data: prefs } = await admin
    .from("notification_preferences")
    .select("email_enabled, push_enabled, updated_at")
    .eq("email", email)
    .maybeSingle();

  steps.push({
    step: "Preferências do cliente",
    status: prefs ? "success" : "skipped",
    detail: prefs
      ? `Push ${prefs.push_enabled ? "ligado" : "desligado"} · E-mail ${prefs.email_enabled === false ? "desligado" : "ligado"}`
      : "Nenhuma preferência salva — padrão é e-mail ligado e push desligado.",
  });

  // --- 3. Dispositivos inscritos ---
  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("email", email);

  const deviceCount = subs?.length || 0;
  steps.push({
    step: "Dispositivos inscritos",
    status: deviceCount > 0 ? "success" : "skipped",
    detail: deviceCount > 0 ? `${deviceCount} dispositivo(s) com Web Push ativo.` : "Nenhum dispositivo inscrito para push.",
  });

  // --- 4. Envio do push de teste ---
  let pushDelivered = false;
  const pushErrors: string[] = [];

  if (vapidReady && deviceCount > 0) {
    const payload = JSON.stringify({
      title: `Teste · Pedido ${orderCode}`,
      body: "Se você recebeu esta notificação, o Web Push está funcionando.",
      url: `/rastrear?code=${encodeURIComponent(orderCode)}`,
      tag: `test-${orderCode}`,
    });

    for (const sub of subs || []) {
      const result = await sendWebPush(sub, payload, {
        publicKey: vapidPublic,
        privateKey: vapidPrivate,
        subject: vapidSubject,
      });
      if (result.ok) {
        pushDelivered = true;
        await admin
          .from("push_subscriptions")
          .update({ last_success_at: new Date().toISOString(), failure_count: 0 })
          .eq("id", sub.id);
      } else if (result.expired) {
        await admin.from("push_subscriptions").delete().eq("id", sub.id);
        pushErrors.push("inscrição expirada (removida)");
      } else {
        pushErrors.push(`HTTP ${result.status ?? "?"}: ${result.error ?? "falha"}`);
      }
    }

    steps.push({
      step: "Envio Web Push",
      status: pushDelivered ? "success" : "error",
      detail: pushDelivered
        ? "Notificação entregue ao serviço de push do navegador."
        : `Nenhum envio confirmado. ${pushErrors.join(" | ")}`,
    });
  } else {
    steps.push({
      step: "Envio Web Push",
      status: "skipped",
      detail: !vapidReady ? "Sem chaves VAPID." : "Sem dispositivos para receber.",
    });
  }

  // --- 5. Fallback por e-mail ---
  let emailSent = false;
  if (!pushDelivered && allowEmailFallback) {
    try {
      const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
      const { error } = await resend.emails.send({
        from: "Empório LeleCute <onboarding@resend.dev>",
        to: [email],
        subject: `Teste de notificação · Pedido ${orderCode}`,
        html: `
          <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#3f3a38">
            <h1 style="font-size:20px;color:#e08a7b">Empório LeleCute</h1>
            <p>Este é um <strong>teste</strong> do aviso de mudança de status de pedido.</p>
            <p style="background:#faf6f4;padding:16px;border-radius:12px">
              <strong>Pedido:</strong> ${orderCode}<br/>
              <strong>Status simulado:</strong> Em produção
            </p>
            <p style="font-size:12px;color:#8c8481">Enviado pela rotina de teste do painel administrativo.</p>
          </div>`,
      });
      if (error) throw new Error(typeof error === "string" ? error : JSON.stringify(error));
      emailSent = true;
      steps.push({ step: "Fallback por e-mail", status: "success", detail: `E-mail de teste enviado para ${email}.` });
    } catch (e) {
      steps.push({
        step: "Fallback por e-mail",
        status: "error",
        detail: e instanceof Error ? e.message : "Falha ao enviar e-mail.",
      });
    }
  } else {
    steps.push({
      step: "Fallback por e-mail",
      status: "skipped",
      detail: pushDelivered ? "Não necessário — push entregue." : "Fallback desativado nesta execução.",
    });
  }

  const channel = pushDelivered ? "push" : emailSent ? "email" : "none";

  return json({
    ok: pushDelivered || emailSent,
    channel,
    email,
    order_code: orderCode,
    devices: deviceCount,
    steps,
    tested_at: new Date().toISOString(),
  });
});
