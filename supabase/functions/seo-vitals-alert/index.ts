/**
 * seo-vitals-alert
 * ----------------
 * Recebe as violações de limite de Core Web Vitals detectadas em uma run
 * sob demanda do /admin/seo-check e dispara alerta por e-mail (com throttle
 * de 6h, reaproveitando `_shared/seoAlert.ts`).
 *
 * Também persiste os limites configurados em `store_settings.seo_vitals_thresholds`
 * quando enviados. Requer JWT de admin.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { sendSeoFailureAlert } from '../_shared/seoAlert.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Breach {
  pageType: string;
  metric: 'LCP' | 'CLS' | 'INP';
  value: number;
  limit: number;
  samples?: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
    const { data: userRes } = await supabase.auth.getUser(token);
    const userId = userRes?.user?.id;
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Não autenticado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const { data: isAdmin } = await supabase.rpc('has_role', { _user_id: userId, _role: 'admin' });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Acesso restrito a administradores' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => ({}));
    const breaches: Breach[] = Array.isArray(body?.breaches) ? body.breaches.slice(0, 50) : [];
    const thresholds = body?.thresholds as Record<string, number> | undefined;

    if (thresholds) {
      await supabase
        .from('store_settings')
        .upsert({ key: 'seo_vitals_thresholds', value: thresholds }, { onConflict: 'key' });
    }

    let alert = { sent: false, reason: 'sem violações' };
    if (breaches.length) {
      const fmt = (b: Breach) =>
        `${b.pageType} — ${b.metric} ${b.metric === 'CLS' ? b.value.toFixed(3) : `${Math.round(b.value)}ms`} ` +
        `(limite ${b.metric === 'CLS' ? b.limit.toFixed(3) : `${b.limit}ms`})`;

      alert = await sendSeoFailureAlert(supabase, {
        channel: 'vitals',
        target: 'https://emporiolelecute.com.br',
        reason: `${breaches.length} rota(s) acima do limite de Core Web Vitals definido no /admin/seo-check`,
        urls: breaches.map(fmt),
        extra: { breaches },
      });
    }

    await supabase.from('seo_submission_log').insert({
      channel: 'vitals',
      status: breaches.length ? `breach (${breaches.length})` : 'ok',
      ok: breaches.length === 0,
      url_count: breaches.length,
      target: 'https://emporiolelecute.com.br',
      detail: { breaches, thresholds, alert },
    });

    return new Response(JSON.stringify({ ok: breaches.length === 0, breaches, alert }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('seo-vitals-alert error', msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
