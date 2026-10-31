import { ReactNode, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useIsFetching } from "@tanstack/react-query";

/**
 * Barra de progresso global — reflete navegação SPA e fetches em andamento.
 * Puramente visual, respeita `prefers-reduced-motion` via `.motion-reduced`.
 */
export const GlobalProgressBar = () => {
  const isFetching = useIsFetching();
  const { pathname } = useLocation();
  const [visible, setVisible] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setVisible(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setVisible(false), 600);
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [pathname]);

  const active = visible || isFetching > 0;

  return (
    <div
      aria-hidden
      className={`fixed inset-x-0 top-0 z-[100] h-0.5 pointer-events-none transition-opacity duration-300 ${
        active ? "opacity-100" : "opacity-0"
      }`}
    >
      <div className="h-full w-full origin-left bg-primary/70 route-progress-bar" />
    </div>
  );
};

/**
 * Transição suave de entrada a cada mudança de rota.
 * Usa `key` no pathname para reiniciar a animação, sem desmontar providers.
 */
const RouteTransition = ({ children }: { children: ReactNode }) => {
  const { pathname } = useLocation();
  return (
    <div key={pathname} className="route-transition">
      {children}
    </div>
  );
};

export default RouteTransition;
