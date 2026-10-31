import { useEffect, useRef, useState } from "react";

const FUNCTIONS_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
const RECONNECT_MS = 8000;

interface UseOrderStreamOptions {
  /** Código do pedido; quando vazio, nenhuma conexão é aberta. */
  orderCode?: string | null;
  /** Desliga o stream (ex.: pedido entregue/cancelado). */
  enabled?: boolean;
  /** Chamado quando o backend sinaliza qualquer mudança no pedido. */
  onUpdate: () => void;
}

/**
 * Conexão SSE com o status do pedido em tempo real.
 * Retorna `connected` para que a página possa reduzir/desligar o polling —
 * o polling continua ativo como fallback quando o SSE não conecta.
 */
export const useOrderStream = ({ orderCode, enabled = true, onUpdate }: UseOrderStreamOptions) => {
  const [connected, setConnected] = useState(false);
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  useEffect(() => {
    if (!orderCode || !enabled) {
      setConnected(false);
      return;
    }
    if (typeof window === "undefined" || typeof EventSource === "undefined") {
      setConnected(false);
      return;
    }

    let source: EventSource | null = null;
    let retry: number | undefined;
    let disposed = false;

    const connect = () => {
      if (disposed) return;
      const url = `${FUNCTIONS_BASE}/order-stream?code=${encodeURIComponent(orderCode)}`;
      source = new EventSource(url);

      source.addEventListener("ready", () => setConnected(true));
      source.addEventListener("status", () => {
        setConnected(true);
        onUpdateRef.current();
      });
      source.addEventListener("ping", () => setConnected(true));

      source.onerror = () => {
        setConnected(false);
        source?.close();
        source = null;
        // Reconexão com respiro; enquanto isso o polling assume.
        retry = window.setTimeout(connect, RECONNECT_MS);
      };
    };

    connect();

    return () => {
      disposed = true;
      setConnected(false);
      if (retry) window.clearTimeout(retry);
      source?.close();
    };
  }, [orderCode, enabled]);

  return { connected };
};
