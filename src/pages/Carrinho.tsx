import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ShoppingCart, Trash2, Minus, Plus, ArrowLeft, MessageCircle, MapPin, User, Mail, Phone, Package, Loader2, CheckCircle, Truck, Crosshair } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import WhatsAppButton from "@/components/WhatsAppButton";
import TrustBadges from "@/components/TrustBadges";
import { useCart } from "@/contexts/CartContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { validateCoupon, type ValidCoupon } from "@/hooks/useCoupons";
import { optimizeImage } from "@/lib/image";
import { urls } from "@/lib/urls";
import { calcCartTotals } from "@/lib/cartTotals";
import { formatBRL } from "@/lib/format";
import ShippingCalculator from "@/components/ShippingCalculator";

interface AddressData {
  cep: string;
  city: string;
  state: string;
}

interface CustomerData {
  name: string;
  email: string;
  phone: string;
}

const generateOrderCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = 'LC';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

const Carrinho = () => {
  const navigate = useNavigate();
  const { items, removeItem, updateQuantity, total, clearCart } = useCart();
  const { toast } = useToast();
  
  const [customer, setCustomer] = useState<CustomerData>({
    name: '',
    email: '',
    phone: '',
  });
  
  const [address, setAddress] = useState<AddressData>({
    cep: '',
    city: '',
    state: '',
  });
  
  const [loadingCep, setLoadingCep] = useState(false);
  const [loadingGeo, setLoadingGeo] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderComplete, setOrderComplete] = useState(false);
  const [orderCode, setOrderCode] = useState('');
  const [couponInput, setCouponInput] = useState('');
  const [coupon, setCoupon] = useState<ValidCoupon | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);

  // Mapa nome do estado -> UF (fallback quando provedores retornam nome por extenso)
  const STATE_NAME_TO_UF: Record<string, string> = {
    'acre': 'AC', 'alagoas': 'AL', 'amapá': 'AP', 'amapa': 'AP', 'amazonas': 'AM',
    'bahia': 'BA', 'ceará': 'CE', 'ceara': 'CE', 'distrito federal': 'DF',
    'espírito santo': 'ES', 'espirito santo': 'ES', 'goiás': 'GO', 'goias': 'GO',
    'maranhão': 'MA', 'maranhao': 'MA', 'mato grosso': 'MT', 'mato grosso do sul': 'MS',
    'minas gerais': 'MG', 'pará': 'PA', 'para': 'PA', 'paraíba': 'PB', 'paraiba': 'PB',
    'paraná': 'PR', 'parana': 'PR', 'pernambuco': 'PE', 'piauí': 'PI', 'piaui': 'PI',
    'rio de janeiro': 'RJ', 'rio grande do norte': 'RN', 'rio grande do sul': 'RS',
    'rondônia': 'RO', 'rondonia': 'RO', 'roraima': 'RR', 'santa catarina': 'SC',
    'são paulo': 'SP', 'sao paulo': 'SP', 'sergipe': 'SE', 'tocantins': 'TO',
  };

  const normalizeUF = (value?: string): string => {
    if (!value) return '';
    const v = value.trim();
    if (v.length === 2) return v.toUpperCase();
    return STATE_NAME_TO_UF[v.toLowerCase()] || v.slice(0, 2).toUpperCase();
  };

  // Aplica resultado preenchendo o estado e disparando a busca por CEP se houver
  const applyAddressResult = async (result: { cep?: string; city?: string; state?: string }) => {
    const cleanCep = (result.cep || '').replace(/\D/g, '').slice(0, 8);
    const uf = normalizeUF(result.state);
    setAddress(prev => ({
      cep: cleanCep || prev.cep,
      city: result.city || prev.city,
      state: uf || prev.state,
    }));
    if (cleanCep.length === 8) {
      // valida e completa pelo ViaCEP (autoritativo no Brasil)
      await handleCepChange(cleanCep);
    }
  };

  // Reverse geocode usando Nominatim (OpenStreetMap) – sem chave, retorna CEP no Brasil
  const reverseGeocode = async (lat: number, lon: number) => {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&accept-language=pt-BR&zoom=18&addressdetails=1`;
    const r = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!r.ok) throw new Error('reverse geocode failed');
    const data = await r.json();
    const a = data.address || {};
    return {
      cep: a.postcode as string | undefined,
      city: (a.city || a.town || a.village || a.municipality || a.suburb) as string | undefined,
      state: (a.state_code || a.state) as string | undefined,
    };
  };

  // Fallback por IP – ipwho.is é gratuito e sem chave, retorna postal/city/region_code
  const ipFallback = async () => {
    const r = await fetch('https://ipwho.is/?fields=success,city,region_code,region,postal,country_code');
    const data = await r.json();
    if (!data || data.success === false || data.country_code !== 'BR') {
      throw new Error('ip lookup failed');
    }
    return {
      cep: data.postal as string | undefined,
      city: data.city as string | undefined,
      state: (data.region_code || data.region) as string | undefined,
    };
  };

  const handleAutoFillAddress = async () => {
    if (loadingGeo) return;
    setLoadingGeo(true);
    const tryIpFallback = async (reason: string) => {
      try {
        const res = await ipFallback();
        await applyAddressResult(res);
        toast({
          title: 'Endereço aproximado preenchido',
          description: `${reason}. Usamos sua conexão de internet para estimar a região — confira e ajuste se necessário.`,
        });
      } catch {
        toast({
          title: 'Não foi possível detectar sua localização',
          description: 'Preencha o CEP manualmente, por favor.',
          variant: 'destructive',
        });
      } finally {
        setLoadingGeo(false);
      }
    };

    if (!('geolocation' in navigator)) {
      await tryIpFallback('Seu navegador não suporta GPS');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
          if (!res.cep && !res.city) {
            await tryIpFallback('Não conseguimos identificar o endereço pelo GPS');
            return;
          }
          await applyAddressResult(res);
          toast({
            title: 'Endereço preenchido por GPS',
            description: 'Verifique se está correto antes de finalizar.',
          });
        } catch {
          await tryIpFallback('Falha ao consultar o endereço pelo GPS');
        } finally {
          setLoadingGeo(false);
        }
      },
      async (err) => {
        const reason = err.code === err.PERMISSION_DENIED
          ? 'Permissão de localização negada'
          : 'GPS indisponível no momento';
        await tryIpFallback(reason);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  const discount = coupon?.discount_applied ?? 0;
  const totalWithDiscount = Math.max(0, total - discount);

  const handleApplyCoupon = async () => {
    if (!couponInput.trim()) return;
    setCouponLoading(true);
    const r = await validateCoupon(couponInput, total);
    setCouponLoading(false);
    if (r.valid) {
      setCoupon(r);
      toast({ title: 'Cupom aplicado', description: `Desconto de R$ ${r.discount_applied.toFixed(2).replace('.', ',')}` });
    } else {
      setCoupon(null);
      toast({ title: 'Cupom inválido', description: (r as { error: string }).error, variant: 'destructive' });
    }
  };

  const handleCepChange = async (cep: string) => {
    const cleanCep = cep.replace(/\D/g, '').slice(0, 8);
    setAddress(prev => ({ ...prev, cep: cleanCep }));
    
    if (cleanCep.length === 8) {
      setLoadingCep(true);
      try {
        const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
        const data = await response.json();
        
        if (!data.erro) {
          setAddress(prev => ({
            ...prev,
            city: data.localidade || '',
            state: data.uf || '',
          }));
        } else {
          toast({
            title: "CEP não encontrado",
            description: "Verifique o CEP digitado",
            variant: "destructive",
          });
        }
      } catch {
        toast({
          title: "Erro ao buscar CEP",
          description: "Tente novamente",
          variant: "destructive",
        });
      } finally {
        setLoadingCep(false);
      }
    }
  };

  const formatWhatsAppMessage = (code: string) => {
    // Sprint 3 — agrupa itens por kit (bundleName) quando aplicável
    const groups = new Map<string, typeof items>();
    const ORDER_STANDALONE = "__standalone__";
    for (const item of items) {
      const key = item.bundleName ? `kit::${item.bundleName}` : ORDER_STANDALONE;
      const list = groups.get(key) ?? [];
      list.push(item);
      groups.set(key, list);
    }

    const formatItem = (item: typeof items[number], idx: number) =>
      `${idx + 1}. ${item.name}\n   Qtd: ${item.quantity}x\n   Preço unit: R$ ${item.price.toFixed(2).replace('.', ',')}\n   Subtotal: R$ ${(item.price * item.quantity).toFixed(2).replace('.', ',')}${item.personalization ? `\n   Personalização: ${item.personalization}` : ''}`;

    const blocks: string[] = [];
    const standalone = groups.get(ORDER_STANDALONE);
    if (standalone && standalone.length) {
      blocks.push(standalone.map((it, i) => `• ${it.name} — qtd ${it.quantity}${it.personalization ? ` (${it.personalization})` : ''}`).join('\n'));
    }
    for (const [key, list] of groups) {
      if (key === ORDER_STANDALONE) continue;
      const kitName = key.replace(/^kit::/, '');
      const kitLines = list.map((it) => `  • ${it.name} — qtd ${it.quantity}${it.personalization ? ` (${it.personalization})` : ''}`).join('\n');
      blocks.push(`🎁 *${kitName}*\n${kitLines}`);
    }

    const detailed = items.map(formatItem).join('\n\n');

    return `🛒 *NOVO PEDIDO - EMPÓRIO LELECUTE*\n\n📋 *Código do Pedido:* ${code}\n\n👤 *DADOS DO CLIENTE*\nNome: ${customer.name}\nTelefone: ${customer.phone}\nEmail: ${customer.email}\n\n📍 *DADOS DE ENTREGA/ENVIO*\nCEP: ${address.cep}\nCidade: ${address.city} - ${address.state}\n\n📦 *RESUMO*\n${blocks.join('\n\n')}\n\n📑 *DETALHES DOS PRODUTOS*\n${detailed}\n\n💰 *SUBTOTAL DOS PRODUTOS: R$ ${total.toFixed(2).replace('.', ',')}*\n\n🚚 *FRETE:* A calcular\n\n_Aguardando cálculo do frete e confirmação do pedido_`;
  };

  const handleSubmitOrder = async () => {
    // Validation
    if (!customer.name.trim() || !customer.email.trim() || !customer.phone.trim()) {
      toast({
        title: "Dados incompletos",
        description: "Preencha todos os dados pessoais",
        variant: "destructive",
      });
      return;
    }

    if (!address.cep || !address.city || !address.state) {
      toast({
        title: "Dados incompletos",
        description: "Preencha CEP, cidade e estado",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    const code = generateOrderCode();
    setOrderCode(code);

    try {
      // Save order via secure server-side RPC (validates and inserts atomically)
      const { error: orderError } = await supabase.rpc('create_order_with_items', {
        _order: {
          order_code: code,
          customer_name: customer.name,
          customer_email: customer.email,
          customer_phone: customer.phone,
          address_cep: address.cep,
          address_city: address.city,
          address_state: address.state,
          shipping_method: 'A calcular via WhatsApp',
          shipping_price: 0,
          subtotal: total,
          total: totalWithDiscount,
          coupon_code: coupon?.code ?? null,
          discount_amount: discount,
          notes: coupon ? `Cupom aplicado: ${coupon.code} (-R$ ${coupon.discount_applied.toFixed(2)})` : null,
          status: 'pending',
        },
        _items: items.map(item => ({
          product_name: item.name,
          product_slug: item.slug,
          product_image: item.image,
          quantity: item.quantity,
          unit_price: item.price,
          personalization: item.personalization || null,
        })),
      });

      if (orderError) {
        console.error('Order save error:', orderError);
        throw orderError;
      }

      // Send email to store
      const emailResponse = await supabase.functions.invoke('send-order-email', {
        body: {
          orderCode: code,
          customer,
          address,
          items: items.map(item => ({
            name: item.name,
            slug: item.slug,
            image: item.image,
            quantity: item.quantity,
            price: item.price,
            personalization: item.personalization,
          })),
          subtotal: total,
          shippingPrice: 0,
          total: totalWithDiscount,
          coupon: coupon ? { code: coupon.code, discount: coupon.discount_applied } : null,
        },
      });

      if (emailResponse.error) {
        console.error('Email error:', emailResponse.error);
      }

      // Open WhatsApp with order details
      const whatsappMessage = formatWhatsAppMessage(code);
      const whatsappUrl = `https://wa.me/5541992214299?text=${encodeURIComponent(whatsappMessage)}`;
      window.open(whatsappUrl, '_blank');

      setOrderComplete(true);
      
      toast({
        title: "Pedido enviado! 🎉",
        description: `Código: ${code}. Finalize pelo WhatsApp.`,
      });

    } catch (error) {
      console.error('Error:', error);
      toast({
        title: "Erro ao enviar pedido",
        description: "Tente novamente",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (orderComplete) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="pt-24 pb-16">
          <div className="container mx-auto px-4 py-16 text-center max-w-lg">
            <div className="bg-green-100 rounded-full w-24 h-24 flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="h-12 w-12 text-green-600" />
            </div>
            <h1 className="font-display text-3xl md:text-4xl text-foreground mb-4">
              Pedido Enviado!
            </h1>
            <p className="text-muted-foreground mb-2">
              Seu código de pedido é:
            </p>
            <p className="text-3xl font-bold text-primary mb-6">
              {orderCode}
            </p>
            <p className="text-muted-foreground mb-8">
              Finalize seu pedido pelo WhatsApp. O frete será calculado e informado antes da confirmação final.
            </p>
            <div className="space-y-3">
              <Button 
                className="w-full bg-green-500 hover:bg-green-600"
                onClick={() => {
                  const whatsappMessage = formatWhatsAppMessage(orderCode);
                  window.open(`https://wa.me/5541992214299?text=${encodeURIComponent(whatsappMessage)}`, '_blank');
                }}
              >
                <MessageCircle className="h-5 w-5 mr-2" />
                Abrir WhatsApp
              </Button>
              <Link to={`/rastrear?code=${orderCode}`}>
                <Button variant="outline" className="w-full">
                  <Package className="h-5 w-5 mr-2" />
                  Rastrear Pedido
                </Button>
              </Link>
              <Button 
                variant="ghost" 
                className="w-full"
                onClick={() => {
                  clearCart();
                  navigate('/');
                }}
              >
                Voltar ao Início
              </Button>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="pt-24 pb-16">
          <div className="container mx-auto px-4 py-16 text-center">
            <ShoppingCart className="h-20 w-20 mx-auto text-muted-foreground/50 mb-6" />
            <h1 className="font-display text-3xl md:text-4xl text-foreground mb-4">
              Carrinho vazio
            </h1>
            <p className="text-muted-foreground mb-8">
              Adicione produtos ao carrinho para continuar
            </p>
            <Link to="/produtos">
              <Button className="bg-primary hover:bg-primary/90">
                Ver Produtos
              </Button>
            </Link>
          </div>
        </main>
        <Footer />
        <WhatsAppButton />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4">
          {/* Back Link */}
          <Link 
            to="/produtos" 
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary mb-8 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Continuar comprando
          </Link>

          <h1 className="font-display text-3xl md:text-4xl text-foreground mb-8">
            Finalizar Pedido
          </h1>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Left Column - Form */}
            <div className="lg:col-span-2 space-y-6">
              {/* Cart Items */}
              <div className="bg-card rounded-xl border border-border p-4 md:p-6">
                <h2 className="font-display text-xl text-foreground mb-4 flex items-center gap-2">
                  <Package className="h-5 w-5 text-primary" />
                  Produtos ({items.length})
                </h2>
                <div className="space-y-4">
                  {items.map((item) => (
                    <div 
                      key={item.id}
                      className="flex gap-4 pb-4 border-b border-border last:border-0 last:pb-0"
                    >
                      <Link to={urls.product(item.slug)} className="shrink-0">
                        <img 
                          src={optimizeImage(item.image, { width: 160, resize: "contain" })} 
                          alt={item.name}
                          className="w-20 h-20 object-contain rounded-lg bg-muted p-1"
                        />
                      </Link>
                      <div className="flex-1 min-w-0">
                        <Link 
                          to={urls.product(item.slug)}
                          className="font-semibold text-sm text-foreground hover:text-primary transition-colors line-clamp-2"
                        >
                          {item.name}
                        </Link>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <p className="text-primary font-bold text-sm">
                            {formatBRL(item.price)} / un
                          </p>
                          {item.originalPrice && item.originalPrice > item.price && (
                            <>
                              <span className="text-xs text-muted-foreground line-through">
                                {formatBRL(item.originalPrice)}
                              </span>
                              <span className="text-[10px] font-bold text-green-700 bg-green-100 px-1.5 py-0.5 rounded">
                                -{Math.round((1 - item.price / item.originalPrice) * 100)}%
                              </span>
                            </>
                          )}
                        </div>
                        {item.personalization && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                            {item.personalization}
                          </p>
                        )}
                        <div className="flex items-center gap-3 mt-2">
                          <div className="flex items-center border border-border rounded overflow-hidden">
                            <button 
                              onClick={() => updateQuantity(item.id, item.quantity - 1)}
                              disabled={item.quantity <= item.minQuantity}
                              className="p-1.5 hover:bg-muted transition-colors disabled:opacity-50"
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <span className="px-3 text-sm font-medium">{item.quantity}</span>
                            <button 
                              onClick={() => updateQuantity(item.id, item.quantity + 1)}
                              className="p-1.5 hover:bg-muted transition-colors"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                          <button
                            onClick={() => removeItem(item.id)}
                            className="text-muted-foreground hover:text-destructive transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                          <span className="ml-auto font-bold text-foreground">
                            {formatBRL(item.price * item.quantity)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Customer Data */}
              <div className="bg-card rounded-xl border border-border p-4 md:p-6">
                <h2 className="font-display text-xl text-foreground mb-4 flex items-center gap-2">
                  <User className="h-5 w-5 text-primary" />
                  Dados Pessoais
                </h2>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <Label htmlFor="name">Nome completo *</Label>
                    <Input
                      id="name"
                      placeholder="Seu nome completo"
                      value={customer.name}
                      onChange={(e) => setCustomer(prev => ({ ...prev, name: e.target.value }))}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="seu@email.com"
                      value={customer.email}
                      onChange={(e) => setCustomer(prev => ({ ...prev, email: e.target.value }))}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone">WhatsApp *</Label>
                    <Input
                      id="phone"
                      placeholder="(41) 99999-9999"
                      value={customer.phone}
                      onChange={(e) => setCustomer(prev => ({ ...prev, phone: e.target.value }))}
                      className="mt-1"
                    />
                  </div>
                </div>
              </div>

              {/* Address */}
              <div className="bg-card rounded-xl border border-border p-4 md:p-6">
                <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
                  <h2 className="font-display text-xl text-foreground flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-primary" />
                    Dados de entrega/envio
                  </h2>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAutoFillAddress}
                    disabled={loadingGeo}
                    className="gap-2"
                  >
                    {loadingGeo ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Crosshair className="h-4 w-4" />
                    )}
                    Preencher endereço preciso por GPS
                  </Button>
                </div>
                <div className="grid md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="cep">CEP *</Label>
                    <div className="relative mt-1">
                      <Input
                        id="cep"
                        placeholder="00000-000"
                        value={address.cep}
                        onChange={(e) => handleCepChange(e.target.value)}
                        maxLength={9}
                      />
                      {loadingCep && (
                        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                      )}
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="city">Cidade *</Label>
                    <Input
                      id="city"
                      placeholder="Cidade"
                      value={address.city}
                      onChange={(e) => setAddress(prev => ({ ...prev, city: e.target.value }))}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="state">Estado *</Label>
                    <Input
                      id="state"
                      placeholder="UF"
                      value={address.state}
                      onChange={(e) => setAddress(prev => ({ ...prev, state: e.target.value }))}
                      className="mt-1"
                      maxLength={2}
                    />
                  </div>
                </div>
              </div>

              {/* Shipping Notice */}
              <div className="bg-primary-light/50 rounded-xl border border-primary/20 p-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                    <Truck className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground mb-1">Sobre o Frete</h3>
                    <p className="text-sm text-muted-foreground">
                      O valor do frete será calculado e informado pelo WhatsApp após o envio do pedido. 
                      Trabalhamos com Correios (PAC e SEDEX) e o valor é calculado de acordo com o CEP de destino e peso dos produtos.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column - Summary */}
            <div className="lg:col-span-1">
              <div className="bg-card rounded-xl border border-border p-6 sticky top-28">
                <h2 className="font-display text-xl text-foreground mb-4">
                  Resumo do Pedido
                </h2>

                <div className="space-y-3 text-sm">
                  {(() => {
                    const { originalSubtotal, savings, hasDiscount } = calcCartTotals(items);
                    if (!hasDiscount || savings <= 0) return null;
                    return (
                      <>
                        <div className="flex justify-between text-muted-foreground">
                          <span>De</span>
                          <span className="line-through">{formatBRL(originalSubtotal)}</span>
                        </div>
                        <div className="flex justify-between text-green-700 font-medium">
                          <span>Você economiza</span>
                          <span>- {formatBRL(savings)}</span>
                        </div>
                      </>
                    );
                  })()}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal ({items.length} {items.length === 1 ? 'item' : 'itens'})</span>
                    <span className="text-foreground">{formatBRL(total)}</span>
                  </div>
                  {coupon && (
                    <div className="flex justify-between text-green-700">
                      <span>Cupom {coupon.code}</span>
                      <span>- {formatBRL(discount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Frete</span>
                    <span className="text-foreground text-primary font-medium">A calcular</span>
                  </div>
                </div>

                {/* Coupon */}
                <div className="mt-4 pt-4 border-t border-border">
                  <Label className="text-xs">Cupom de desconto</Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      placeholder="Código"
                      value={couponInput}
                      onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                      className="font-mono uppercase"
                      disabled={!!coupon}
                    />
                    {coupon ? (
                      <Button variant="outline" size="sm" onClick={() => { setCoupon(null); setCouponInput(''); }}>
                        Remover
                      </Button>
                    ) : (
                      <Button size="sm" onClick={handleApplyCoupon} disabled={couponLoading || !couponInput}>
                        {couponLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Aplicar'}
                      </Button>
                    )}
                  </div>
                </div>

                <Separator className="my-4" />

                <div className="flex justify-between items-center mb-2">
                  <span className="font-semibold text-foreground">Subtotal</span>
                  <span className="text-2xl font-bold text-primary">
                    {formatBRL(totalWithDiscount)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground text-center mb-6">
                  + frete (calculado via WhatsApp)
                </p>

                <div className="space-y-3">
                  <Button 
                    size="lg" 
                    className="w-full bg-green-500 hover:bg-green-600 text-white"
                    onClick={handleSubmitOrder}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      <>
                        <MessageCircle className="h-5 w-5 mr-2" />
                        Finalizar pelo WhatsApp
                      </>
                    )}
                  </Button>

                  <p className="text-xs text-center text-muted-foreground">
                    Você receberá um código de pedido e será direcionado ao WhatsApp
                  </p>
                </div>

                {/* Trust Badges */}
                <div className="mt-6 pt-6 border-t border-border">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                    Compra 100% segura
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                    Produtos artesanais de qualidade
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                    Confirmação por email e WhatsApp
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <TrustBadges />

      <Footer />
      <WhatsAppButton />
    </div>
  );
};

export default Carrinho;