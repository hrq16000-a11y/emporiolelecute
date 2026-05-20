import { Check, CheckCheck } from "lucide-react";

interface WhatsAppPreviewProps {
  /** Texto da mensagem (\n é convertido em quebra de linha). */
  message: string;
  /** Nome do contato que receberia a mensagem. Default: "Empório LeleCute". */
  contactName?: string;
  /** Mostra cabeçalho estilo WhatsApp. Default: true. */
  showHeader?: boolean;
  /** Hora exibida na bolha. Default: agora (HH:MM). */
  time?: string;
  /** Direção da bolha: outgoing = cliente envia (verde, direita), incoming = você recebe (branco, esquerda). */
  direction?: "outgoing" | "incoming";
}

/**
 * Pré-visualização visual estilo WhatsApp para qualquer mensagem.
 * Usada no /admin/conversao para o admin ver exatamente como o cliente recebe.
 */
export function WhatsAppPreview({
  message,
  contactName = "Empório LeleCute",
  showHeader = true,
  time,
  direction = "outgoing",
}: WhatsAppPreviewProps) {
  const now = time ?? new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const lines = (message || "").split("\n");
  const isOut = direction === "outgoing";

  return (
    <div className="rounded-xl overflow-hidden border shadow-sm max-w-md w-full bg-[#0b141a]">
      {showHeader && (
        <div className="flex items-center gap-3 px-3 py-2 bg-[#202c33] text-white">
          <div className="h-9 w-9 rounded-full bg-[#25D366] flex items-center justify-center text-sm font-semibold">
            {contactName.slice(0, 1).toUpperCase()}
          </div>
          <div className="leading-tight">
            <div className="text-sm font-medium">{contactName}</div>
            <div className="text-[10px] text-white/60">online</div>
          </div>
        </div>
      )}
      <div
        className="px-3 py-4 min-h-[180px] bg-[#0b141a] bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2280%22 height=%2280%22><circle cx=%221%22 cy=%221%22 r=%221%22 fill=%22%23223138%22/></svg>')] bg-repeat"
      >
        <div className={`flex ${isOut ? "justify-end" : "justify-start"}`}>
          <div
            className={`max-w-[85%] rounded-lg px-3 py-2 text-[13px] leading-relaxed shadow ${
              isOut
                ? "bg-[#005c4b] text-white rounded-tr-none"
                : "bg-[#202c33] text-white rounded-tl-none"
            }`}
          >
            <div className="whitespace-pre-wrap break-words">
              {lines.map((l, i) => (
                <div key={i}>{l || "\u00A0"}</div>
              ))}
            </div>
            <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-white/70">
              <span>{now}</span>
              {isOut && <CheckCheck className="h-3 w-3 text-sky-300" />}
              {!isOut && <Check className="h-3 w-3" />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default WhatsAppPreview;
