import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Check, CloudUpload, FileEdit } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDraftStore } from "@/stores/draftStore";

/**
 * Indicador visual do estado do rascunho do formulário atual.
 *
 * - Sem rascunho → "Salvo" (verde)
 * - Rascunho local recente (<2s) → "Salvando..." (âmbar pulsando)
 * - Rascunho local persistido → "Rascunho • há Xmin" (âmbar)
 *
 * Reage automaticamente ao pathname (uma instância por rota).
 */
type Props = { className?: string; scopeKey?: string };

function formatAge(ms: number): string {
  if (ms < 5_000) return "agora";
  if (ms < 60_000) return `há ${Math.round(ms / 1000)}s`;
  if (ms < 3_600_000) return `há ${Math.round(ms / 60_000)}min`;
  return `há ${Math.round(ms / 3_600_000)}h`;
}

export default function DraftStatusBadge({ className, scopeKey }: Props) {
  const { pathname } = useLocation();
  const key = scopeKey ? `${pathname}#${scopeKey}` : pathname;
  const updatedAt = useDraftStore((s) => s.drafts[key]?.updatedAt);
  const [, setTick] = useState(0);

  // Atualiza o "há Xs/min" a cada 15s
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 15_000);
    return () => clearInterval(t);
  }, []);

  if (!updatedAt) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full bg-success-light/60 text-success-dark px-2.5 py-1 text-[11px] font-medium",
          className,
        )}
        title="Sem alterações pendentes"
      >
        <Check className="w-3 h-3" />
        Salvo
      </span>
    );
  }

  const age = Date.now() - updatedAt;
  const isFresh = age < 2_000;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium",
        isFresh
          ? "bg-amber-100 text-amber-800 animate-pulse"
          : "bg-amber-50 text-amber-700 border border-amber-200",
        className,
      )}
      title={`Rascunho local em ${pathname}`}
    >
      {isFresh ? <CloudUpload className="w-3 h-3" /> : <FileEdit className="w-3 h-3" />}
      {isFresh ? "Salvando rascunho..." : `Rascunho • ${formatAge(age)}`}
    </span>
  );
}
