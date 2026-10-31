/**
 * Simula o acesso de crawlers (Bingbot, Googlebot, IndexNow bot) à chave
 * IndexNow, ao sitemap e ao robots.txt, registrando status e cabeçalhos.
 * Serve para confirmar bloqueios em tempo real a partir do admin.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ORIGIN = 'https://emporiolelecute.com.br';
const INDEXNOW_KEY = '87296b506db34e8cb22cc31288f33f84';

const AGENTS: Record<string, string> = {
  bingbot: 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
  googlebot: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  browser: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36',
};

const TARGETS = [
  { name: 'IndexNow key file', url: `${ORIGIN}/${INDEXNOW_KEY}.txt`, expect: INDEXNOW_KEY },
  { name: 'Sitemap', url: `${ORIGIN}/sitemap.xml`, expect: '<urlset' },
  { name: 'robots.txt', url: `${ORIGIN}/robots.txt`, expect: 'Sitemap' },
];

interface ProbeResult {
  target: string;
  url: string;
  agent: string;
  status: number;
  ok: boolean;
  content_type: string | null;
  bytes: number;
  content_matches: boolean;
  headers: Record<string, string>;
  error: string | null;
  duration_ms: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    let agents = ['bingbot', 'googlebot'];
    try {
      const body = await req.json();
      if (Array.isArray(body?.agents) && body.agents.length) agents = body.agents;
    } catch { /* sem body */ }

    const results: ProbeResult[] = [];
    for (const agentKey of agents) {
      const ua = AGENTS[agentKey] ?? AGENTS.browser;
      for (const t of TARGETS) {
        const started = Date.now();
        try {
          const res = await fetch(t.url, {
            headers: { 'User-Agent': ua, Accept: '*/*' },
            redirect: 'follow',
          });
          const text = (await res.text()).slice(0, 4000);
          const headers: Record<string, string> = {};
          for (const [k, v] of res.headers.entries()) {
            if (['content-type', 'cache-control', 'server', 'x-robots-tag', 'cf-ray', 'content-length', 'location'].includes(k)) {
              headers[k] = v;
            }
          }
          results.push({
            target: t.name,
            url: t.url,
            agent: agentKey,
            status: res.status,
            ok: res.ok,
            content_type: res.headers.get('content-type'),
            bytes: text.length,
            content_matches: text.includes(t.expect),
            headers,
            error: res.ok ? null : text.slice(0, 200),
            duration_ms: Date.now() - started,
          });
        } catch (e) {
          results.push({
            target: t.name, url: t.url, agent: agentKey, status: 0, ok: false,
            content_type: null, bytes: 0, content_matches: false, headers: {},
            error: e instanceof Error ? e.message : String(e),
            duration_ms: Date.now() - started,
          });
        }
      }
    }

    // Ping "dry" ao IndexNow do Bing com uma única URL para expor bloqueio real
    let bingIndexNow = { status: 0, ok: false, body: '' };
    try {
      const ping = await fetch('https://www.bing.com/indexnow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'User-Agent': AGENTS.browser },
        body: JSON.stringify({
          host: 'emporiolelecute.com.br',
          key: INDEXNOW_KEY,
          keyLocation: `${ORIGIN}/${INDEXNOW_KEY}.txt`,
          urlList: [`${ORIGIN}/`],
        }),
      });
      bingIndexNow = {
        status: ping.status,
        ok: ping.ok || ping.status === 202,
        body: (await ping.text()).slice(0, 400),
      };
    } catch (e) {
      bingIndexNow.body = e instanceof Error ? e.message : String(e);
    }

    const blocked = results.filter((r) => !r.ok || !r.content_matches);
    const payload = {
      ran_at: new Date().toISOString(),
      summary: {
        probes: results.length,
        ok: results.length - blocked.length,
        blocked: blocked.length,
        bing_indexnow_status: bingIndexNow.status,
        bing_indexnow_ok: bingIndexNow.ok,
      },
      results,
      bing_indexnow: bingIndexNow,
    };

    try {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      );
      await supabase.from('seo_submission_log').insert({
        channel: 'crawler-probe',
        status: blocked.length ? `blocked (${blocked.length})` : 'ok',
        ok: blocked.length === 0,
        url_count: results.length,
        target: ORIGIN,
        detail: payload.summary,
      });
    } catch (e) {
      console.error('log crawler-probe falhou', e);
    }

    return new Response(JSON.stringify(payload), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('seo-crawler-probe error', msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
