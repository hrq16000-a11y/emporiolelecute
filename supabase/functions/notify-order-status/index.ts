// Notificação por e-mail quando o status do pedido muda.
// Chamado exclusivamente pelo trigger do banco (pg_net) com header x-internal-key.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { sendWebPush } from "../_shared/webpush.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const STATUS_LABEL: Record<string, string> = {
  pending: "Aguardando confirmação",
  confirmed: "Pagamento confirmado",
  production: "Em produção",
  shipped: "Enviado",
  delivered: "Entregue",
  cancelled: "Cancelado",
};

const STATUS_MESSAGE: Record<string, string> = {
  pending: "Recebemos seu pedido e estamos aguardando a confirmação do pagamento.",
  confirmed: "Seu pagamento foi confirmado! Já iniciamos a produção do seu pedido.",
  production: "Seu pedido está sendo produzido com muito carinho no nosso ateliê.",
  shipped: "Boas notícias: seu pedido foi despachado e está a caminho!",
  delivered: "Seu pedido foi entregue. Esperamos que você ame o resultado!",
  cancelled: "Seu pedido foi cancelado. Se precisar de ajuda, fale com a gente.",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const provided = req.headers.get("x-internal-key") || "";
  const { data: secretRow } = await admin
    .from("internal_function_secrets")
    .select("value")
    .eq("name", "notify_order_status")
    .maybeSingle();

  const expected = secretRow?.value || "";
  if (!provided || !expected || provided !== expected) {
    return json({ error: "Forbidden" }, 403);
  }

  let body: { order_code?: string; status?: string; previous_status?: string } = {};
  try { body = await req.json(); } catch { /* ignore */ }

  const code = (body.order_code || "").trim().toUpperCase();
  if (!/^[A-Z0-9]{4,20}$/.test(code)) return json({ error: "Invalid order code" }, 400);

  const { data: order } = await admin
    .from("orders")
    .select("id, order_code, customer_name, customer_email, status, tracking_code, tracking_url")
    .eq("order_code", code)
    .maybeSingle();

  if (!order) return json({ error: "Order not found" }, 404);

  const status = order.status as string;
  const label = STATUS_LABEL[status] || status;
  const message = STATUS_MESSAGE[status] || "O status do seu pedido foi atualizado.";
  const trackUrl = `https://emporiolelecute.com.br/rastrear?code=${encodeURIComponent(order.order_code)}`;

  // Idempotência: não reenviar o mesmo status para o mesmo pedido.
  const { data: already } = await admin
    .from("order_status_notifications")
    .select("id")
    .eq("order_id", order.id)
    .eq("status", status)
    .eq("channel", "email")
    .eq("success", true)
    .maybeSingle();

  if (already) return json({ skipped: "already_notified" });

  // ---- Web Push primeiro; e-mail continua como fallback automático ----
  const customerEmail = String(order.customer_email || "").trim().toLowerCase();
  let pushDelivered = false;

  const vapidPublic = Deno.env.get("VAPID_PUBLIC_KEY") || "";
  const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY") || "";
  const vapidSubject = Deno.env.get("VAPID_SUBJECT") || "mailto:emporiolelecute@gmail.com";

  const { data: prefs } = customerEmail
    ? await admin
        .from("notification_preferences")
        .select("email_enabled, push_enabled")
        .eq("email", customerEmail)
        .maybeSingle()
    : { data: null };

  const wantsPush = prefs?.push_enabled === true;
  const wantsEmail = prefs?.email_enabled !== false; // padrão: e-mail ligado

  if (wantsPush && vapidPublic && vapidPrivate && customerEmail) {
    const { data: alreadyPush } = await admin
      .from("order_status_notifications")
      .select("id")
      .eq("order_id", order.id)
      .eq("status", status)
      .eq("channel", "push")
      .eq("success", true)
      .maybeSingle();

    if (alreadyPush) {
      pushDelivered = true;
    } else {
      const { data: subs } = await admin
        .from("push_subscriptions")
        .select("id, endpoint, p256dh, auth")
        .eq("email", customerEmail);

      const payload = JSON.stringify({
        title: `Pedido ${order.order_code}: ${label}`,
        body: message,
        url: `/rastrear?code=${encodeURIComponent(order.order_code)}`,
        tag: `order-${order.order_code}`,
      });

      for (const sub of subs || []) {
        const result = await sendWebPush(sub, payload, {
          publicKey: vapidPublic,
          privateKey: vapidPrivate,
          subject: vapidSubject,
        });
        if (result.ok) {
          pushDelivered = true;
          await admin.from("push_subscriptions").update({ last_success_at: new Date().toISOString(), failure_count: 0 }).eq("id", sub.id);
        } else if (result.expired) {
          await admin.from("push_subscriptions").delete().eq("id", sub.id);
        } else {
          console.error("[notify-order-status] push failed", result.status, result.error);
        }
      }

      await admin.from("order_status_notifications").insert({
        order_id: order.id,
        order_code: order.order_code,
        status,
        channel: "push",
        success: pushDelivered,
        error: pushDelivered ? null : "push_delivery_failed",
      });
    }
  }

  // Se o push chegou e o cliente desativou e-mail, não enviamos e-mail.
  if (pushDelivered && !wantsEmail) {
    return json({ sent: true, channel: "push" });
  }

  const emailOk = typeof order.customer_email === "string" &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(order.customer_email);

  if (!emailOk) {
    await admin.from("order_status_notifications").insert({
      order_id: order.id,
      order_code: order.order_code,
      status,
      channel: "email",
      success: false,
      error: "invalid_or_missing_email",
    });
    return json({ skipped: "no_email" });
  }

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#3f3a38">
      <h1 style="font-size:20px;color:#e08a7b">Empório LeleCute</h1>
      <p>Olá, ${String(order.customer_name || "").slice(0, 80)}!</p>
      <p>${message}</p>
      <p style="background:#faf6f4;padding:16px;border-radius:12px">
        <strong>Pedido:</strong> ${order.order_code}<br/>
        <strong>Status atual:</strong> ${label}
        ${order.tracking_code ? `<br/><strong>Rastreio:</strong> ${order.tracking_code}` : ""}
      </p>
      <p>
        <a href="${trackUrl}" style="display:inline-block;background:#e08a7b;color:#fff;padding:12px 22px;border-radius:999px;text-decoration:none">
          Acompanhar meu pedido
        </a>
      </p>
      ${order.tracking_url ? `<p><a href="${order.tracking_url}">Rastrear na transportadora</a></p>` : ""}
      <p style="font-size:12px;color:#8c8481">Você recebeu este e-mail porque fez um pedido no Empório LeleCute.</p>
    </div>
  `;

  try {
    const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
    const { error } = await resend.emails.send({
      from: "Empório LeleCute <onboarding@resend.dev>",
      to: [order.customer_email as string],
      subject: `Pedido ${order.order_code}: ${label}`,
      html,
    });
    if (error) throw new Error(typeof error === "string" ? error : JSON.stringify(error));

    await admin.from("order_status_notifications").insert({
      order_id: order.id,
      order_code: order.order_code,
      status,
      channel: "email",
      success: true,
    });
    return json({ sent: true, channel: pushDelivered ? "push+email" : "email" });
  } catch (e) {
    await admin.from("order_status_notifications").insert({
      order_id: order.id,
      order_code: order.order_code,
      status,
      channel: "email",
      success: false,
      error: String((e as Error).message || e).slice(0, 500),
    });
    return json({ error: "send_failed" }, 500);
  }
});
