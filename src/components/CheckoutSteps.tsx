import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  /** Etapa inicial / fallback caso nenhuma seção esteja visível. */
  current?: 1 | 2 | 3;
  /** IDs das seções para scroll-spy (ordem: 1, 2, 3). */
  sectionIds?: [string, string, string];
  className?: string;
}

const LABELS = ["Carrinho", "Seus dados", "WhatsApp"] as const;

/**
 * Barra flutuante e compacta de etapas do checkout.
 * - Sticky abaixo do header fixo.
 * - Scroll-spy via IntersectionObserver atualiza a etapa ativa.
 * - Clique em cada etapa rola suavemente até a seção correspondente.
 */
const CheckoutSteps = ({
  current = 1,
  sectionIds,
  className,
}: Props) => {
  const [active, setActive] = useState<1 | 2 | 3>(current);

  useEffect(() => {
    if (!sectionIds) return;
    const els = sectionIds
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => !!el);
    if (els.length === 0) return;

    const visibility = new Map<string, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          visibility.set(e.target.id, e.intersectionRatio);
        });
        let bestId = sectionIds[0];
        let bestRatio = -1;
        sectionIds.forEach((id) => {
          const r = visibility.get(id) ?? 0;
          if (r > bestRatio) {
            bestRatio = r;
            bestId = id;
          }
        });
        const idx = sectionIds.indexOf(bestId);
        if (idx >= 0) setActive((idx + 1) as 1 | 2 | 3);
      },
      {
        // Considera "ativo" o que está na faixa central da tela
        rootMargin: "-30% 0px -55% 0px",
        threshold: [0, 0.25, 0.5, 0.75, 1],
      }
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [sectionIds]);

  const handleClick = (idx: number) => {
    if (!sectionIds) return;
    const el = document.getElementById(sectionIds[idx]);
    if (!el) return;
    const y = el.getBoundingClientRect().top + window.scrollY - 120;
    window.scrollTo({ top: y, behavior: "smooth" });
  };

  return (
    <ol
      className={cn(
        "flex items-center justify-between gap-1 w-full",
        className
      )}
      aria-label="Etapas do pedido"
    >
      {LABELS.map((label, idx) => {
        const step = (idx + 1) as 1 | 2 | 3;
        const isDone = step < active;
        const isCurrent = step === active;
        const Tag = sectionIds ? "button" : ("div" as const);
        return (
          <li
            key={label}
            className="flex items-center flex-1 last:flex-none min-w-0"
          >
            <Tag
              type={sectionIds ? "button" : undefined}
              onClick={sectionIds ? () => handleClick(idx) : undefined}
              aria-current={isCurrent ? "step" : undefined}
              className={cn(
                "flex items-center gap-1.5 min-w-0 rounded-full px-1.5 py-0.5 transition-colors",
                sectionIds && "hover:bg-muted/60 cursor-pointer"
              )}
            >
              <span
                className={cn(
                  "flex-shrink-0 h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-semibold border transition-colors",
                  isDone && "bg-primary text-primary-foreground border-primary",
                  isCurrent && "bg-primary/10 text-primary border-primary",
                  !isDone && !isCurrent && "bg-muted text-muted-foreground border-border"
                )}
              >
                {isDone ? <Check className="h-3 w-3" aria-hidden="true" /> : step}
              </span>
              <span
                className={cn(
                  "text-[11px] sm:text-xs truncate",
                  isCurrent ? "text-foreground font-medium" : "text-muted-foreground",
                  // Em telas muito pequenas só mostra o label da etapa ativa
                  !isCurrent && "hidden sm:inline"
                )}
              >
                {label}
              </span>
            </Tag>
            {idx < LABELS.length - 1 && (
              <div
                className={cn(
                  "flex-1 h-px mx-1 sm:mx-2 transition-colors",
                  isDone ? "bg-primary" : "bg-border"
                )}
                aria-hidden="true"
              />
            )}
          </li>
        );
      })}
    </ol>
  );
};

export default CheckoutSteps;
