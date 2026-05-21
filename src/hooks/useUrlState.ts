// Hook para persistir estado na URL via search params. Suporta valores string e number.
// Mantém estado entre navegações de menu, reload e back/forward do navegador.
import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";

type Value = string | number | null;

export function useUrlState<T extends Record<string, Value>>(
  defaults: T,
): [T, (patch: Partial<T>) => void] {
  const [params, setParams] = useSearchParams();

  const state = {} as T;
  for (const k in defaults) {
    const raw = params.get(k);
    if (raw == null) {
      state[k] = defaults[k];
    } else if (typeof defaults[k] === "number") {
      const n = Number(raw);
      state[k] = (Number.isFinite(n) ? n : defaults[k]) as T[typeof k];
    } else {
      state[k] = raw as T[typeof k];
    }
  }

  const update = useCallback((patch: Partial<T>) => {
    const next = new URLSearchParams(params);
    for (const k in patch) {
      const v = patch[k];
      if (v == null || v === "" || v === defaults[k]) {
        next.delete(k);
      } else {
        next.set(k, String(v));
      }
    }
    setParams(next, { replace: true });
  }, [params, setParams, defaults]);

  return [state, update];
}
