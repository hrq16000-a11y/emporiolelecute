// Track visit beacon — Fase 2 (Opção B: telemetria agressiva).
// Coleta IP/UA/device/timeline DESDE o ms zero, sem bloquear por consentimento.
// Bots conhecidos são identificados, marcados em `visitors.is_bot=true` e descartados
// (não geram pageviews/heartbeats). Consentimento LGPD continua sendo registrado,
// mas serve apenas para a decisão jurídica de uso futuro do dado — nunca trava captura.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Payload {
  visitor_id: string;
  event: "init" | "pageview" | "heartbeat" | "consent" | "identify" | "gps" | "session_end";
  device?: Record<string, unknown>;
  utm?: Record<string, string | null>;
  referrer?: string;
  landing_path?: string;
  path?: string;
  title?: string;
  product_slug?: string;
  from_path?: string;
  cta_id?: string;
  event_type?: string;
  session_id?: string;
  pageview_id?: string;
  delta_seconds?: number;
  scroll_depth?: number;
  // legado (mantido para compatibilidade): se vier, é tratado como delta=time_on_page
  time_on_page?: number;
  accepted?: boolean;
  categories?: Record<string, boolean>;
  customer_id?: string;
  whatsapp_phone?: string;
  email?: string;
  gps_lat?: number;
  gps_lon?: number;
  gps_accuracy?: number;
}

// ---- Detecção de bots/scrapers ----
const BOT_REGEX = /(bot|crawl|spider|slurp|bingbot|googlebot|amazonbot|gptbot|claudebot|perplexitybot|ahrefs|semrush|mj12bot|yandexbot|baiduspider|facebookexternalhit|twitterbot|whatsapp|telegram|headlesschrome|phantomjs|puppeteer|playwright|duckduckbot|applebot|petalbot|seznambot|chrome-lighthouse)/i;

function detectBot(ua: string): { isBot: boolean; name: string | null } {
  if (!ua) return { isBot: false, name: null };
  const m = ua.match(BOT_REGEX);
  if (!m) return { isBot: false, name: null };
  // Tenta extrair nome amigável: "Googlebot", "AmazonBot", "GPTBot", "Bingbot/2.0"...
  const named = ua.match(/([A-Za-z0-9_\-]+(?:bot|crawler|spider))/i);
  return { isBot: true, name: (named?.[1] || m[1] || "bot").toLowerCase() };
}

function getClientIP(req: Request): string | null {
  const h = req.headers;
  const cf = h.get("cf-connecting-ip");
  if (cf) return cf;
  const xff = h.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return h.get("x-real-ip");
}

async function lookupIPGeo(ip: string | null): Promise<Record<string, unknown>> {
  if (!ip || ip === "127.0.0.1" || ip.startsWith("192.168.") || ip.startsWith("10.")) return {};
  try {
    const r = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,regionName,city,lat,lon,timezone,isp,as`);
    const j = await r.json();
    if (j.status !== "success") return {};
    return {
      ip_country: j.country,
      ip_region: j.regionName,
      ip_city: j.city,
      ip_lat: j.lat,
      ip_lon: j.lon,
      ip_timezone: j.timezone,
      ip_isp: j.isp,
      ip_asn: j.as,
    };
  } catch {
    return {};
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  let body: Payload;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!body?.visitor_id || typeof body.visitor_id !== "string" || body.visitor_id.length > 64) {
    return new Response(JSON.stringify({ error: "invalid_visitor_id" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const ip = getClientIP(req);
  const ua = req.headers.get("user-agent") || "";
  const bot = detectBot(ua);

  try {
    // ---- Upsert do visitante (sempre, mesmo bot) ----
    const { data: existing } = await supabase
      .from("visitors")
      .select("visitor_id, is_bot, total_pageviews")
      .eq("visitor_id", body.visitor_id)
      .maybeSingle();

    if (!existing) {
      const geo = bot.isBot ? {} : await lookupIPGeo(ip);
      // Whitelist device fields to prevent mass-assignment of sensitive
      // columns (e.g. consent_status) that would bypass the LGPD consent gate.
      const ALLOWED_DEVICE_FIELDS = new Set([
        "screen_w", "screen_h", "viewport_w", "viewport_h", "pixel_ratio",
        "color_depth", "touch_support", "language", "languages", "timezone",
        "device_type", "device_brand", "device_model", "os_name", "os_version",
        "browser_name", "browser_version",
      ]);
      const device = Object.fromEntries(
        Object.entries(body.device || {}).filter(([k]) => ALLOWED_DEVICE_FIELDS.has(k)),
      );
      await supabase.from("visitors").insert({
        visitor_id: body.visitor_id,
        ip,
        user_agent: ua,
        is_bot: bot.isBot,
        bot_name: bot.name,
        lead_status: bot.isBot ? "bot" : "visitor",
        ...geo,
        ...device,
        first_referrer: body.referrer || null,
        first_landing_path: body.landing_path || body.path || null,
        utm_source: body.utm?.utm_source || null,
        utm_medium: body.utm?.utm_medium || null,
        utm_campaign: body.utm?.utm_campaign || null,
        utm_term: body.utm?.utm_term || null,
        utm_content: body.utm?.utm_content || null,
      });
    } else {
      // Auto-heal: reenviar device popula campos faltantes; last_seen sempre atualiza
      const device = body.device || {};
      const patch: Record<string, unknown> = {
        last_seen_at: new Date().toISOString(),
        ip,
        ...device,
      };
      if (existing.is_bot !== bot.isBot && bot.isBot) {
        patch.is_bot = true;
        patch.bot_name = bot.name;
        patch.lead_status = "bot";
      }
      await supabase.from("visitors").update(patch).eq("visitor_id", body.visitor_id);
    }

    // ---- BOT: registra consentimento (raro) mas ignora pageviews/heartbeats ----
    if (bot.isBot) {
      if (body.event === "consent") {
        await supabase.from("cookie_consents").insert({
          visitor_id: body.visitor_id,
          accepted: !!body.accepted,
          categories: body.categories || {},
          ip, user_agent: ua,
        });
      }
      return new Response(JSON.stringify({ ok: true, is_bot: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- CONSENT (humanos): apenas registra; NÃO bloqueia captura subsequente ----
    if (body.event === "consent") {
      await supabase.from("cookie_consents").insert({
        visitor_id: body.visitor_id,
        accepted: !!body.accepted,
        categories: body.categories || {},
        ip, user_agent: ua,
      });
      await supabase.from("visitors").update({
        consent_status: body.accepted ? "accepted" : "rejected",
        consent_at: new Date().toISOString(),
      }).eq("visitor_id", body.visitor_id);
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- IDENTIFY ----
    if (body.event === "identify") {
      const update: Record<string, unknown> = {};
      if (body.customer_id) update.customer_id = body.customer_id;
      if (body.whatsapp_phone) update.whatsapp_phone = body.whatsapp_phone;
      if (Object.keys(update).length) {
        await supabase.from("visitors").update(update).eq("visitor_id", body.visitor_id);
      }
    }

    // ---- GPS ----
    if (body.event === "gps" && body.gps_lat && body.gps_lon) {
      await supabase.from("visitors").update({
        gps_lat: body.gps_lat,
        gps_lon: body.gps_lon,
        gps_accuracy: body.gps_accuracy ?? null,
        gps_captured_at: new Date().toISOString(),
      }).eq("visitor_id", body.visitor_id);
    }

    // ---- PAGEVIEW (RPC atômica: insere com step_index e incrementa total) ----
    let pageviewId: string | null = null;
    if (body.event === "pageview" && body.path) {
      const { data: pvId, error: rpcErr } = await supabase.rpc("track_pageview", {
        _visitor_id: body.visitor_id,
        _session_id: body.session_id || null,
        _path: body.path,
        _title: body.title || null,
        _product_slug: body.product_slug || null,
        _referrer: body.referrer || null,
        _from_path: body.from_path || null,
        _cta_id: body.cta_id || null,
        _event_type: body.event_type || "pageview",
      });
      if (rpcErr) console.error("track_pageview rpc error", rpcErr);
      else pageviewId = pvId as unknown as string;
    }

    // ---- HEARTBEAT (RPC atômica: SOMA delta em pageview e em visitors.total_time_seconds) ----
    if (body.event === "heartbeat") {
      const delta = Math.max(0, Math.min(
        (body.delta_seconds ?? body.time_on_page ?? 0) | 0,
        3600,
      ));
      if (delta > 0) {
        const { error: hbErr } = await supabase.rpc("track_heartbeat", {
          _visitor_id: body.visitor_id,
          _pageview_id: body.pageview_id || null,
          _delta_seconds: delta,
          _scroll_depth: typeof body.scroll_depth === "number" ? body.scroll_depth | 0 : null,
        });
        if (hbErr) console.error("track_heartbeat rpc error", hbErr);
      }
    }

    return new Response(JSON.stringify({ ok: true, pageview_id: pageviewId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("track-visit error", e);
    return new Response(JSON.stringify({ error: "internal" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
