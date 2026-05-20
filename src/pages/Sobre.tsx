import Header from "@/components/Header";
import Footer from "@/components/Footer";
import WhatsAppButton from "@/components/WhatsAppButton";
import DynamicSEO from "@/components/DynamicSEO";
import BreadcrumbStructuredData from "@/components/BreadcrumbStructuredData";

const Sobre = () => {
  const breadcrumbItems = [
    { name: "Início", url: "https://emporiolelecute.com.br/" },
    { name: "Ateliê", url: "https://emporiolelecute.com.br/sobre" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <DynamicSEO
        title="Ateliê | Empório LeleCute"
        description="Empório LeleCute é um ateliê de perfumaria artesanal em Curitiba. Pequenas tiragens, montagem manual, peças pensadas para repousar onde forem vistas."
        url="https://emporiolelecute.com.br/sobre"
      />
      <BreadcrumbStructuredData items={breadcrumbItems} />

      <Header />

      <main className="pt-24 pb-24">
        {/* Abertura */}
        <section className="container mx-auto px-4 pt-12 pb-20 md:pt-20 md:pb-28">
          <div className="max-w-2xl mx-auto">
            <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground/70 mb-6">
              Ateliê
            </p>
            <h1 className="font-display text-3xl md:text-4xl font-light text-foreground leading-tight mb-8">
              Objetos pequenos,
              <br />
              presentes por muito tempo.
            </h1>
            <p className="text-base md:text-lg text-muted-foreground leading-relaxed font-light">
              Empório LeleCute nasceu da vontade de criar peças que continuam
              sendo usadas depois da ocasião. Sabonetes, sachês, velas e
              escalda-pés feitos em pequena escala, no ritmo do ateliê.
            </p>
          </div>
        </section>

        {/* Processo */}
        <section className="container mx-auto px-4 py-16 md:py-20">
          <div className="max-w-2xl mx-auto">
            <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground/70 mb-6">
              Processo
            </p>
            <h2 className="font-display text-2xl md:text-3xl font-light text-foreground mb-8">
              Bancada, fragrância, embalagem.
            </h2>
            <div className="space-y-5 text-muted-foreground leading-relaxed font-light">
              <p>
                Cada coleção começa pela escolha das fragrâncias. Algumas
                permanecem o ano inteiro; outras passam por períodos curtos,
                conforme a composição.
              </p>
              <p>
                A montagem é manual, peça a peça. As tiragens são pequenas — o
                que limita o estoque e mantém a atenção em cada unidade.
              </p>
              <p>
                A embalagem é feita na mesma bancada, no mesmo dia. Nada sai do
                ateliê antes de uma última revisão.
              </p>
            </div>
          </div>
        </section>

        {/* Quem faz */}
        <section className="container mx-auto px-4 py-16 md:py-20">
          <div className="max-w-2xl mx-auto">
            <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground/70 mb-6">
              Quem faz
            </p>
            <h2 className="font-display text-2xl md:text-3xl font-light text-foreground mb-8">
              Um ateliê em Curitiba.
            </h2>
            <p className="text-muted-foreground leading-relaxed font-light">
              A produção acontece em pequena escala, em Curitiba. O contato com
              quem encomenda é direto — geralmente pelo WhatsApp, antes mesmo
              do pedido fechar. É assim que conseguimos ajustar uma fragrância,
              um detalhe da embalagem, um prazo.
            </p>
          </div>
        </section>

        {/* Filosofia */}
        <section className="container mx-auto px-4 py-16 md:py-20">
          <div className="max-w-2xl mx-auto">
            <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground/70 mb-6">
              Como pensamos
            </p>
            <ul className="space-y-5 font-display text-xl md:text-2xl font-light text-foreground leading-snug">
              <li>Fazer pouco. Fazer bem.</li>
              <li className="text-muted-foreground">Pequena escala, atenção grande.</li>
              <li>Perfumaria artesanal para casas e encontros.</li>
              <li className="text-muted-foreground">O detalhe é o conteúdo.</li>
            </ul>
          </div>
        </section>

        {/* Encerramento */}
        <section className="container mx-auto px-4 pt-20 pb-8">
          <div className="max-w-2xl mx-auto text-center">
            <p className="font-display text-lg md:text-xl font-light text-muted-foreground italic">
              Do ateliê para a sua mesa.
            </p>
          </div>
        </section>
      </main>

      <Footer />
      <WhatsAppButton />
    </div>
  );
};

export default Sobre;
