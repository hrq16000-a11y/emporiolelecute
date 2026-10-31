/**
 * Local development guards for third-party integrations.
 *
 * When the Edge Functions run inside the Supabase CLI stack (`supabase start`),
 * outbound calls to Resend, IndexNow, Bing and Google Search Console are
 * mocked: nothing leaves the machine and a simulated success is logged.
 *
 * Detection order:
 * 1. `LOCAL_MODE=true` (explicit override, set it in `supabase/.env.local`)
 * 2. `SUPABASE_URL` pointing at localhost / 127.0.0.1 / host.docker.internal
 */
export function isLocalEnv(): boolean {
  const explicit = (Deno.env.get('LOCAL_MODE') ?? '').toLowerCase();
  if (explicit === 'true' || explicit === '1') return true;
  if (explicit === 'false' || explicit === '0') return false;

  const url = Deno.env.get('SUPABASE_URL') ?? '';
  return /(^https?:\/\/)?(127\.0\.0\.1|localhost|host\.docker\.internal|kong:)/.test(url);
}

/** Shape returned by every mocked integration call. */
export interface MockedResult {
  mocked: true;
  ok: true;
  channel: string;
  detail: Record<string, unknown>;
}

/**
 * Logs a simulated success for an integration that is skipped offline.
 * Always returns `ok: true` so callers keep their happy path intact.
 */
export function mockIntegration(
  channel: string,
  detail: Record<string, unknown> = {},
): MockedResult {
  console.log(`[local-mock] ${channel} — chamada externa ignorada (ambiente local)`, detail);
  return { mocked: true, ok: true, channel, detail };
}
