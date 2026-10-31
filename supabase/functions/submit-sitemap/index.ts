// Submete o sitemap ao Google Search Console via gateway oficial e
// registra histórico de indexação em store_settings (chave `sitemap_monitor_history`).
// Pode ser chamado manualmente ou agendado via pg_cron.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendSeoFailureAlert } from '../_shared/seoAlert.ts'
import { isLocalEnv, mockIntegration } from '../_shared/localEnv.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const GSC_GATEWAY = 'https://connector-gateway.lovable.dev/google_search_console/webmasters/v3'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  // Ambiente local/offline: não chama o Google Search Console.
  if (isLocalEnv()) {
    const mock = mockIntegration('gsc:submit-sitemap', { sitemap_url: 'http://localhost:8080/sitemap.xml' })
    return new Response(JSON.stringify({ success: true, mocked: true, submission: mock.detail }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')
    const GSC_KEY = Deno.env.get('GOOGLE_SEARCH_CONSOLE_API_KEY')
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured')
    if (!GSC_KEY) throw new Error('GOOGLE_SEARCH_CONSOLE_API_KEY not configured (conecte Google Search Console em Conectores)')

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    const { data: seoData } = await supabase
      .from('store_settings').select('value').eq('key', 'seo_config').single()
    const seoConfig = seoData?.value as { canonical_url?: string; sitemap_notification_email?: string; gsc_property?: string } | null
    const siteUrl = seoConfig?.canonical_url || 'https://emporiolelecute.com.br'
    const sitemapUrl = `${siteUrl}/sitemap.xml`

    // Domain property por padrão; se o usuário tiver URL-prefix configurado em seo_config.gsc_property, usa o configurado.
    const property = seoConfig?.gsc_property || `sc-domain:${siteUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')}`
    const propertyEnc = encodeURIComponent(property)
    const sitemapEnc = encodeURIComponent(sitemapUrl)

    const headers = {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      'X-Connection-Api-Key': GSC_KEY,
      'Content-Type': 'application/json',
    }

    // 1) Submit (PUT é idempotente)
    const submitRes = await fetch(`${GSC_GATEWAY}/sites/${propertyEnc}/sitemaps/${sitemapEnc}`, {
      method: 'PUT', headers,
    })
    const submitOk = submitRes.status === 204 || submitRes.ok
    let submitError: string | null = null
    if (!submitOk) {
      submitError = await submitRes.text()
      console.error('GSC submit failed', submitRes.status, submitError)
    }

    // 2) Status atual (lastDownloaded, indexed counts)
    let status: any = null
    try {
      const statusRes = await fetch(`${GSC_GATEWAY}/sites/${propertyEnc}/sitemaps/${sitemapEnc}`, { headers })
      if (statusRes.ok) status = await statusRes.json()
      else console.warn('GSC status failed', statusRes.status)
    } catch (e) { console.warn('GSC status error', e) }

    const submittedWeb = parseInt(status?.contents?.find((c: any) => c.type === 'web')?.submitted ?? '0', 10)
    const indexedWeb = parseInt(status?.contents?.find((c: any) => c.type === 'web')?.indexed ?? '0', 10)
    const submittedImg = parseInt(status?.contents?.find((c: any) => c.type === 'image')?.submitted ?? '0', 10)

    const submission = {
      submitted_at: new Date().toISOString(),
      property,
      sitemap_url: sitemapUrl,
      gsc_status: submitOk ? 'success' : `failed (${submitRes.status})`,
      gsc_error: submitError,
      last_downloaded: status?.lastDownloaded ?? null,
      is_pending: status?.isPending ?? null,
      submitted_web: submittedWeb,
      indexed_web: indexedWeb,
      submitted_images: submittedImg,
      warnings: status?.warnings ?? '0',
      errors: status?.errors ?? '0',
    }

    await supabase.from('store_settings').upsert(
      { key: 'last_sitemap_submission', value: submission, updated_at: new Date().toISOString() },
      { onConflict: 'key' },
    )

    // 3) Append a histórico (mantém últimos 60 pontos)
    const { data: histRow } = await supabase
      .from('store_settings').select('value').eq('key', 'sitemap_monitor_history').maybeSingle()
    const history = Array.isArray((histRow?.value as any)?.points) ? (histRow!.value as any).points : []
    history.push({
      ts: submission.submitted_at,
      submitted_web: submittedWeb,
      indexed_web: indexedWeb,
      gsc_status: submission.gsc_status,
    })
    const trimmed = history.slice(-60)
    await supabase.from('store_settings').upsert(
      { key: 'sitemap_monitor_history', value: { points: trimmed }, updated_at: new Date().toISOString() },
      { onConflict: 'key' },
    )

    // 3b) Log estruturado do envio (painel /admin/seo-check)
    await supabase.from('seo_submission_log').insert({
      channel: 'gsc',
      status: submission.gsc_status,
      ok: submitOk,
      url_count: submittedWeb,
      target: property,
      detail: {
        sitemap_url: sitemapUrl,
        indexed_web: indexedWeb,
        submitted_images: submittedImg,
        last_downloaded: submission.last_downloaded,
        errors: submission.errors,
        warnings: submission.warnings,
        gsc_error: submitError ? String(submitError).slice(0, 500) : null,
      },
    })



    // 3c) Alerta automático em caso de falha no GSC
    if (!submitOk) {
      await sendSeoFailureAlert(supabase, {
        channel: 'gsc',
        target: sitemapUrl,
        reason: submitError ? String(submitError).slice(0, 500) : `status ${submission.gsc_status}`,
        extra: { property, errors: submission.errors, warnings: submission.warnings },
      })
    }

    // 4) Email opcional
    const notificationEmail = seoConfig?.sitemap_notification_email
    if (notificationEmail) {
      try {
        const resendKey = Deno.env.get('RESEND_API_KEY')
        if (resendKey) {
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${resendKey}` },
            body: JSON.stringify({
              from: 'Empório LeleCute <noreply@emporiolelecute.com.br>',
              to: [notificationEmail],
              subject: 'Sitemap — relatório de indexação',
              html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
                <h2 style="color:#F87C6D">Sitemap atualizado no Google Search Console</h2>
                <p>Propriedade: <code>${property}</code></p>
                <ul>
                  <li>Status submissão: <strong>${submission.gsc_status}</strong></li>
                  <li>URLs web submetidas: <strong>${submittedWeb}</strong></li>
                  <li>URLs web indexadas: <strong>${indexedWeb}</strong></li>
                  <li>Imagens submetidas: <strong>${submittedImg}</strong></li>
                  <li>Último download Google: ${submission.last_downloaded ?? '—'}</li>
                  <li>Avisos: ${submission.warnings} · Erros: ${submission.errors}</li>
                </ul>
                <p><a href="${sitemapUrl}">${sitemapUrl}</a></p>
              </div>`,
            }),
          })
        }
      } catch (e) { console.error('email error', e) }
    }

    return new Response(JSON.stringify({ success: submitOk, submission }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    console.error('submit-sitemap error', error)
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
