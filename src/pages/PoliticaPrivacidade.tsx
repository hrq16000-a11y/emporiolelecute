// Página de Política de Privacidade (LGPD) + formulário de solicitação de exclusão de dados.
import { useState } from "react";
import { Helmet } from "react-helmet-async";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Shield, Eye, Cookie, Trash2, Mail } from "lucide-react";

export default function PoliticaPrivacidade() {
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [reason, setReason] = useState("");
  const [sending, setSending] = useState(false);

  async function handleDeletion(e: React.FormEvent) {
    e.preventDefault();
    if (!email && !whatsapp) {
      toast.error("Informe seu e-mail ou WhatsApp para localizarmos seus dados.");
      return;
    }
    setSending(true);
    try {
      const visitor_id = typeof window !== "undefined" ? localStorage.getItem("ll_visitor_id") : null;
      const { error } = await supabase.functions.invoke("data-deletion-request", {
        body: { email, whatsapp, reason, visitor_id },
      });
      if (error) throw error;
      toast.success("Solicitação registrada! Vamos processar em até 15 dias úteis.");
      setEmail(""); setWhatsapp(""); setReason("");
    } catch (err) {
      console.error(err);
      toast.error("Não foi possível registrar agora. Tente novamente em instantes.");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <Helmet>
        <title>Política de Privacidade | Empório Lelê Cute</title>
        <meta
          name="description"
          content="Saiba como o Empório Lelê Cute coleta, usa e protege seus dados pessoais em conformidade com a LGPD."
        />
        <link rel="canonical" href="https://emporiolelecute.com.br/politica-de-privacidade" />
      </Helmet>
      <Header />
      <main className="bg-background">
        <section className="max-w-3xl mx-auto px-4 py-12 md:py-16">
          <div className="flex items-center gap-3 mb-2">
            <Shield className="w-6 h-6 text-primary" />
            <span className="text-xs uppercase tracking-widest text-muted-foreground">LGPD</span>
          </div>
          <h1 className="font-heading text-3xl md:text-4xl text-foreground mb-3">Política de Privacidade</h1>
          <p className="text-muted-foreground mb-10">
            Última atualização: 21 de maio de 2026. Esta política descreve, de forma clara, quais dados coletamos,
            por que coletamos e como você pode exercer seus direitos garantidos pela Lei Geral de Proteção de
            Dados (Lei 13.709/2018).
          </p>

          <article className="prose prose-sm md:prose-base max-w-none text-foreground space-y-8">
            <section>
              <h2 className="flex items-center gap-2 font-heading text-xl"><Eye className="w-5 h-5 text-primary" /> Quem somos</h2>
              <p>
                O Empório Lelê Cute é uma loja artesanal de papelaria e sabonetes feitos à mão. Atendemos em todo o
                Brasil. Para dúvidas sobre privacidade, fale conosco em{" "}
                <a className="text-primary" href="mailto:emporiolelecute@gmail.com">emporiolelecute@gmail.com</a>{" "}
                ou pelo WhatsApp <a className="text-primary" href="https://wa.me/5541992214299">(41) 99221-4299</a>.
              </p>
            </section>

            <section>
              <h2 className="flex items-center gap-2 font-heading text-xl"><Cookie className="w-5 h-5 text-primary" /> O que coletamos</h2>
              <p>Coletamos apenas o necessário para operar a loja e melhorar sua experiência:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong>Cadastro / pedido:</strong> nome, e-mail, WhatsApp, CEP, cidade, estado e mensagens enviadas.</li>
                <li><strong>Navegação:</strong> páginas e produtos visitados, tempo de permanência, origem do acesso (referrer, UTMs).</li>
                <li><strong>Dispositivo:</strong> sistema operacional, navegador, marca/modelo aproximado, resolução de tela, idioma e fuso horário (derivados do User-Agent).</li>
                <li><strong>Rede:</strong> endereço IP e localização aproximada por geo-IP (país, estado, cidade), provedor de internet.</li>
                <li><strong>Localização precisa (GPS):</strong> somente se você autorizar explicitamente no navegador.</li>
                <li><strong>Cookies:</strong> identificador anônimo de visitante para unificar suas visitas, e cookies de terceiros (Google Analytics, Meta Pixel) caso você aceite no banner.</li>
              </ul>
              <p className="text-sm text-muted-foreground">
                Não coletamos IMEI, número de telefone do aparelho, lista de contatos, fotos, aplicativos instalados
                ou qualquer dado sensível (saúde, religião, biometria, etc.).
              </p>
            </section>

            <section>
              <h2 className="font-heading text-xl">Por que coletamos (finalidades)</h2>
              <ul className="list-disc pl-6 space-y-1">
                <li>Processar pedidos, calcular frete e atender você pelo WhatsApp.</li>
                <li>Entender quais produtos chamam mais atenção e melhorar a loja.</li>
                <li>Prevenir fraudes, abusos e ataques.</li>
                <li>Cumprir obrigações legais (fiscais e contábeis).</li>
                <li>Enviar comunicações sobre seu pedido e, com seu consentimento, novidades e promoções.</li>
              </ul>
            </section>

            <section>
              <h2 className="font-heading text-xl">Bases legais (LGPD art. 7º)</h2>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong>Execução de contrato</strong> — dados do pedido, endereço e contato.</li>
                <li><strong>Cumprimento de obrigação legal</strong> — emissão de notas e registros fiscais.</li>
                <li><strong>Legítimo interesse</strong> — métricas agregadas, prevenção a fraudes, segurança e melhoria do site (dados de navegação anonimizados ou pseudonimizados).</li>
                <li><strong>Consentimento</strong> — cookies de marketing/publicidade, geolocalização precisa por GPS, e envio de newsletter.</li>
              </ul>
              <p className="text-sm text-muted-foreground">
                Você pode revogar o consentimento a qualquer momento limpando os cookies do navegador ou solicitando
                a exclusão pelo formulário abaixo.
              </p>
            </section>

            <section>
              <h2 className="font-heading text-xl">Com quem compartilhamos</h2>
              <ul className="list-disc pl-6 space-y-1">
                <li>Transportadoras (Correios, Jadlog) — apenas dados de envio.</li>
                <li>Meios de pagamento (PIX, cartões via gateway) — dados financeiros mínimos.</li>
                <li>Google Analytics e Meta Pixel — métricas anônimas, somente se você aceitar cookies.</li>
                <li>Provedor de infraestrutura (Lovable Cloud / Supabase) — hospedagem segura com criptografia em trânsito e em repouso.</li>
              </ul>
              <p>Não vendemos seus dados. Não compartilhamos com terceiros para fins de marketing sem o seu consentimento.</p>
            </section>

            <section>
              <h2 className="font-heading text-xl">Por quanto tempo guardamos</h2>
              <ul className="list-disc pl-6 space-y-1">
                <li>Dados de pedidos: 5 anos (prazo fiscal).</li>
                <li>Cadastro de cliente: enquanto a conta estiver ativa ou até pedido de exclusão.</li>
                <li>Dados de navegação anônimos: até 24 meses.</li>
                <li>Logs de segurança: até 12 meses.</li>
              </ul>
            </section>

            <section>
              <h2 className="font-heading text-xl">Seus direitos</h2>
              <p>Conforme a LGPD, você pode a qualquer momento solicitar:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Confirmação de existência de tratamento;</li>
                <li>Acesso aos seus dados;</li>
                <li>Correção de dados incompletos ou desatualizados;</li>
                <li>Anonimização, bloqueio ou eliminação de dados desnecessários;</li>
                <li>Portabilidade;</li>
                <li>Revogação do consentimento;</li>
                <li>Informação sobre compartilhamento.</li>
              </ul>
            </section>

            <section id="excluir-dados" className="scroll-mt-24">
              <h2 className="flex items-center gap-2 font-heading text-xl"><Trash2 className="w-5 h-5 text-primary" /> Solicitar exclusão dos meus dados</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Preencha o formulário. Sua solicitação será processada em até 15 dias úteis. Você receberá uma
                confirmação no e-mail informado.
              </p>
              <form onSubmit={handleDeletion} className="space-y-4 bg-card border border-border rounded-xl p-5">
                <div>
                  <Label htmlFor="ddr-email">E-mail usado na loja</Label>
                  <Input id="ddr-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" maxLength={320} />
                </div>
                <div>
                  <Label htmlFor="ddr-wa">WhatsApp (opcional)</Label>
                  <Input id="ddr-wa" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="(41) 99999-9999" maxLength={40} />
                </div>
                <div>
                  <Label htmlFor="ddr-reason">Motivo (opcional)</Label>
                  <Textarea id="ddr-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={2000} rows={3}
                    placeholder="Conte brevemente o motivo da exclusão (opcional)." />
                </div>
                <Button type="submit" disabled={sending} className="w-full sm:w-auto">
                  {sending ? "Enviando…" : "Solicitar exclusão"}
                </Button>
              </form>
              <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1">
                <Mail className="w-3 h-3" /> Prefere por e-mail? Escreva para{" "}
                <a className="text-primary" href="mailto:emporiolelecute@gmail.com">emporiolelecute@gmail.com</a>.
              </p>
            </section>

            <section>
              <h2 className="font-heading text-xl">Encarregada de Dados (DPO)</h2>
              <p>
                Para dúvidas, reclamações ou exercício de direitos, fale com nossa equipe responsável pela proteção
                de dados em <a className="text-primary" href="mailto:emporiolelecute@gmail.com">emporiolelecute@gmail.com</a>.
                Você também pode reclamar diretamente à <abbr title="Autoridade Nacional de Proteção de Dados">ANPD</abbr>.
              </p>
            </section>
          </article>
        </section>
      </main>
      <Footer />
    </>
  );
}
