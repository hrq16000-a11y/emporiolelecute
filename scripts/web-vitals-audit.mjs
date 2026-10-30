#!/usr/bin/env node
/**
 * Auditoria de Web Vitals (LCP / CLS / TBT) nas páginas-chave.
 *
 * Uso:
 *   node scripts/web-vitals-audit.mjs --base http://localhost:8080 --label antes
 *   node scripts/web-vitals-audit.mjs --base http://localhost:8080 --label depois
 *
 * Salva um JSON por execução em reports/web-vitals/<label>.json e imprime
 * um comparativo "antes x depois" quando ambos existem.
 * Requer Chrome/Chromium disponível (usa `npx lighthouse`).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const getArg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};

const base = getArg('base', 'http://localhost:8080').replace(/\/$/, '');
const label = getArg('label', 'depois');

const PAGES = [
  { name: 'home', path: '/' },
  { name: 'catalogo', path: '/produtos' },
  { name: 'busca', path: '/buscar?q=lembrancinha' },
  { name: 'favoritos', path: '/favoritos' },
];

const OUT_DIR = join(process.cwd(), 'reports', 'web-vitals');
mkdirSync(OUT_DIR, { recursive: true });

const runLighthouse = (url) => {
  const tmp = join(OUT_DIR, '.tmp.json');
  execFileSync(
    'npx',
    [
      '--yes',
      'lighthouse',
      url,
      '--quiet',
      '--only-categories=performance',
      '--preset=desktop',
      '--output=json',
      `--output-path=${tmp}`,
      '--chrome-flags=--headless=new --no-sandbox',
    ],
    { stdio: 'inherit' },
  );
  const report = JSON.parse(readFileSync(tmp, 'utf8'));
  const audit = (id) => report.audits?.[id]?.numericValue ?? null;
  return {
    score: Math.round((report.categories?.performance?.score ?? 0) * 100),
    lcp: audit('largest-contentful-paint'),
    cls: audit('cumulative-layout-shift'),
    tbt: audit('total-blocking-time'),
    fcp: audit('first-contentful-paint'),
  };
};

const results = {};
for (const page of PAGES) {
  const url = `${base}${page.path}`;
  process.stdout.write(`\n▶ Auditando ${url}\n`);
  try {
    results[page.name] = runLighthouse(url);
  } catch (error) {
    results[page.name] = { error: String(error?.message ?? error) };
  }
}

const snapshot = { label, base, generatedAt: new Date().toISOString(), results };
const outFile = join(OUT_DIR, `${label}.json`);
writeFileSync(outFile, JSON.stringify(snapshot, null, 2));
console.log(`\n✔ Relatório salvo em ${outFile}`);

const otherLabel = label === 'antes' ? 'depois' : 'antes';
const otherFile = join(OUT_DIR, `${otherLabel}.json`);
if (existsSync(otherFile)) {
  const other = JSON.parse(readFileSync(otherFile, 'utf8'));
  const before = label === 'antes' ? snapshot : other;
  const after = label === 'antes' ? other : snapshot;
  console.log('\n=== Comparativo antes → depois ===');
  for (const page of PAGES) {
    const b = before.results[page.name] ?? {};
    const a = after.results[page.name] ?? {};
    const fmt = (v, unit = 'ms') => (v == null ? '—' : `${Math.round(v)}${unit}`);
    console.log(
      `${page.name.padEnd(12)} score ${b.score ?? '—'} → ${a.score ?? '—'} | ` +
        `LCP ${fmt(b.lcp)} → ${fmt(a.lcp)} | ` +
        `CLS ${b.cls?.toFixed?.(3) ?? '—'} → ${a.cls?.toFixed?.(3) ?? '—'} | ` +
        `TBT ${fmt(b.tbt)} → ${fmt(a.tbt)}`,
    );
  }
}
