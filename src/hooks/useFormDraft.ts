import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useDraftStore } from '@/stores/draftStore';

/**
 * Persiste o estado do formulário no store global de rascunhos,
 * usando a URL atual como chave e debounce de 1s.
 *
 * Uso típico:
 *   const { hydrate, clear, hasDraft } = useFormDraft(formData, isReady);
 *
 * - `formData`: snapshot atual do formulário (qualquer objeto serializável).
 * - `enabled`: só persiste quando o formulário já foi inicializado/hidratado
 *   (evita salvar valores vazios na montagem).
 *
 * Retorna utilitários:
 * - `hydrate<T>()`: lê o rascunho salvo (se existir) para reidratar o form.
 * - `clear()`: remove o rascunho — chame após salvamento bem-sucedido.
 * - `hasDraft()`: indica se há rascunho não salvo para a rota atual.
 */
export function useFormDraft<T>(
  formData: T,
  enabled = true,
  debounceMs = 1000,
  /** Sufixo opcional para diferenciar rascunhos numa mesma rota
   *  (ex.: dialogs de edição em listas: `editing:${id ?? 'new'}`). */
  scopeKey?: string,
) {
  const { pathname } = useLocation();
  const key = scopeKey ? `${pathname}#${scopeKey}` : pathname;
  const { setDraft, clearDraft, hasDraft, getDraft } = useDraftStore();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setDraft(key, formData);
    }, debounceMs);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [formData, enabled, key, debounceMs, setDraft]);

  return {
    hydrate: <U = T>() => getDraft<U>(key),
    clear: () => clearDraft(key),
    hasDraft: () => hasDraft(key),
  };
}
