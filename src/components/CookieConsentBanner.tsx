// Banner de consentimento de cookies/tracking (LGPD).
// Bloqueia rastreamento até o usuário aceitar ou recusar explicitamente.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Cookie, X } from "lucide-react";
import { getConsentStatus, recordConsent } from "@/hooks/useVisitorTracking";

export default function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Não mostra na área admin
    if (window.location.pathname.startsWith("/admin")) return;
    const status = getConsentStatus();
    if (status === "pending") {
      // pequeno delay para não atrapalhar LCP
      const t = setTimeout(() => setVisible(true), 1500);
      return () => clearTimeout(t);
    }
  }, []);

  if (!visible) return null;

  const handle = (accepted: boolean) => {
    recordConsent(accepted);
    setVisible(false);
  };

  return (
    <div
      role="dialog"
      aria-label="Consentimento de cookies"
      className="fixed bottom-0 inset-x-0 z-[100] p-3 sm:p-4 pointer-events-none"
    >
      <div className="mx-auto max-w-3xl bg-card border border-border shadow-2xl rounded-xl p-4 sm:p-5 pointer-events-auto flex flex-col sm:flex-row gap-4 items-start">
        <div className="hidden sm:flex shrink-0 w-10 h-10 rounded-full bg-primary/10 items-center justify-center">
          <Cookie className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 text-sm text-foreground">
          <p className="font-semibold mb-1">Sua privacidade importa 🍪</p>
          <p className="text-muted-foreground leading-relaxed">
            Usamos cookies e tecnologias similares para entender como você navega,
            melhorar sua experiência e mostrar produtos relevantes. Você pode aceitar
            ou recusar a qualquer momento. Saiba mais em nossa{" "}
            <Link to="/politica-de-privacidade" className="text-primary hover:underline">
              Política de Privacidade
            </Link>.
          </p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto shrink-0">
          <Button variant="outline" size="sm" onClick={() => handle(false)} className="flex-1 sm:flex-none">
            Recusar
          </Button>
          <Button size="sm" onClick={() => handle(true)} className="flex-1 sm:flex-none">
            Aceitar
          </Button>
          <button
            aria-label="Fechar (recusar)"
            onClick={() => handle(false)}
            className="hidden sm:flex items-center justify-center w-9 h-9 rounded-md hover:bg-muted text-muted-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
