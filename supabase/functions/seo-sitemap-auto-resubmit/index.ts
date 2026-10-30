// Verifica a flag store_settings.sitemap_dirty e, se positivo,
// chama submit-sitemap e limpa a flag. Roda via pg_cron a cada 15 min
// para fazer debounce de várias edições no admin.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendSeoFailureAlert } from '../_shared/seoAlert.ts'
import { isLocalEnv, mockIntegration } from '../_shared/localEnv.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, serviceKey)

    const { data: dirtyRow } = await supabase
      .from('store_settings').select('value, updated_at')
      .eq('key', 'sitemap_dirty').maybeSingle()

    const dirty = (dirtyRow?.value as { dirty?: boolean } | null)?.dirty === true
    let force = false
    if (req.method === 'POST') {
      try { const b = await req.json(); force = b?.force === true } catch { /* ignore */ }
    }

    if (!dirty && !force) {
      return new Response(JSON.stringify({ skipped: true, reason: 'sitemap not dirty' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Debounce: só reenvia se passaram pelo menos 5 min desde o último submit
    const { data: lastSub } = await supabase
      .from('store_settings').select('value')
      .eq('key', 'last_sitemap_submission').maybeSingle()
    const lastTs = (lastSub?.value as { submitted_at?: string } | null)?.submitted_at
    if (!force && lastTs) {
      const diffMin = (Date.now() - new Date(lastTs).getTime()) / 60000
      if (diffMin < 5) {
        return new Response(JSON.stringify({ skipped: true, reason: `last submit ${Math.round(diffMin)}min ago` }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    // Chama submit-sitemap
    const r = await fetch(`${supabaseUrl}/functions/v1/submit-sitemap`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ trigger: 'auto-resubmit' }),
    })
    const result = await r.json().catch(() => ({}))

    // Ping IndexNow com as URLs do sitemap — complementa o GSC.
    // Envia para múltiplos endpoints: se um recusar (ex.: Bing exige
    // verificação própria), os demais ainda recebem as URLs.
    const INDEXNOW_KEY = '87296b506db34e8cb22cc31288f33f84'
    const ORIGIN = 'https://emporiolelecute.com.br'
    const ENDPOINTS: { name: string; url: string }[] = [
      { name: 'indexnow.org', url: 'https://api.indexnow.org/IndexNow' },
      { name: 'yandex', url: 'https://yandex.com/indexnow' },
      { name: 'bing', url: 'https://www.bing.com/indexnow' },
    ]
    const indexnow = {
      sent: false,
      urls: 0,
      status: 0,
      error: null as string | null,
      endpoints: [] as { name: string; status: number; ok: boolean; error: string | null }[],
    }
    try {
      const sm = await fetch(`${ORIGIN}/sitemap.xml`)
      const xml = await sm.text()
      const urlList = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)]
        .map((m) => m[1])
        .filter((u) => u.startsWith(ORIGIN))
        .slice(0, 10000)
      indexnow.urls = urlList.length

      if (urlList.length) {
        const payload = JSON.stringify({
          host: 'emporiolelecute.com.br',
          key: INDEXNOW_KEY,
          keyLocation: `${ORIGIN}/${INDEXNOW_KEY}.txt`,
          urlList,
        })
        for (const ep of ENDPOINTS) {
          // Offline: nenhum ping sai da máquina, sucesso simulado.
          if (isLocalEnv()) {
            mockIntegration(`indexnow:${ep.name}`, { urls: urlList.length })
            indexnow.endpoints.push({ name: ep.name, status: 200, ok: true, error: null })
            continue
          }
          try {
            const ping = await fetch(ep.url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json; charset=utf-8' },
              body: payload,
            })
            const ok = ping.ok || ping.status === 202
            indexnow.endpoints.push({
              name: ep.name,
              status: ping.status,
              ok,
              error: ok ? null : (await ping.text()).slice(0, 300),
            })
          } catch (e) {
            indexnow.endpoints.push({
              name: ep.name, status: 0, ok: false,
              error: e instanceof Error ? e.message : String(e),
            })
          }
        }
        const accepted = indexnow.endpoints.filter((e) => e.ok)
        indexnow.sent = accepted.length > 0
        indexnow.status = accepted[0]?.status ?? indexnow.endpoints[0]?.status ?? 0
        const rejected = indexnow.endpoints.filter((e) => !e.ok)
        if (rejected.length) {
          indexnow.error = rejected.map((e) => `${e.name} [${e.status}]: ${e.error}`).join(' | ')
        }
      }
    } catch (e) {
      indexnow.error = e instanceof Error ? e.message : String(e)
    }

    await supabase.from('store_settings').upsert({
      key: 'last_indexnow_ping',
      value: { ...indexnow, pinged_at: new Date().toISOString() },
      updated_at: new Date().toISOString(),
    }, { onConflict: 'key' })

    const acceptedNames = indexnow.endpoints.filter((e) => e.ok).map((e) => e.name)
    await supabase.from('seo_submission_log').insert({
      channel: 'indexnow',
      status: indexnow.sent
        ? `success (${acceptedNames.join(', ')})`
        : `failed (${indexnow.status || 0})`,
      ok: indexnow.sent,
      url_count: indexnow.urls,
      target: 'emporiolelecute.com.br',
      detail: {
        key_location: `${ORIGIN}/${INDEXNOW_KEY}.txt`,
        endpoints: indexnow.endpoints,
        error: indexnow.error ? String(indexnow.error).slice(0, 500) : null,
        triggered_by: force ? 'manual' : 'cron',
      },
    })



    // Alerta por e-mail quando o IndexNow falhar
    if (!indexnow.sent && indexnow.urls > 0) {
      await sendSeoFailureAlert(supabase, {
        channel: 'indexnow',
        target: `${ORIGIN}/${INDEXNOW_KEY}.txt`,
        reason: indexnow.error ?? 'nenhum endpoint aceitou o envio',
        extra: { endpoints: indexnow.endpoints, urls: indexnow.urls },
      })
    }

    if (r.ok) {
      // Limpa a flag
      await supabase.from('store_settings').upsert({
        key: 'sitemap_dirty',
        value: { dirty: false, cleared_at: new Date().toISOString() },
        updated_at: new Date().toISOString(),
      }, { onConflict: 'key' })
    }

    return new Response(JSON.stringify({ resubmitted: r.ok, status: r.status, result, indexnow }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    console.error('seo-sitemap-auto-resubmit error', error)
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
