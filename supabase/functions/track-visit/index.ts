// Track visit beacon — recebe eventos de tracking do navegador, enriquece com IP/geo
// e persiste em visitors / visitor_sessions / visitor_pageviews / cookie_consents.
// Público (sem JWT) — usa SERVICE_ROLE internamente. Respeita consentimento LGPD.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Payload {
  visitor_id: string;
  event: "init" | "pageview" | "heartbeat" | "consent" | "identify" | "gps" | "session_end";
  // init
  device?: Record<string, unknown>;
  utm?: Record<string, string | null>;
  referrer?: string;
  landing_path?: string;
  // pageview
  path?: string;
  title?: string;
  product_slug?: string;
  // heartbeat / session
  session_id?: string;
  time_on_page?: number;
  scroll_depth?: number;
  // consent
  accepted?: boolean;
  categories?: Record<string, boolean>;
  // identify
  customer_id?: string;
  whatsapp_phone?: string;
  email?: string;
  // gps
  gps_lat?: number;
  gps_lon?: number;
  gps_accuracy?: number;
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

  try {
    // Garante visitor existe (upsert mínimo)
    const { data: existing } = await supabase
      .from("visitors").select("visitor_id, consent_status, ip_country")
      .eq("visitor_id", body.visitor_id).maybeSingle();

    if (!existing) {
      const geo = await lookupIPGeo(ip);
      const device = body.device || {};
      await supabase.from("visitors").insert({
        visitor_id: body.visitor_id,
        ip,
        user_agent: ua,
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
      await supabase.from("visitors").update({
        last_seen_at: new Date().toISOString(),
        ip,
      }).eq("visitor_id", body.visitor_id);
    }

    // CONSENT
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

    // Bloqueia outros eventos se consentimento ainda não aceito
    const consent = existing?.consent_status ?? "pending";
    if (consent !== "accepted") {
      return new Response(JSON.stringify({ ok: true, blocked: "no_consent" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // IDENTIFY (vincula visitor a customer)
    if (body.event === "identify") {
      const update: Record<string, unknown> = {};
      if (body.customer_id) update.customer_id = body.customer_id;
      if (body.whatsapp_phone) update.whatsapp_phone = body.whatsapp_phone;
      if (Object.keys(update).length) {
        await supabase.from("visitors").update(update).eq("visitor_id", body.visitor_id);
      }
    }

    // GPS
    if (body.event === "gps" && body.gps_lat && body.gps_lon) {
      await supabase.from("visitors").update({
        gps_lat: body.gps_lat,
        gps_lon: body.gps_lon,
        gps_accuracy: body.gps_accuracy ?? null,
        gps_captured_at: new Date().toISOString(),
      }).eq("visitor_id", body.visitor_id);
    }

    // PAGEVIEW
    if (body.event === "pageview" && body.path) {
      let productId: string | null = null;
      if (body.product_slug) {
        const { data: p } = await supabase.from("products")
          .select("id").eq("slug", body.product_slug).maybeSingle();
        productId = p?.id ?? null;
      }
      await supabase.from("visitor_pageviews").insert({
        visitor_id: body.visitor_id,
        session_id: body.session_id || null,
        path: body.path.slice(0, 500),
        title: body.title?.slice(0, 300) || null,
        product_id: productId,
        referrer: body.referrer?.slice(0, 500) || null,
      });
      // increment total
      await supabase.rpc("noop_increment").catch(() => {});
      // simple update of totals
      await supabase.from("visitors").update({
        total_pageviews: ((existing as { total_pageviews?: number } | null)?.total_pageviews ?? 0) + 1,
        last_seen_at: new Date().toISOString(),
      }).eq("visitor_id", body.visitor_id);
    }

    // HEARTBEAT (atualiza tempo na última pageview da sessão)
    if (body.event === "heartbeat" && body.time_on_page) {
      const { data: last } = await supabase.from("visitor_pageviews")
        .select("id")
        .eq("visitor_id", body.visitor_id)
        .order("viewed_at", { ascending: false })
        .limit(1).maybeSingle();
      if (last) {
        await supabase.from("visitor_pageviews").update({
          time_on_page_seconds: Math.min(body.time_on_page | 0, 3600),
          scroll_depth_pct: body.scroll_depth ? Math.min(body.scroll_depth | 0, 100) : null,
        }).eq("id", last.id);
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("track-visit error", e);
    return new Response(JSON.stringify({ error: "internal" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
