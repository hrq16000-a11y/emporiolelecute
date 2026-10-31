/**
 * Parse SAFE de preço para JSON-LD / microdata.
 *
 * O Supabase pode devolver colunas `numeric` como STRING (ex.: "4.60"),
 * e conteúdo editado à mão pode chegar como "R$ 4,60". O Google exige
 * que o valor monetário do schema seja estritamente numérico,
 * com ponto decimal e sem símbolo de moeda.
 *
 * Regras aplicadas:
 *  - remove tudo que não for dígito, vírgula, ponto ou sinal negativo
 *  - trata separador decimal brasileiro ("1.234,56" -> 1234.56)
 *  - devolve `null` quando o valor é ausente/inválido, para que o caller
 *    possa OMITIR o campo em vez de emitir `NaN` (que quebra o rich result)
 */
export function parseSafePrice(value: unknown): number | null {
  if (value === null || value === undefined) return null;

  if (typeof value === 'number') {
    return Number.isFinite(value) ? Math.round(value * 100) / 100 : null;
  }

  if (typeof value !== 'string') return null;

  const cleaned = value.replace(/[^\d,.-]/g, '').trim();
  if (!cleaned) return null;

  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');

  let normalized: string;
  if (lastComma > lastDot) {
    // formato pt-BR: pontos são milhar, vírgula é decimal
    normalized = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (lastDot > -1) {
    // formato en-US: vírgulas são milhar
    normalized = cleaned.replace(/,/g, '');
  } else {
    normalized = cleaned.replace(/,/g, '');
  }

  const n = Number(normalized);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100) / 100;
}

/**
 * Formata um preço para o formato exigido pelo schema.org: "4.60".
 * Devolve `null` quando o valor não é utilizável.
 */
export function formatSchemaPrice(value: unknown): string | null {
  const n = parseSafePrice(value);
  return n === null ? null : n.toFixed(2);
}

/** Contexto de diagnóstico para o monitoramento em runtime do JSON-LD. */
export interface SafePriceContext {
  /** Componente/local que gerou o schema (ex.: "ProductStructuredData"). */
  source: string;
  /** Identificador do item (slug/sku) para rastrear no log. */
  ref?: string;
  /** Campo lógico (ex.: "price" | "originalPrice"). */
  field?: string;
}

/**
 * Igual a {@link parseSafePrice}, porém emite um alerta silencioso no console
 * quando o valor chega inválido (null/undefined/string não numérica) —
 * o JSON-LD segue válido (campo omitido), mas o problema fica observável.
 *
 * Nunca lança: monitoramento jamais pode derrubar a renderização.
 */
export function parseSafePriceMonitored(
  value: unknown,
  context: SafePriceContext,
): number | null {
  const parsed = parseSafePrice(value);
  if (parsed === null && value !== null && value !== undefined && value !== '') {
    try {
      console.error('[jsonld:invalid-price]', {
        ...context,
        received: typeof value === 'object' ? JSON.stringify(value) : String(value),
        receivedType: typeof value,
      });
    } catch {
      /* monitoramento nunca deve quebrar o render */
    }
  }
  return parsed;
}

