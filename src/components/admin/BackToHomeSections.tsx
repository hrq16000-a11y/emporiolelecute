import { Link, useLocation } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { HOME_SECTIONS_ORIGIN } from "@/lib/homeSectionsDestinations";

/**
 * Retorno contextual para "Seções da Home".
 *
 * Renderizado uma única vez no AdminLayout, acima do conteúdo das rotas.
 * Aparece apenas quando a navegação veio de /admin/secoes-home, sinalizada
 * pelo query param `?from=home-sections`. Sem origem relacionada, nada é
 * renderizado — o acesso direto às telas permanece inalterado.
 */
const BackToHomeSections = () => {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const fromHomeSections = params.get("from") === HOME_SECTIONS_ORIGIN;

  if (!fromHomeSections) return null;

  return (
    <div className="px-4 md:px-8 pt-4 md:pt-6">
      <Link
        to="/admin/secoes-home"
        className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors rounded-lg border border-border/60 bg-card/60 px-3 py-1.5 hover:bg-muted/60"
      >
        <ArrowLeft className="w-4 h-4" />
        Seções da Home
      </Link>
    </div>
  );
};

export default BackToHomeSections;
