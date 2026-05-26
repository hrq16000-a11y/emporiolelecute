import { useEffect, useRef, useState } from "react";
import CheckoutSteps from "./CheckoutSteps";
import { cn } from "@/lib/utils";

interface Props {
  current?: 1 | 2 | 3;
  sectionIds?: [string, string, string];
}

/**
 * Wrapper da barra de etapas:
 * - Renderiza inline na posição original.
 * - Ao rolar além da sua posição, vira fixed abaixo do header.
 * - Usa um sentinel + IntersectionObserver (sem listener de scroll).
 */
const CheckoutStepsBar = ({ current = 1, sectionIds }: Props) => {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => setStuck(!entry.isIntersecting),
      { rootMargin: "0px 0px 0px 0px", threshold: 0 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <>
      {/* Sentinela: quando sai do viewport, ativamos modo fixo */}
      <div ref={sentinelRef} aria-hidden="true" className="h-px -mt-px" />

      <div
        className={cn(
          "mb-6 transition-all",
          stuck
            ? "fixed left-0 right-0 top-16 md:top-24 z-40 px-3 md:px-6 py-1.5 bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/70 border-b border-border shadow-sm"
            : "rounded-lg border border-border bg-card p-3 md:p-4"
        )}
      >
        <div className={stuck ? "container mx-auto" : ""}>
          <CheckoutSteps current={current} sectionIds={sectionIds} />
        </div>
      </div>

      {/* Espaçador equivalente quando a barra vira fixed */}
      {stuck && <div aria-hidden="true" className="h-12 md:h-14 mb-6" />}
    </>
  );
};

export default CheckoutStepsBar;
