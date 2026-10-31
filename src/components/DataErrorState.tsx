import { useMemo } from "react";
import { AlertTriangle, RefreshCw, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { reportError, type ErrorScope } from "@/lib/errorReporting";
import CopyCorrelationId from "@/components/CopyCorrelationId";

interface DataErrorStateProps {
  scope: ErrorScope;
  error: unknown;
  onRetry?: () => void;
  isRetrying?: boolean;
  /** Indica que há dados em cache sendo exibidos apesar da falha. */
  hasCachedData?: boolean;
}

/**
 * Estado de erro consistente e rastreável (correlation ID) para catálogo,
 * PDP, carrinho e checkout. Foca a si mesmo para leitores de tela e respeita
 * reduced-motion (animações vêm de utilitários globais).
 */
const DataErrorState = ({
  scope,
  error,
  onRetry,
  isRetrying = false,
  hasCachedData = false,
}: DataErrorStateProps) => {
  // Gera o ID uma única vez por instância de erro.
  const reported = useMemo(() => reportError(scope, error), [scope, error]);
  const Icon = reported.retryable ? WifiOff : AlertTriangle;

  return (
    <div
      role="alert"
      aria-live="polite"
      tabIndex={-1}
      className="mx-auto max-w-md rounded-2xl border border-border bg-card p-6 text-center animate-fade-in outline-none"
    >
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <Icon className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
      </div>
      <h2 className="font-display text-lg text-foreground">{reported.title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{reported.description}</p>
      <CopyCorrelationId correlationId={reported.correlationId} className="mt-3" />
      {hasCachedData && (
        <p className="mt-2 text-xs text-muted-foreground">
          Exibindo a última versão salva no seu dispositivo.
        </p>
      )}
      {onRetry && (
        <Button
          variant="outline"
          size="sm"
          className="mt-4 min-h-[44px]"
          onClick={onRetry}
          disabled={isRetrying}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${isRetrying ? "animate-spin" : ""}`} aria-hidden="true" />
          {isRetrying ? "Tentando..." : "Tentar novamente"}
        </Button>
      )}
    </div>
  );
};

export default DataErrorState;
