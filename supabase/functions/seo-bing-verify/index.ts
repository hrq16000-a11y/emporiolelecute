/**
 * seo-bing-verify
 * ---------------
 * Valida a integração com o Bing Webmaster Tools + IndexNow:
 *  1. a meta tag `msvalidate.01` está presente no HTML servido na home?
 *  2. o arquivo de chave do IndexNow responde 200 com a chave correta?
 *  3. o sitemap está acessível ao crawler do Bing (User-Agent bingbot)?
 *  4. o robots.txt permite o bingbot?
 *
 * Somente leitura — não altera nada no site.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { isLocalEnv, mockIntegration } from '../_shared/localEnv.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ORIGIN = 'https://emporiolelecute.com.br';
const INDEXNOW_KEY = '87296b506db34e8cb22cc31288f33f84';
const BINGBOT =
  'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)';

interface Check {
  id: string;
  label: string;
  ok: boolean;
  detail: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const checks: Check[] = [];
  const push = (id: string, label: string, ok: boolean, detail: string) =>
    checks.push({ id, label, ok, detail });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // token configurado no admin
    const { data: cfg } = await supabase
      .from('store_settings').select('value').eq('key', 'seo_config').maybeSingle();
    const token = String((cfg?.value as Record<string, unknown> | null)?.bing_verification ?? '').trim();

    // 1) meta tag na home
    let html = '';
    try {
      const r = await fetch(ORIGIN, { headers: { 'User-Agent': BINGBOT }, cache: 'no-store' } as RequestInit);
      html = await r.text();
      if (!token) {
        push('meta', 'Meta tag msvalidate.01', false,
          'Nenhum token do Bing foi salvo ainda. Cole o token do Bing Webmaster Tools e salve.');
      } else {
        const found = new RegExp(
          `<meta[^>]+name=["']msvalidate\\.01["'][^>]+content=["']${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']`,
          'i',
        ).test(html);
        push('meta', 'Meta tag msvalidate.01', found,
          found
            ? 'Token encontrado no HTML servido ao bingbot.'
            : 'Token salvo, mas ainda não aparece no HTML publicado. Publique o site e valide novamente.');
      }
    } catch (e) {
      push('meta', 'Meta tag msvalidate.01', false, `Falha ao carregar a home: ${e instanceof Error ? e.message : e}`);
    }

    // 2) arquivo de chave IndexNow
    try {
      const r = await fetch(`${ORIGIN}/${INDEXNOW_KEY}.txt`, { cache: 'no-store' } as RequestInit);
      const body = (await r.text()).trim();
      const ok = r.ok && body === INDEXNOW_KEY;
      push('indexnow_key', 'Arquivo de chave do IndexNow', ok,
        ok ? `Chave publicada em /${INDEXNOW_KEY}.txt` : `Status ${r.status} — conteúdo inesperado: "${body.slice(0, 60)}"`);
    } catch (e) {
      push('indexnow_key', 'Arquivo de chave do IndexNow', false, String(e));
    }

    // 3) sitemap acessível ao bingbot
    let sitemapUrls = 0;
    try {
      const r = await fetch(`${ORIGIN}/sitemap.xml`, { headers: { 'User-Agent': BINGBOT }, cache: 'no-store' } as RequestInit);
      const xml = await r.text();
      sitemapUrls = [...xml.matchAll(/<loc>[^<]+<\/loc>/g)].length;
      const ok = r.ok && sitemapUrls > 0;
      push('sitemap', 'Sitemap acessível ao bingbot', ok,
        ok ? `${sitemapUrls} URLs entregues com status ${r.status}.` : `Status ${r.status}, ${sitemapUrls} URLs.`);
    } catch (e) {
      push('sitemap', 'Sitemap acessível ao bingbot', false, String(e));
    }

    // 4) robots.txt permite bingbot
    try {
      const r = await fetch(`${ORIGIN}/robots.txt`, { headers: { 'User-Agent': BINGBOT }, cache: 'no-store' } as RequestInit);
      const txt = await r.text();
      const blocked = /User-agent:\s*(\*|bingbot)[\s\S]*?Disallow:\s*\/\s*$/im.test(txt);
      push('robots', 'robots.txt permite o bingbot', r.ok && !blocked,
        blocked ? 'Há um Disallow: / aplicável ao bingbot.' : `robots.txt respondeu ${r.status} sem bloqueio total.`);
    } catch (e) {
      push('robots', 'robots.txt permite o bingbot', false, String(e));
    }

    // 5) ping real de teste no IndexNow (uma única URL: a home)
    if (isLocalEnv()) {
      mockIntegration('indexnow:bing-ping', { host: 'emporiolelecute.com.br' });
      push('indexnow_ping', 'Ping de teste no IndexNow (Bing)', true,
        'Simulado (ambiente local, sem chamada externa).');
    } else {
      try {
        const ping = await fetch('https://www.bing.com/indexnow', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: JSON.stringify({
            host: 'emporiolelecute.com.br',
            key: INDEXNOW_KEY,
            keyLocation: `${ORIGIN}/${INDEXNOW_KEY}.txt`,
            urlList: [`${ORIGIN}/`],
          }),
        });
        const ok = ping.ok || ping.status === 202;
        push('indexnow_ping', 'Ping de teste no IndexNow (Bing)', ok,
          ok ? `Bing aceitou o envio (HTTP ${ping.status}).` : `Bing recusou: HTTP ${ping.status} — ${(await ping.text()).slice(0, 200)}`);
      } catch (e) {
        push('indexnow_ping', 'Ping de teste no IndexNow (Bing)', false, String(e));
      }
    }

    const allOk = checks.every((c) => c.ok);
    await supabase.from('store_settings').upsert({
      key: 'bing_verification_status',
      value: { checked_at: new Date().toISOString(), all_ok: allOk, checks },
      updated_at: new Date().toISOString(),
    }, { onConflict: 'key' });

    return new Response(JSON.stringify({ all_ok: allOk, token_configured: Boolean(token), checks, sitemap_urls: sitemapUrls }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[seo-bing-verify]', msg);
    return new Response(JSON.stringify({ error: msg, checks }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
