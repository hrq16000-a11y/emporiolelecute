/**
 * Formatação consistente de valores monetários em pt-BR.
 * Centraliza o padrão `R$ X,YZ` antes espalhado por ~30 arquivos.
 *
 * Uso novo deve sempre passar por aqui. Substituições nos arquivos legados
 * são opcionais e devem ser feitas em PRs isolados, nunca em massa.
 */

const brlFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Retorna `R$ 1.234,56`. Para valores nulos/undefined/NaN retorna `R$ 0,00`. */
export function formatBRL(value: number | null | undefined): string {
  const n = typeof value === "number" && Number.isFinite(value) ? value : 0;
  // Intl usa NBSP entre "R$" e o número; normalizamos para espaço comum
  // para manter visual idêntico ao padrão antigo (toFixed + replace).
  return brlFormatter.format(n).replace(/\u00A0/g, " ");
}
