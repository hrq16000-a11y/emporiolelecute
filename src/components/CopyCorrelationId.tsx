import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CopyCorrelationIdProps {
  correlationId: string;
  className?: string;
}

/**
 * Exibe o ID de correlação de um erro com botão de cópia (suporte rápido).
 * Acessível (aria-live no feedback) e com transição suave que respeita
 * reduced-motion via utilitários globais.
 */
const CopyCorrelationId = ({ correlationId, className = "" }: CopyCorrelationIdProps) => {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(id);
  }, [copied]);

  const handleCopy = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(correlationId);
      } else {
        const el = document.createElement("textarea");
        el.value = correlationId;
        el.setAttribute("readonly", "");
        el.style.position = "fixed";
        el.style.opacity = "0";
        document.body.appendChild(el);
        el.select();
        document.execCommand("copy");
        document.body.removeChild(el);
      }
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className={`flex items-center justify-center gap-1 ${className}`}>
      <span className="text-[11px] text-muted-foreground">
        Código de suporte: <span className="font-mono">{correlationId}</span>
      </span>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 px-2"
        onClick={handleCopy}
        aria-label={`Copiar código de suporte ${correlationId}`}
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-green-600" aria-hidden="true" />
        ) : (
          <Copy className="h-3.5 w-3.5" aria-hidden="true" />
        )}
      </Button>
      <span className="sr-only" role="status" aria-live="polite">
        {copied ? "Código copiado" : ""}
      </span>
    </div>
  );
};

export default CopyCorrelationId;
