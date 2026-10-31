/**
 * Alertas automáticos de falha em canais de indexação
 * (IndexNow, Merchant feed, Google Search Console).
 *
 * Regras:
 * - Só dispara e-mail em FALHA (nunca em sucesso) — evita ruído e consumo.
 * - Throttle de 6h por canal via `store_settings.seo_alert_state`.
 * - Sempre inclui URL alvo e motivo do erro.
 */

import { isLocalEnv, mockIntegration } from './localEnv.ts';

// deno-lint-ignore no-explicit-any
type Client = any;

const THROTTLE_MINUTES = 360;

export interface SeoFailure {
  channel: 'indexnow' | 'gsc' | 'merchant' | 'sitemap' | 'vitals';
  target: string;
  reason: string;
  urls?: string[];
  extra?: Record<string, unknown>;
}

const LABEL: Record<SeoFailure['channel'], string> = {
  indexnow: 'IndexNow',
  gsc: 'Google Search Console',
  merchant: 'Google Merchant (feed)',
  sitemap: 'Sitemap',
  vitals: 'Core Web Vitals',
};

async function alertEmail(supabase: Client): Promise<string | null> {
  const { data } = await supabase
    .from('store_settings').select('value').eq('key', 'seo_config').maybeSingle();
  const cfg = data?.value as { sitemap_notification_email?: string; alert_email?: string } | null;
  return cfg?.alert_email || cfg?.sitemap_notification_email || null;
}

async function logAttempt(
  supabase: Client,
  failure: SeoFailure,
  emailTo: string | null,
  sent: boolean,
  outcome: string,
) {
  try {
    await supabase.from('seo_alert_log').insert({
      channel: failure.channel,
      target: failure.target,
      reason: String(failure.reason).slice(0, 2000),
      urls: (failure.urls ?? []).slice(0, 50),
      extra: failure.extra ?? {},
      email_to: emailTo,
      sent,
      outcome,
    });
  } catch (e) {
    console.error('[seo-alert] falha ao registrar log', e);
  }
}

export async function sendSeoFailureAlert(supabase: Client, failure: SeoFailure): Promise<{
  sent: boolean;
  reason: string;
}> {
  // Ambiente local/offline: não chama o Resend, apenas registra o alerta.
  if (isLocalEnv()) {
    mockIntegration('resend:seo-alert', { channel: failure.channel, target: failure.target });
    await logAttempt(supabase, failure, null, false, 'mocked (local)');
    return { sent: true, reason: 'mocked (local)' };
  }

  try {
    const { data: stateRow } = await supabase
      .from('store_settings').select('value').eq('key', 'seo_alert_state').maybeSingle();
    const state = (stateRow?.value as Record<string, string> | null) ?? {};
    const last = state[failure.channel];
    if (last && (Date.now() - new Date(last).getTime()) / 60000 < THROTTLE_MINUTES) {
      await logAttempt(supabase, failure, null, false, 'throttled');
      return { sent: false, reason: 'throttled' };
    }

    const to = await alertEmail(supabase);
    const resendKey = Deno.env.get('RESEND_API_KEY');
    if (!to || !resendKey) {
      await logAttempt(supabase, failure, to, false, 'sem e-mail ou RESEND_API_KEY');
      return { sent: false, reason: 'sem e-mail ou RESEND_API_KEY' };
    }

    const urls = (failure.urls ?? []).slice(0, 20);
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${resendKey}` },
      body: JSON.stringify({
        from: 'Empório LeleCute <noreply@emporiolelecute.com.br>',
        to: [to],
        subject: `[SEO] Falha em ${LABEL[failure.channel]}`,
        html: `<div style="font-family:sans-serif;max-width:640px;margin:0 auto">
          <h2 style="color:#F87C6D">Falha em ${LABEL[failure.channel]}</h2>
          <p><strong>Alvo:</strong> ${failure.target}</p>
          <p><strong>Motivo:</strong> ${String(failure.reason).slice(0, 800)}</p>
          ${urls.length ? `<p><strong>URLs afetadas (${failure.urls!.length}):</strong></p><ul>${urls.map((u) => `<li>${u}</li>`).join('')}</ul>` : ''}
          ${failure.extra ? `<pre style="background:#faf7f5;padding:12px;border-radius:8px;font-size:12px;white-space:pre-wrap">${JSON.stringify(failure.extra, null, 2).slice(0, 2000)}</pre>` : ''}
          <p style="font-size:12px;color:#888">Detectado em ${new Date().toLocaleString('pt-BR')} · alerta limitado a 1 a cada 6h por canal.</p>
        </div>`,
      }),
    });

    if (!res.ok) {
      console.error('[seo-alert] resend falhou', res.status, (await res.text()).slice(0, 300));
      await logAttempt(supabase, failure, to, false, `resend ${res.status}`);
      return { sent: false, reason: `resend ${res.status}` };
    }

    await supabase.from('store_settings').upsert({
      key: 'seo_alert_state',
      value: { ...state, [failure.channel]: new Date().toISOString() },
      updated_at: new Date().toISOString(),
    }, { onConflict: 'key' });

    await logAttempt(supabase, failure, to, true, 'ok');
    return { sent: true, reason: 'ok' };
  } catch (e) {
    console.error('[seo-alert] erro', e);
    return { sent: false, reason: e instanceof Error ? e.message : String(e) };
  }
}
