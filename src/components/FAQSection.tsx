import { MessageCircle } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { useFaqs } from "@/hooks/useFaqs";
import { Skeleton } from "@/components/ui/skeleton";
import FAQStructuredData from "@/components/FAQStructuredData";
import { useContactInfo } from "@/hooks/useContactInfo";
import { usePaymentConfig } from "@/hooks/useStoreSettings";

const FAQSection = () => {
  const { data: faqs, isLoading } = useFaqs();
  const { buildWhatsappUrl } = useContactInfo();
  const { data: paymentConfig } = usePaymentConfig();
  const pixDiscount = paymentConfig?.pix_discount ?? 5;
  const installments = paymentConfig?.installments ?? 3;
  const interpolate = (text: string) =>
    text
      .replace(/\{pix_discount\}/g, String(pixDiscount))
      .replace(/\{installments\}/g, String(installments))
      .replace(/\(com \d+% de desconto\)/gi, `(com ${pixDiscount}% de desconto)`)
      .replace(/PIX com \d+% de desconto/gi, `PIX com ${pixDiscount}% de desconto`);

  // Fallback FAQs if database is empty
  const defaultFaqs = [
    {
      id: '1',
      question: "Qual é o prazo de produção das lembrancinhas?",
      answer: "O prazo de produção varia de acordo com o produto e quantidade. Em média, leva de 7 a 15 dias úteis após a confirmação do pagamento. Para pedidos urgentes, consulte disponibilidade via WhatsApp."
    },
    {
      id: '2',
      question: "Vocês enviam para todo o Brasil?",
      answer: "Sim! Realizamos entregas para todos os estados do Brasil via Correios ou transportadoras. O frete é calculado conforme o CEP de destino, peso e dimensões do pedido."
    },
    {
      id: '3',
      question: "Posso personalizar as cores e fragrâncias?",
      answer: "Com certeza! Todas as nossas lembrancinhas são 100% personalizáveis. Você pode escolher cores, aromas, embalagens e adicionar nomes, datas e mensagens especiais."
    },
    {
      id: '4',
      question: "Quais são as formas de pagamento aceitas?",
      answer: `Aceitamos PIX (com ${pixDiscount}% de desconto), cartão de crédito (parcelamento em até ${installments}x sem juros), boleto bancário e Mercado Pago.`
    },
    {
      id: '5',
      question: "Qual é a quantidade mínima de pedido?",
      answer: "A quantidade mínima varia por produto e está informada na descrição de cada um. Consulte cada produto ou fale conosco para mais informações."
    },
    {
      id: '6',
      question: "Como funciona o processo de encomenda?",
      answer: "É simples: 1) Escolha o modelo que deseja encomendar, 2) Defina a quantidade e adicione ao carrinho, 3) No carrinho, preencha seus dados e clique em 'Finalizar no WhatsApp', 4) Você será direcionado ao WhatsApp para cálculo de frete e pagamento do pedido."
    }
  ];

  // Filter only visible FAQs from database
  const visibleFaqs = faqs?.filter(faq => faq.is_visible !== false) || [];
  const displayFaqs = (visibleFaqs.length > 0 ? visibleFaqs : defaultFaqs).map((f) => ({
    ...f,
    answer: interpolate(f.answer),
  }));

  return (
    <>
      {/* Schema.org FAQPage Structured Data for SEO */}
      <FAQStructuredData faqs={displayFaqs} />
      
      <section
        id="faq"
        className="py-2 bg-background relative overflow-hidden"
        aria-labelledby="faq-heading"
      >
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-hearts-pattern opacity-5" />

      <div className="layout-conversational relative z-10">
        <div className="max-w-4xl mx-auto">
          {/* Section Header */}
          <div className="text-center mb-2">
            <h2 id="faq-heading" className="font-display text-sm md:text-base text-foreground mb-1">
              Perguntas <span className="font-script text-primary italic text-xs md:text-sm">Frequentes</span>
            </h2>
            <p className="text-muted-foreground text-[10px] md:text-xs max-w-2xl mx-auto leading-tight">
              Tire suas dúvidas sobre prazos, personalização, formas de pagamento e muito mais.
            </p>
          </div>

          {/* FAQ Accordion */}
          {isLoading ? (
            <div className="space-y-1">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-6 rounded-lg" />
              ))}
            </div>
          ) : (
            <Accordion type="single" collapsible className="space-y-0.5">
              {displayFaqs.map((faq, index) => (
                <AccordionItem
                  key={faq.id || index}
                  value={`item-${faq.id || index}`}
                  className="bg-card border border-border rounded-lg px-2 py-0.5 shadow-sm overflow-hidden data-[state=open]:border-primary/30 data-[state=open]:py-2"
                >
                  <AccordionTrigger className="hover:no-underline py-1 text-left">
                    <span className="font-medium text-foreground text-[11px] md:text-xs pr-2 leading-tight">
                      {faq.question}
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="pb-1 text-muted-foreground text-[11px] md:text-xs leading-snug whitespace-pre-line">
                    {interpolate(faq.answer)}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}

          {/* CTA */}
          <div className="text-center mt-2 bg-primary-light/50 rounded-lg p-2 border border-primary/20">
            <p className="text-foreground font-medium text-[10px] md:text-xs mb-1">
              Não encontrou sua dúvida? Fale conosco!
            </p>
            <a
              href={buildWhatsappUrl('Olá! Tenho uma dúvida sobre as lembrancinhas.')}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button
                size="sm"
                className="bg-green-500 hover:bg-green-600 text-white rounded-full px-3 py-1 text-[10px] md:text-xs h-6"
              >
                <MessageCircle className="h-3 w-3 mr-1" />
                WhatsApp
              </Button>
            </a>
          </div>
        </div>
      </div>
      </section>
    </>
  );
};

export default FAQSection;
