import { MessageCircle } from "lucide-react";
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
  const { buildWhatsappUrl } = useContactInfo();
  const href = buildWhatsappUrl(message || DEFAULT_MESSAGE);
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="whatsapp-float"
      aria-label={ariaLabel || "Contato via WhatsApp"}
    >
      <div className="w-14 h-14 sm:w-16 sm:h-16 bg-green-500 hover:bg-green-600 rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110">
        <MessageCircle className="h-7 w-7 sm:h-8 sm:w-8 text-white" />
      </div>
      <span className="absolute -top-2 -right-2 w-5 h-5 bg-primary rounded-full flex items-center justify-center text-xs text-primary-foreground font-bold animate-pulse">1</span>
    </a>
  );
};

export default WhatsAppButton;
