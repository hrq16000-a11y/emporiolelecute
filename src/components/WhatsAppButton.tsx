import { MessageCircle } from "lucide-react";
import { useLocation } from "react-router-dom";
import { useContactInfo } from "@/hooks/useContactInfo";
import { markLead } from "@/lib/visitor";

interface Props {
  /** Mensagem pré-preenchida no WhatsApp. Se omitida, usa a padrão genérica. */
  message?: string;
  /** Texto curto exibido como tooltip/aria-label. */
  ariaLabel?: string;
}

const DEFAULT_MESSAGE =
  "Oi, aqui é da LeleCute. Vim do site e gostaria de conversar sobre as lembrancinhas.";

const WhatsAppButton = ({ message, ariaLabel }: Props = {}) => {
  const { pathname } = useLocation();
  const isCart = pathname === "/carrinho";
  const { buildWhatsappUrl } = useContactInfo();
  const href = buildWhatsappUrl(message || DEFAULT_MESSAGE);

  // No carrinho: dispara o mesmo fluxo do botão "Finalizar pelo WhatsApp" (valida formulário antes)
  if (isCart) {
    const handleCartClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      markLead("whatsapp_float_cart");
      const submitBtn = document.getElementById("finalize-whatsapp-btn") as HTMLButtonElement | null;
      if (submitBtn) {
        submitBtn.scrollIntoView({ behavior: "smooth", block: "center" });
        submitBtn.click();
      }
    };

    return (
      <button
        type="button"
        onClick={handleCartClick}
        className="whatsapp-float"
        aria-label={ariaLabel || "Finalizar pelo WhatsApp"}
      >
        <div className="bg-green-500 hover:bg-green-600 rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 px-5 py-3 sm:px-6 sm:py-3.5">
          <MessageCircle className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
          <span className="ml-2 text-white font-medium text-sm sm:text-base whitespace-nowrap">
            Finalizar pelo WhatsApp
          </span>
        </div>
      </button>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => markLead("whatsapp_float")}
      className="whatsapp-float"
      aria-label={ariaLabel || "Contato via WhatsApp"}
    >
      <div className="w-14 h-14 sm:w-16 sm:h-16 bg-green-500 hover:bg-green-600 rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110">
        <MessageCircle className="h-7 w-7 sm:h-8 sm:w-8 text-white" />
      </div>
    </a>
  );
};

export default WhatsAppButton;
