/**
 * Seleção resiliente a drift de schema.
 *
 * Motivação: a remoção de uma coluna (ex.: `authority_manipulation`) quebrava
 * TODA a geração de sitemap, porque o PostgREST falha o SELECT inteiro quando
 * uma coluna não existe (42703).
 *
 * `resilientSelect` tenta o SELECT completo e, ao detectar "column X does not
 * exist", remove a coluna problemática e tenta de novo (até `columns.length`
 * tentativas). Cada ajuste é registrado em `diagnostics` para o resumo de
 * falhas exposto na resposta da função.
 */

// deno-lint-ignore no-explicit-any
type Client = any;

export interface QueryDiagnostic {
  table: string;
  ok: boolean;
  rows: number;
  requested_columns: number;
  used_columns: number;
  missing_columns: string[];
  error: string | null;
  duration_ms: number;
}

export interface ResilientResult<T> {
  data: T[];
  diagnostic: QueryDiagnostic;
}

const MISSING_COLUMN_RE = /column\s+"?([a-zA-Z0-9_.]+)"?\s+does not exist/i;

function extractMissingColumn(message: string): string | null {
  const m = MISSING_COLUMN_RE.exec(message || '');
  if (!m) return null;
  const raw = m[1];
  return raw.includes('.') ? raw.split('.').pop()! : raw;
}

export async function resilientSelect<T = Record<string, unknown>>(
  supabase: Client,
  table: string,
  columns: string[],
  // deno-lint-ignore no-explicit-any
  build?: (q: any) => any,
): Promise<ResilientResult<T>> {
  const started = Date.now();
  const missing: string[] = [];
  let cols = [...columns];

  for (let attempt = 0; attempt <= columns.length; attempt++) {
    if (cols.length === 0) break;
    let query = supabase.from(table).select(cols.join(', '));
    if (build) query = build(query);
    const { data, error } = await query;

    if (!error) {
      const diagnostic: QueryDiagnostic = {
        table,
        ok: true,
        rows: data?.length ?? 0,
        requested_columns: columns.length,
        used_columns: cols.length,
        missing_columns: missing,
        error: null,
        duration_ms: Date.now() - started,
      };
      if (missing.length) {
        console.warn(
          `[schema-fallback] ${table}: colunas ausentes ignoradas -> ${missing.join(', ')}`,
        );
      }
      console.log(`[query-ok] ${table}: ${diagnostic.rows} linhas em ${diagnostic.duration_ms}ms`);
      return { data: (data ?? []) as T[], diagnostic };
    }

    const missingCol = extractMissingColumn(error.message ?? '');
    if (missingCol && cols.includes(missingCol)) {
      missing.push(missingCol);
      cols = cols.filter((c) => c !== missingCol);
      console.warn(`[schema-fallback] ${table}: removendo coluna inexistente "${missingCol}"`);
      continue;
    }

    console.error(`[query-fail] ${table}: ${error.message}`);
    return {
      data: [],
      diagnostic: {
        table,
        ok: false,
        rows: 0,
        requested_columns: columns.length,
        used_columns: cols.length,
        missing_columns: missing,
        error: String(error.message ?? error).slice(0, 400),
        duration_ms: Date.now() - started,
      },
    };
  }

  return {
    data: [],
    diagnostic: {
      table,
      ok: false,
      rows: 0,
      requested_columns: columns.length,
      used_columns: 0,
      missing_columns: missing,
      error: 'todas as colunas solicitadas são inexistentes',
      duration_ms: Date.now() - started,
    },
  };
}
