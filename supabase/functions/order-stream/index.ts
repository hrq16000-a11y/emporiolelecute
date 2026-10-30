// SSE (Server-Sent Events) — status do pedido em tempo real.
// GET /order-stream?code=LC123456
// Emite: "ready" (snapshot inicial), "status" (mudanças), "ping" (heartbeat).
// O cliente faz fallback automático para polling se a conexão falhar.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const POLL_MS = 5000;
const HEARTBEAT_MS = 20000;
const MAX_LIFETIME_MS = 10 * 60 * 1000; // 10 min — cliente reconecta sozinho

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const url = new URL(req.url);
  const code = (url.searchParams.get("code") || "").trim().toUpperCase();
  if (!/^[A-Z0-9]{4,20}$/.test(code)) {
    return new Response(JSON.stringify({ error: "Invalid order code" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Valida a existência do pedido antes de abrir o stream (evita streams órfãos).
  const { data: initial, error } = await supabase
    .from("orders")
    .select("order_code, status, payment_status, tracking_code, tracking_url, updated_at")
    .eq("order_code", code)
    .maybeSingle();

  if (error || !initial) {
    return new Response(JSON.stringify({ error: "Order not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();
  let timer: number | undefined;
  let heartbeat: number | undefined;
  let lifetime: number | undefined;

  const stream = new ReadableStream({
    start(controller) {
      let lastSignature = JSON.stringify(initial);
      let closed = false;

      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
          );
        } catch {
          closed = true;
        }
      };

      const cleanup = () => {
        closed = true;
        if (timer) clearInterval(timer);
        if (heartbeat) clearInterval(heartbeat);
        if (lifetime) clearTimeout(lifetime);
        try { controller.close(); } catch { /* já fechado */ }
      };

      send("ready", initial);

      timer = setInterval(async () => {
        if (closed) return;
        const { data } = await supabase
          .from("orders")
          .select("order_code, status, payment_status, tracking_code, tracking_url, updated_at")
          .eq("order_code", code)
          .maybeSingle();
        if (!data) return;
        const signature = JSON.stringify(data);
        if (signature !== lastSignature) {
          lastSignature = signature;
          send("status", data);
        }
      }, POLL_MS) as unknown as number;

      heartbeat = setInterval(() => send("ping", { t: Date.now() }), HEARTBEAT_MS) as unknown as number;
      lifetime = setTimeout(cleanup, MAX_LIFETIME_MS) as unknown as number;

      req.signal.addEventListener("abort", cleanup);
    },
    cancel() {
      if (timer) clearInterval(timer);
      if (heartbeat) clearInterval(heartbeat);
      if (lifetime) clearTimeout(lifetime);
    },
  });

  return new Response(stream, {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
});
