/// <reference types="node" />
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import { join, resolve, dirname } from "path";
import { fileURLToPath } from "url";

/**
 * Guard estático: garante que nenhum componente renderiza
 * `itemProp="price"` (ou variantes) num elemento visual com texto formatado.
 *
 * Regra Schema.org/Google Rich Results:
 *   - `itemprop="price"` DEVE conter número puro (ex.: "4.60"), sem "R$" e sem vírgula.
 *   - Padrão SAFE adotado: visual em <span> sem itemProp; semântico em <meta itemProp="price" content={n.toFixed(2)} />.
 */

const __filename = fileURLToPath(import.meta.url);
const SRC = resolve(dirname(__filename), "..");
const EXCLUDED = new Set(["test", "integrations"]);

function walk(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (EXCLUDED.has(name)) continue;
    const full = join(dir, name);
    const s = statSync(full);
    if (s.isDirectory()) walk(full, acc);
    else if (/\.(tsx?|jsx?)$/.test(name) && !/\.test\./.test(name)) acc.push(full);
  }
  return acc;
}

describe("Schema.org microdata — guard de regressão de preço", () => {
  const files = walk(SRC);

  it("nenhum elemento NÃO-<meta> usa itemProp=\"price\"", () => {
    const offenders: Array<{ file: string; line: number; text: string }> = [];

    for (const file of files) {
      const src = readFileSync(file, "utf8");
      const lines = src.split("\n");
      lines.forEach((line, i) => {
        // captura `itemProp="price"` / `itemprop="price"` em qualquer tag
        const match = /itemProp=["']price["']/i.test(line);
        if (!match) return;
        // Permitido apenas em <meta ...>
        const isMeta = /<meta\b[^>]*itemProp=["']price["']/i.test(line);
        if (!isMeta) {
          offenders.push({ file: file.replace(SRC, "src"), line: i + 1, text: line.trim() });
        }
      });
    }

    if (offenders.length) {
      const msg = offenders
        .map((o) => `  ${o.file}:${o.line}\n    ${o.text}`)
        .join("\n");
      throw new Error(
        `itemProp="price" detectado fora de <meta>. Use <meta itemProp="price" content={n.toFixed(2)} />.\n${msg}`,
      );
    }
    expect(offenders).toEqual([]);
  });

  it("toda <meta itemProp=\"price\" content=...> usa expressão numérica (.toFixed)", () => {
    const offenders: Array<{ file: string; line: number; text: string }> = [];
    for (const file of files) {
      const src = readFileSync(file, "utf8");
      const lines = src.split("\n");
      lines.forEach((line, i) => {
        const meta = /<meta\b[^>]*itemProp=["']price["'][^>]*content=([^>]+?)\/?>/i.exec(line);
        if (!meta) return;
        const content = meta[1];
        // aceita: content={x.toFixed(2)}  | content={Number(x).toFixed(2)} | content="4.60"
        const ok =
          /\.toFixed\(\s*\d+\s*\)/.test(content) ||
          /^["']\d+(\.\d{1,2})?["']/.test(content.trim());
        if (!ok) {
          offenders.push({ file: file.replace(SRC, "src"), line: i + 1, text: line.trim() });
        }
      });
    }
    if (offenders.length) {
      const msg = offenders.map((o) => `  ${o.file}:${o.line}\n    ${o.text}`).join("\n");
      throw new Error(`<meta itemProp="price"> com content suspeito (não numérico):\n${msg}`);
    }
    expect(offenders).toEqual([]);
  });
});
