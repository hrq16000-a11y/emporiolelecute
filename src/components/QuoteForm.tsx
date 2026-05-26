import { useState } from "react";
import { Send, Heart, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { markLead } from "@/lib/visitor";

const QuoteForm = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    whatsapp: "",
    occasion: "",
    quantity: "",
    message: ""
  });
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    // Gatilho de conversão: visitante vira lead ao enviar orçamento.
    markLead("quote_form_submit");


    try {
      const { data, error } = await supabase.functions.invoke("send-order-email", {
        body: {
          ...formData,
          type: "quote"
        }
      });

      if (error) throw error;

      toast({
        title: "Orçamento enviado! 🎉",
        description: "Entraremos em contato em breve pelo WhatsApp.",
      });
      setFormData({
        name: "",
        email: "",
        whatsapp: "",
        occasion: "",
        quantity: "",
        message: ""
      });
    } catch (error) {
      console.error("Error sending quote:", error);
      toast({
        title: "Erro ao enviar",
        description: "Tente novamente ou entre em contato pelo WhatsApp.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section 
      id="orcamento" 
      className="py-20 md:py-28 bg-cream/50 relative overflow-hidden"
      aria-labelledby="orcamento-heading"
    >
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-dotted-pattern opacity-40" />
      
      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-4xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            {/* Left Column - Info */}
            <div>
              <span className="inline-flex items-center gap-2 px-4 py-2 bg-primary-light rounded-full text-primary text-sm font-medium mb-4">
                <MessageSquare className="h-4 w-4" />
                Orçamento Personalizado
              </span>
              <h2 id="orcamento-heading" className="font-display text-4xl md:text-5xl text-foreground mb-6">
                Solicite seu <span className="text-primary">Orçamento</span>
              </h2>
              <p className="text-lg text-muted-foreground mb-8">
                Preencha o formulário ao lado e receba um orçamento personalizado 
                para suas lembrancinhas. Respondemos em até 24 horas!
              </p>
              
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary-light rounded-full flex items-center justify-center">
                    <Heart className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">100% Personalizado</p>
                    <p className="text-sm text-muted-foreground">Cores, aromas e embalagens</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary-light rounded-full flex items-center justify-center">
                    <Send className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Envio Nacional</p>
                    <p className="text-sm text-muted-foreground">Para todos os estados</p>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Right Column - Form */}
            <div className="bg-card p-8 rounded-2xl shadow-medium border border-border/50">
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="text-sm font-medium text-foreground">Nome completo *</label>
                  <Input
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Seu nome"
                    className="mt-1"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-foreground">Email *</label>
                    <Input
                      required
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="seu@email.com"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground">WhatsApp *</label>
                    <Input
                      required
                      value={formData.whatsapp}
                      onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                      placeholder="(41) 99999-9999"
                      className="mt-1"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-foreground">Ocasião *</label>
                    <Select 
                      value={formData.occasion} 
                      onValueChange={(value) => setFormData({ ...formData, occasion: value })}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="maternidade">Maternidade</SelectItem>
                        <SelectItem value="cha-bebe">Chá de Bebê</SelectItem>
                        <SelectItem value="batizado">Batizado</SelectItem>
                        <SelectItem value="casamento">Casamento</SelectItem>
                        <SelectItem value="aniversario">Aniversário</SelectItem>
                        <SelectItem value="corporativo">Corporativo</SelectItem>
                        <SelectItem value="outro">Outro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground">Quantidade</label>
                    <Input
                      value={formData.quantity}
                      onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                      placeholder="Ex: 50 unidades"
                      className="mt-1"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-foreground">Mensagem</label>
                  <Textarea
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    placeholder="Descreva o que você precisa, cores preferidas, data do evento..."
                    className="mt-1 min-h-[100px]"
                  />
                </div>
                
                <Button 
                  type="submit" 
                  className="w-full bg-primary hover:bg-primary-dark text-primary-foreground rounded-full py-6 text-lg"
                  disabled={isLoading}
                >
                  {isLoading ? "Enviando..." : "Solicitar Orçamento"}
                  <Send className="h-5 w-5 ml-2" />
                </Button>
                
                <p className="text-xs text-muted-foreground text-center">
                  Ou fale direto no{" "}
                  <a 
                    href="https://wa.me/5541992214299?text=Olá! Gostaria de solicitar um orçamento."
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline font-medium"
                  >
                    WhatsApp (41) 99221-4299
                  </a>
                </p>
              </form>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default QuoteForm;
