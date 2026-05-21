import React from "react";

/**
 * Realça (via <mark>) todas as ocorrências de `term` dentro de `text`.
 * Insensível a maiúsculas/minúsculas e a acentos. Seguro contra regex injection.
 */
export function highlightMatch(text: string, term: string): React.ReactNode {
  if (!text) return text;
  const trimmed = term?.trim();
  if (!trimmed) return text;

  // Normaliza removendo acentos para casar "prog" com "Programação"
  const normalize = (s: string) =>
    s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

  const haystack = normalize(text);
  const needle = normalize(trimmed);
  if (!needle) return text;

  const parts: React.ReactNode[] = [];
  let cursor = 0;
  let idx = haystack.indexOf(needle, cursor);
  let key = 0;
  while (idx !== -1) {
    if (idx > cursor) parts.push(text.slice(cursor, idx));
    parts.push(
      <mark
        key={`hl-${key++}`}
        className="bg-primary/15 text-foreground rounded px-0.5"
      >
        {text.slice(idx, idx + needle.length)}
      </mark>
    );
    cursor = idx + needle.length;
    idx = haystack.indexOf(needle, cursor);
  }
  if (cursor < text.length) parts.push(text.slice(cursor));
  return <>{parts}</>;
}
