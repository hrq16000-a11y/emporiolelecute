import { useState, useEffect } from "react";
import { Search, Package, Truck, CheckCircle, Clock, MapPin, User, Phone, Mail, ArrowLeft, Loader2, ShoppingBag } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import WhatsAppButton from "@/components/WhatsAppButton";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useOrderStream } from "@/hooks/useOrderStream";
import DynamicSEO from "@/components/DynamicSEO";
import BreadcrumbStructuredData from "@/components/BreadcrumbStructuredData";
import { optimizeImage } from "@/lib/image";
import OrderTrackingSkeleton from "@/components/OrderTrackingSkeleton";
import { RefreshCw, Receipt, RotateCcw } from "lucide-react";
import { useContactInfo } from "@/hooks/useContactInfo";

interface OrderItem {
  id: string;
  product_name: string;
  product_slug: string | null;
  product_image: string | null;
  quantity: number;
  unit_price: number;
  personalization: string | null;
}

interface Order {
  id: string;
  order_code: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  address_cep: string;
  address_street: string;
  address_number: string;
  address_complement: string | null;
  address_neighborhood: string | null;
  address_city: string;
  address_state: string;
  shipping_method: string;
  shipping_company: string | null;
  shipping_days: string | null;
  shipping_price: number;
  subtotal: number;
  total: number;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  tracking_code?: string | null;
  tracking_carrier?: string | null;
  tracking_url?: string | null;
  shipped_at?: string | null;
  payment_status?: string | null;
}

const statusConfig: Record<string, { label: string; color: string; icon: typeof Clock; description: string }> = {
  pending: {
    label: "Aguardando Confirmação",
    color: "bg-amber-500",
    icon: Clock,
    description: "Seu pedido foi recebido e está aguardando confirmação do pagamento."
  },
  confirmed: {
    label: "Confirmado",
    color: "bg-blue-500",
    icon: CheckCircle,
    description: "Pagamento confirmado! Iniciando a produção do seu pedido."
  },
  production: {
    label: "Em Produção",
    color: "bg-purple-500",
    icon: Package,
    description: "Seu pedido está sendo produzido com muito carinho."
  },
  shipped: {
    label: "Enviado",
    color: "bg-green-500",
    icon: Truck,
    description: "Seu pedido foi despachado e está a caminho!"
  },
  delivered: {
    label: "Entregue",
    color: "bg-green-600",
    icon: CheckCircle,
    description: "Pedido entregue com sucesso! Obrigado pela preferência."
  },
  cancelled: {
    label: "Cancelado",
    color: "bg-red-500",
    icon: Clock,
    description: "Este pedido foi cancelado."
  }
};

const paymentLabel: Record<string, string> = {
  pending: "Aguardando pagamento",
  approved: "Pago / Aprovado",
  refunded: "Reembolsado",
  cancelled: "Cancelado",
};

const RastrearPedido = () => {
  const { buildWhatsappUrl } = useContactInfo();
  const [searchParams] = useSearchParams();
  const initialCode = searchParams.get('code') || '';
  
  const [orderCode, setOrderCode] = useState(initialCode);
  const [order, setOrder] = useState<Order | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [searched, setSearched] = useState(false);
  const { toast } = useToast();

  const breadcrumbItems = [
    { name: 'Início', url: 'https://emporiolelecute.com.br/' },
    { name: 'Rastrear Pedido', url: 'https://emporiolelecute.com.br/rastrear' },
  ];

  const handleSearch = async (codeToSearch?: string, opts?: { silent?: boolean }) => {
    const code = codeToSearch || orderCode;
    const silent = !!opts?.silent;

    if (!code.trim()) {
      toast({
        title: "Digite o código do pedido",
        variant: "destructive",
      });
      return;
    }

    if (silent) setIsSyncing(true);
    else {
      setIsLoading(true);
      setSearched(true);
    }

    try {
      // Use secure edge function for order tracking
      const { data, error } = await supabase.functions.invoke('track-order', {
        body: { orderCode: code.trim() }
      });

      if (error) {
        console.error("Error tracking order:", error);
        if (!silent) {
          toast({
            title: "Erro ao buscar pedido",
            description: "Tente novamente mais tarde.",
            variant: "destructive",
          });
          setOrder(null);
          setOrderItems([]);
        }
        return;
      }

      if (!data?.order) {
        if (!silent) {
          setOrder(null);
          setOrderItems([]);
          toast({
            title: "Pedido não encontrado",
            description: "Verifique o código e tente novamente.",
            variant: "destructive",
          });
        }
        return;
      }

      setOrder((prev) => {
        if (silent && prev && prev.status !== data.order.status) {
          toast({
            title: "Status atualizado",
            description: statusConfig[data.order.status]?.label || data.order.status,
          });
        }
        return data.order;
      });
      setOrderItems(data.items || []);
      setLastSync(new Date());
    } catch (error) {
      console.error("Error fetching order:", error);
      if (!silent) {
        toast({
          title: "Erro ao buscar pedido",
          description: "Tente novamente mais tarde.",
          variant: "destructive",
        });
        setOrder(null);
        setOrderItems([]);
      }
    } finally {
      if (silent) setIsSyncing(false);
      else setIsLoading(false);
    }
  };

  // Auto-search if code is in URL
  useEffect(() => {
    if (initialCode) {
      handleSearch(initialCode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isFinalStatus = !!order && ["delivered", "cancelled"].includes(order.status);

  // Tempo real via SSE (fallback automático para polling quando não conecta)
  const { connected: liveConnected } = useOrderStream({
    orderCode: order?.order_code,
    enabled: !!order && !isFinalStatus,
    onUpdate: () => {
      if (order?.order_code) handleSearch(order.order_code, { silent: true });
    },
  });

  // Sincronização periódica do status enquanto o pedido não estiver finalizado
  useEffect(() => {
    if (!order) return;
    if (["delivered", "cancelled"].includes(order.status)) return;
    const code = order.order_code;
    const sync = () => {
      if (document.visibilityState === "visible" && navigator.onLine !== false) {
        handleSearch(code, { silent: true });
      }
    };
    // SSE ativo → polling só como rede de segurança (2 min). Sem SSE → 15s.
    const id = setInterval(sync, liveConnected ? 120000 : 15000);
    window.addEventListener("focus", sync);
    window.addEventListener("online", sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", sync);
      window.removeEventListener("online", sync);
      document.removeEventListener("visibilitychange", sync);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?.order_code, order?.status, liveConnected]);



  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const status = order ? statusConfig[order.status] || statusConfig.pending : null;
  const StatusIcon = status?.icon || Clock;

  return (
    <div className="min-h-screen bg-background">
      <DynamicSEO
        title="Rastrear Pedido | Empório LeleCute"
        description="Acompanhe o status do seu pedido de lembrancinhas artesanais. Digite o código do pedido para rastrear."
        url="https://emporiolelecute.com.br/rastrear"
      />
      <BreadcrumbStructuredData items={breadcrumbItems} />
      <Header />
      
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4">
          {/* Back Link */}
          <Link 
            to="/" 
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary mb-8 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar ao início
          </Link>

          <div className="max-w-3xl mx-auto">
            {/* Header */}
            <div className="text-center mb-8">
              <h1 className="font-display text-3xl md:text-4xl text-foreground mb-4">
                Rastrear Pedido
              </h1>
              <p className="text-muted-foreground">
                Digite o código do pedido para acompanhar o status da sua compra
              </p>
            </div>

            {/* Search Box */}
            <div className="bg-card rounded-xl border border-border p-6 mb-8">
              <div className="flex gap-3">
                <Input
                  placeholder="Digite o código (ex: LCAB12CD)"
                  value={orderCode}
                  onChange={(e) => setOrderCode(e.target.value.toUpperCase())}
                  className="flex-1 text-lg font-mono uppercase"
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
                <Button 
                  onClick={() => handleSearch()}
                  disabled={isLoading}
                  className="bg-primary hover:bg-primary-dark"
                >
                  {isLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      <Search className="h-5 w-5 mr-2" />
                      Buscar
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Loading skeleton */}
            {isLoading && <OrderTrackingSkeleton />}

            {/* No Order Found */}

            {searched && !order && !isLoading && (
              <div className="bg-card rounded-xl border border-border p-8 text-center">
                <ShoppingBag className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
                <h2 className="text-xl font-semibold text-foreground mb-2">
                  Pedido não encontrado
                </h2>
                <p className="text-muted-foreground mb-4">
                  Verifique se o código foi digitado corretamente e tente novamente.
                </p>
                <Link to="/produtos">
                  <Button variant="outline">Ver Produtos</Button>
                </Link>
              </div>
            )}

            {/* Order Details */}
            {order && !isLoading && (
              <div className="space-y-6 animate-fade-in">
                {/* Status Card */}
                <div className="bg-card rounded-xl border border-border overflow-hidden">
                  <div className={`${status?.color} p-6 text-white`}>
                    <div className="flex items-center gap-4">
                      <div className="bg-white/20 rounded-full p-3">
                        <StatusIcon className="h-8 w-8" />
                      </div>
                      <div>
                        <p className="text-sm opacity-90">Status do Pedido</p>
                        <h2 className="text-2xl font-bold">{status?.label}</h2>
                      </div>
                    </div>
                  </div>
                  <div className="p-6">
                    <p className="text-muted-foreground">{status?.description}</p>
                    <div className="mt-4 flex flex-wrap gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Código:</span>{" "}
                        <span className="font-mono font-bold text-primary">{order.order_code}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Data:</span>{" "}
                        <span className="font-medium">{formatDate(order.created_at)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Sync + pagamento / reembolso / nota */}
                <div className="bg-card rounded-xl border border-border p-4 md:p-6 space-y-4 animate-fade-in">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="text-sm">
                      <span className="text-muted-foreground">Pagamento:</span>{" "}
                      <span className="font-medium text-foreground">
                        {paymentLabel[order.payment_status || "pending"] || "Aguardando"}
                      </span>
                      {lastSync && (
                        <span className="block text-xs text-muted-foreground mt-1">
                          Atualizado às {lastSync.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSearch(order.order_code, { silent: true })}
                      disabled={isSyncing}
                    >
                      <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? "animate-spin" : ""}`} />
                      {isSyncing ? "Atualizando..." : "Atualizar status"}
                    </Button>
                  </div>

                  {(order.payment_status === "approved" || order.payment_status === "refunded") && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      <a
                        href={buildWhatsappUrl(`Olá! Preciso da nota fiscal do pedido ${order.order_code}.`)}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Button variant="secondary" size="sm">
                          <Receipt className="h-4 w-4 mr-2" />
                          Solicitar nota fiscal
                        </Button>
                      </a>
                      {order.payment_status === "approved" && (
                        <a
                          href={buildWhatsappUrl(`Olá! Gostaria de solicitar reembolso do pedido ${order.order_code}.`)}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Button variant="outline" size="sm">
                            <RotateCcw className="h-4 w-4 mr-2" />
                            Solicitar reembolso
                          </Button>
                        </a>
                      )}
                    </div>
                  )}
                </div>



                {/* Order Timeline */}
                <div className="bg-card rounded-xl border border-border p-6">
                  <h3 className="font-semibold text-foreground mb-4">Progresso do Pedido</h3>
                  <div className="flex items-center justify-between relative">
                    {["pending", "confirmed", "production", "shipped", "delivered"].map((step, index) => {
                      const stepConfig = statusConfig[step];
                      const StepIcon = stepConfig.icon;
                      const isCompleted = ["pending", "confirmed", "production", "shipped", "delivered"].indexOf(order.status) >= index;
                      const isCurrent = order.status === step;
                      
                      return (
                        <div key={step} className="flex flex-col items-center relative z-10">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            isCompleted ? stepConfig.color : 'bg-muted'
                          } ${isCurrent ? 'ring-4 ring-primary/30' : ''}`}>
                            <StepIcon className={`h-5 w-5 ${isCompleted ? 'text-white' : 'text-muted-foreground'}`} />
                          </div>
                          <span className={`text-xs mt-2 text-center max-w-16 ${isCurrent ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
                            {stepConfig.label.split(' ')[0]}
                          </span>
                        </div>
                      );
                    })}
                    {/* Progress line */}
                    <div className="absolute top-5 left-5 right-5 h-0.5 bg-muted -z-0">
                      <div 
                        className="h-full bg-primary transition-all" 
                        style={{ 
                          width: `${Math.max(0, ["pending", "confirmed", "production", "shipped", "delivered"].indexOf(order.status)) * 25}%` 
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Tracking info */}
                {(order.tracking_code || order.tracking_carrier || order.tracking_url || order.shipped_at) && (
                  <div className="bg-card rounded-xl border-2 border-primary/40 p-6">
                    <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                      <Truck className="h-5 w-5 text-primary" />
                      Rastreamento da Entrega
                    </h3>
                    <div className="grid sm:grid-cols-2 gap-4 text-sm">
                      {order.tracking_code && (
                        <div>
                          <p className="text-xs text-muted-foreground uppercase">Código de rastreio</p>
                          <p className="font-mono font-bold text-primary text-base break-all">{order.tracking_code}</p>
                        </div>
                      )}
                      {order.tracking_carrier && (
                        <div>
                          <p className="text-xs text-muted-foreground uppercase">Transportadora</p>
                          <p className="font-medium">{order.tracking_carrier}</p>
                        </div>
                      )}
                      {order.shipped_at && (
                        <div>
                          <p className="text-xs text-muted-foreground uppercase">Despachado em</p>
                          <p className="font-medium">{formatDate(order.shipped_at)}</p>
                        </div>
                      )}
                    </div>
                    {order.tracking_url && (
                      <a
                        href={order.tracking_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-4 inline-flex"
                      >
                        <Button className="bg-primary hover:bg-primary/90">
                          <Truck className="h-4 w-4 mr-2" />
                          Acompanhar entrega
                        </Button>
                      </a>
                    )}
                  </div>
                )}

                {/* Products */}
                <div className="bg-card rounded-xl border border-border p-6">
                  <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                    <Package className="h-5 w-5 text-primary" />
                    Produtos ({orderItems.length})
                  </h3>
                  <div className="space-y-4">
                    {orderItems.map((item) => (
                      <div key={item.id} className="flex gap-4 pb-4 border-b border-border last:border-0 last:pb-0">
                        {item.product_image && (
                          <img 
                            src={optimizeImage(item.product_image, { width: 128, resize: "contain" })} 
                            alt={item.product_name}
                            className="w-16 h-16 object-contain rounded-lg bg-muted p-1"
                          />
                        )}
                        <div className="flex-1">
                          <p className="font-medium text-foreground">{item.product_name}</p>
                          {item.personalization && (
                            <p className="text-xs text-muted-foreground">
                              Personalização: {item.personalization}
                            </p>
                          )}
                          <p className="text-sm text-muted-foreground">
                            {item.quantity}x R$ {item.unit_price.toFixed(2).replace('.', ',')}
                          </p>
                        </div>
                        <p className="font-bold text-foreground">
                          R$ {(item.quantity * item.unit_price).toFixed(2).replace('.', ',')}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Customer & Shipping */}
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Customer Info */}
                  <div className="bg-card rounded-xl border border-border p-6">
                    <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                      <User className="h-5 w-5 text-primary" />
                      Dados do Cliente
                    </h3>
                    <div className="space-y-3 text-sm">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span>{order.customer_name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span>{order.customer_email}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span>{order.customer_phone}</span>
                      </div>
                    </div>
                  </div>

                  {/* Shipping Info */}
                  <div className="bg-card rounded-xl border border-border p-6">
                    <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                      <MapPin className="h-5 w-5 text-primary" />
                      Endereço de Entrega
                    </h3>
                    <div className="text-sm space-y-1">
                      <p>{order.address_street}, {order.address_number}</p>
                      {order.address_complement && <p>{order.address_complement}</p>}
                      <p>{order.address_neighborhood}</p>
                      <p>{order.address_city} - {order.address_state}</p>
                      <p>CEP: {order.address_cep}</p>
                    </div>
                  </div>
                </div>

                {/* Order Summary */}
                <div className="bg-card rounded-xl border border-border p-6">
                  <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                    <Truck className="h-5 w-5 text-primary" />
                    Resumo
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span>R$ {order.subtotal.toFixed(2).replace('.', ',')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Frete ({order.shipping_method}{order.shipping_days ? ` - ${order.shipping_days}` : ''})
                      </span>
                      <span>R$ {order.shipping_price.toFixed(2).replace('.', ',')}</span>
                    </div>
                    <Separator className="my-3" />
                    <div className="flex justify-between text-lg font-bold">
                      <span>Total</span>
                      <span className="text-primary">R$ {order.total.toFixed(2).replace('.', ',')}</span>
                    </div>
                  </div>
                </div>

                {/* Help */}
                <div className="bg-muted/50 rounded-xl p-6 text-center">
                  <p className="text-muted-foreground mb-4">
                    Dúvidas sobre seu pedido? Entre em contato conosco!
                  </p>
                  <a
                    href={`https://wa.me/5541992214299?text=Olá! Gostaria de informações sobre o pedido ${order.order_code}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button className="bg-green-500 hover:bg-green-600">
                      Falar pelo WhatsApp
                    </Button>
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      <Footer />
      <WhatsAppButton />
    </div>
  );
};

export default RastrearPedido;