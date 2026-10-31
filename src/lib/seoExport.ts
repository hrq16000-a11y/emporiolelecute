/**
 * Helpers de exportação de relatórios de SEO (JSON-LD, Core Web Vitals).
 * Gera download client-side em CSV ou JSON, sem dependências externas.
 */

const escapeCsv = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  const raw = typeof value === 'object' ? JSON.stringify(value) : String(value);
  return /[",\n;]/.test(raw) ? `"${raw.replace(/"/g, '""')}"` : raw;
};

export const toCsv = (rows: Array<Record<string, unknown>>): string => {
  if (!rows.length) return '';
  const headers = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  return [
    headers.join(','),
    ...rows.map((r) => headers.map((h) => escapeCsv(r[h])).join(',')),
  ].join('\n');
};

export const downloadFile = (filename: string, content: string, mime: string) => {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

const stamp = () => new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');

export const exportCsv = (name: string, rows: Array<Record<string, unknown>>) =>
  downloadFile(`${name}-${stamp()}.csv`, toCsv(rows), 'text/csv');

export const exportJson = (name: string, payload: unknown) =>
  downloadFile(`${name}-${stamp()}.json`, JSON.stringify(payload, null, 2), 'application/json');

export const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
};
