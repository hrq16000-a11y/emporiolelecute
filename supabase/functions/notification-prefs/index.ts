// Preferências de notificação do cliente (e-mail / Web Push).
// Acesso público, mas toda leitura/escrita exige e-mail + código de pedido válidos.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_RE = /^[A-Z0-9]{4,20}$/;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const action = String(body.action || "");

  if (action === "config") {
    return json({ vapid_public_key: Deno.env.get("VAPID_PUBLIC_KEY") || null });
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const email = String(body.email || "").trim().toLowerCase();
  const orderCode = String(body.order_code || "").trim().toUpperCase();

  if (!EMAIL_RE.test(email) || email.length > 160) return json({ error: "invalid_email" }, 400);
  if (!CODE_RE.test(orderCode)) return json({ error: "invalid_order_code" }, 400);

  // Verificação de posse: o e-mail precisa bater com um pedido real.
  const { data: order } = await admin
    .from("orders")
    .select("id, order_code, customer_email")
    .eq("order_code", orderCode)
    .maybeSingle();

  if (!order || String(order.customer_email || "").trim().toLowerCase() !== email) {
    return json({ error: "order_not_found" }, 404);
  }

  const loadState = async () => {
    const { data: prefs } = await admin
      .from("notification_preferences")
      .select("email_enabled, push_enabled, updated_at")
      .eq("email", email)
      .maybeSingle();
    const { count } = await admin
      .from("push_subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("email", email);
    return {
      email_enabled: prefs?.email_enabled ?? true,
      push_enabled: prefs?.push_enabled ?? false,
      devices: count ?? 0,
      updated_at: prefs?.updated_at ?? null,
    };
  };

  try {
    if (action === "get") return json(await loadState());

    if (action === "save") {
      const emailEnabled = body.email_enabled !== false;
      const pushEnabled = body.push_enabled === true;
      const { error } = await admin
        .from("notification_preferences")
        .upsert({ email: email, email_enabled: emailEnabled, push_enabled: pushEnabled }, { onConflict: "email" });
      if (error) throw error;
      if (!pushEnabled) {
        await admin.from("push_subscriptions").delete().eq("email", email);
      }
      return json(await loadState());
    }

    if (action === "subscribe") {
      const sub = body.subscription as
        | { endpoint?: string; keys?: { p256dh?: string; auth?: string } }
        | undefined;
      const endpoint = String(sub?.endpoint || "");
      const p256dh = String(sub?.keys?.p256dh || "");
      const auth = String(sub?.keys?.auth || "");
      if (!/^https:\/\//.test(endpoint) || endpoint.length > 800 || !p256dh || !auth) {
        return json({ error: "invalid_subscription" }, 400);
      }
      const { error } = await admin.from("push_subscriptions").upsert(
        {
          email,
          endpoint,
          p256dh,
          auth,
          user_agent: (req.headers.get("user-agent") || "").slice(0, 300),
        },
        { onConflict: "endpoint" },
      );
      if (error) throw error;
      await admin
        .from("notification_preferences")
        .upsert({ email, push_enabled: true }, { onConflict: "email" });
      return json(await loadState());
    }

    if (action === "unsubscribe") {
      const endpoint = String(body.endpoint || "");
      if (endpoint) {
        await admin.from("push_subscriptions").delete().eq("endpoint", endpoint).eq("email", email);
      } else {
        await admin.from("push_subscriptions").delete().eq("email", email);
      }
      await admin
        .from("notification_preferences")
        .upsert({ email, push_enabled: false }, { onConflict: "email" });
      return json(await loadState());
    }

    return json({ error: "unknown_action" }, 400);
  } catch (e) {
    console.error("[notification-prefs] error", e);
    return json({ error: "internal_error" }, 500);
  }
});
