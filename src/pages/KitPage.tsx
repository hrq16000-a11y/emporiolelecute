import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Loader2, ChevronRight, Package, MessageCircle, Sparkles, Minus, Plus, ShoppingBag } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import WhatsAppButton from "@/components/WhatsAppButton";
import DynamicSEO from "@/components/DynamicSEO";
import BreadcrumbStructuredData from "@/components/BreadcrumbStructuredData";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useKitBySlug } from "@/hooks/useKits";
import { useCart } from "@/contexts/CartContext";
import { useContactInfo } from "@/hooks/useContactInfo";
import { trackInquiry, trackWhatsAppClick, buildWhatsAppUrl, event as gaEvent } from "@/lib/analytics";
import { optimizeImage } from "@/lib/image";
import { urls } from "@/lib/urls";
import { toast } from "@/hooks/use-toast";

const SITE_ORIGIN = "https://emporiolelecute.com.br";

const BUNDLE_LABEL: Record<string, string> = {
  suggested: "Kit sugerido",
  curated: "Kit curado",
  premium: "Kit premium",
};

export default function KitPage() {
  const { slug = "" } = useParams<{ slug: string }>();
  const { data: kit, isLoading } = useKitBySlug(slug);
  const { addItem } = useCart();
  const { whatsappNumber } = useContactInfo();
  const phone = (whatsappNumber || "5541992214299").replace(/\D/g, "");

  const [qtyMap, setQtyMap] = useState<Record<string, number>>({});

  useEffect(() => {
    if (kit?.id) {
      gaEvent("bundle_view", {
        slug: kit.slug,
        bundle_type: kit.bundle_type,
        kit_id: kit.id,
        origin: "kit_page",
      });
    }
  }, [kit?.id, kit?.slug, kit?.bundle_type]);

  const items = useMemo(
    () =>
      (kit?.products ?? []).map((p) => ({
        ...p,
        qty: qtyMap[p.id] ?? p.kit_quantity ?? p.min_quantity ?? 1,
      })),
    [kit, qtyMap]
  );

  const subtotal = useMemo(
    () => items.reduce((sum, it) => sum + Number(it.price) * it.qty, 0),
    [items]
  );

  const setQty = (id: string, q: number) =>
    setQtyMap((prev) => ({ ...prev, [id]: Math.max(1, Math.floor(q || 1)) }));

  const handleAddAllToCart = () => {
    if (!kit) return;
    items.forEach((it) => {
      addItem({
        id: it.id,
        slug: it.slug,
        name: it.name,
        price: Number(it.price),
        image: it.images?.[0] || "/placeholder.svg",
        minQuantity: it.min_quantity || 1,
        quantity: it.qty,
        bundleId: kit.id,
        bundleName: kit.name,
      });
    });
    toast({ title: "Kit adicionado ao carrinho", description: kit.name });
  };

  const handleWhatsApp = () => {
    if (!kit) return;
    const lines = items
      .map((it) => `• ${it.name} — qtd ${it.qty}`)
      .join("\n");
    const msg =
      `Olá! Tenho interesse no *${kit.name}*.\n\n` +
      `📦 *Itens do kit:*\n${lines}\n\n` +
      `🔗 ${window.location.href}\n\n` +
      `Poderia me ajudar com valor do frete e prazos?`;
    const url = buildWhatsAppUrl({
      phone,
      message: msg,
      utm_source: "kit",
      utm_medium: "whatsapp_cta",
      utm_campaign: `kit_${kit.slug}`,
      utm_content: kit.slug,
    });
    trackInquiry(kit.name, kit.id);
    trackWhatsAppClick({ source: "kit_page" as any, context: kit.slug, utm_campaign: `kit_${kit.slug}` });
    gaEvent("bundle_whatsapp_click", {
      slug: kit.slug,
      bundle_type: kit.bundle_type,
      kit_id: kit.id,
      item_count: items.length,
      origin: "kit_page",
    });
    window.open(url, "_blank", "noopener,noreferrer");
  };

  if (!isLoading && !kit) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 container mx-auto px-4 py-24 text-center">
          <h1 className="text-2xl sm:text-3xl font-display font-semibold mb-3">Kit não encontrado</h1>
          <p className="text-muted-foreground mb-6">O kit que você procura não existe ou não está mais ativo.</p>
          <Button asChild><Link to="/produtos">Ver todos os produtos</Link></Button>
        </main>
        <Footer />
        <WhatsAppButton />
      </div>
    );
  }

  const pageUrl = `${SITE_ORIGIN}/kit/${slug}`;
  const seoTitle = kit?.meta_title?.trim() || (kit ? `${kit.name} | Empório LeleCute` : "Kit");
  const seoDesc = kit?.meta_description?.trim() || kit?.description || undefined;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <DynamicSEO title={seoTitle} description={seoDesc} image={kit?.image_url || undefined} url={pageUrl} type="website" />
      {kit && (
        <BreadcrumbStructuredData
          items={[
            { name: "Início", url: SITE_ORIGIN },
            { name: "Kits", url: `${SITE_ORIGIN}/produtos` },
            { name: kit.name, url: pageUrl },
          ]}
        />
      )}

      <Header />

      <main className="flex-1">
        <section className="bg-gradient-to-br from-primary/5 via-background to-background border-b">
          <div className="container mx-auto px-4 py-10 lg:py-14">
            <nav className="flex items-center gap-1.5 text-sm text-muted-foreground mb-4" aria-label="Navegação">
              <Link to="/" className="hover:text-foreground transition-colors">Início</Link>
              <ChevronRight className="w-3.5 h-3.5" />
              <Link to="/produtos" className="hover:text-foreground transition-colors">Produtos</Link>
              <ChevronRight className="w-3.5 h-3.5" />
              <span className="text-foreground font-medium truncate">{kit?.name ?? ""}</span>
            </nav>
            <div className="flex flex-col-reverse lg:flex-row gap-8 items-start lg:items-center">
              <div className="flex-1 min-w-0">
                <Badge variant="secondary" className="mb-3 gap-1">
                  <Sparkles className="h-3 w-3" />
                  {kit ? BUNDLE_LABEL[kit.bundle_type] || "Kit" : "Kit"}
                </Badge>
                <h1 className="text-3xl lg:text-3xl sm:text-4xl font-display font-semibold text-foreground mb-3">{kit?.name ?? ""}</h1>
                {kit?.description && (
                  <p className="text-muted-foreground text-base lg:text-lg max-w-2xl">{kit.description}</p>
                )}
                {kit?.estimated_savings && Number(kit.estimated_savings) > 0 && (
                  <p className="mt-3 text-sm text-primary font-medium">
                    Economia estimada: R$ {Number(kit.estimated_savings).toFixed(2).replace(".", ",")}
                  </p>
                )}
              </div>
              {kit?.image_url && (
                <div className="w-full max-w-xs lg:max-w-sm shrink-0">
                  <img
                    src={optimizeImage(kit.image_url, { width: 640, resize: "cover" })}
                    alt={kit.name}
                    className="w-full aspect-[4/3] object-cover rounded-2xl shadow-card"
                    loading="eager"
                  />
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="container mx-auto px-4 py-10 lg:py-14">
          {isLoading ? (
            <div className="flex items-center justify-center py-24"><Loader2 className="w-8 h-8 text-primary animate-spin" /></div>
          ) : items.length === 0 ? (
            <div className="text-center py-20 max-w-md mx-auto">
              <ShoppingBag className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h2 className="text-xl font-display font-semibold mb-2">Kit vazio</h2>
              <p className="text-muted-foreground mb-6">Este kit ainda não tem produtos cadastrados.</p>
              <Button asChild><Link to="/produtos">Ver todos os produtos</Link></Button>
            </div>
          ) : (
            <div className="grid lg:grid-cols-[1fr_360px] gap-8">
              <div className="space-y-3">
                <h2 className="text-lg font-display font-medium mb-2 flex items-center gap-2">
                  <Package className="h-4 w-4 text-primary" />
                  Itens deste kit ({items.length})
                </h2>
                {items.map((it) => (
                  <Card key={it.id}>
                    <CardContent className="p-4 flex gap-4 items-center">
                      <Link to={urls.product(it.slug)} className="shrink-0">
                        <img
                          src={optimizeImage(it.images?.[0] || "/placeholder.svg", { width: 160 })}
                          alt={it.name}
                          className="h-20 w-20 rounded-lg object-cover bg-muted"
                          loading="lazy"
                        />
                      </Link>
                      <div className="flex-1 min-w-0">
                        <Link to={urls.product(it.slug)} className="block hover:text-primary transition-colors">
                          <p className="font-medium truncate">{it.name}</p>
                        </Link>
                        <p className="text-sm text-muted-foreground">
                          R$ {Number(it.price).toFixed(2).replace(".", ",")} / un.
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => setQty(it.id, it.qty - 1)}>
                          <Minus className="h-3 w-3" />
                        </Button>
                        <input
                          type="number"
                          min={1}
                          value={it.qty}
                          onChange={(e) => setQty(it.id, Number(e.target.value))}
                          className="w-16 h-8 text-center text-sm rounded-md border border-input bg-background"
                        />
                        <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => setQty(it.id, it.qty + 1)}>
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <aside className="lg:sticky lg:top-24 h-fit space-y-4">
                <Card>
                  <CardContent className="p-5 space-y-4">
                    <div>
                      <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Subtotal do kit</p>
                      <p className="text-2xl font-display font-semibold">
                        R$ {subtotal.toFixed(2).replace(".", ",")}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-1">Frete calculado via WhatsApp</p>
                    </div>
                    <Button onClick={handleAddAllToCart} className="w-full bg-primary hover:bg-primary-dark text-primary-foreground">
                      <ShoppingBag className="h-4 w-4 mr-2" />
                      Adicionar kit ao carrinho
                    </Button>
                    <Button onClick={handleWhatsApp} variant="outline" className="w-full border-green-500 text-green-600 hover:bg-green-50">
                      <MessageCircle className="h-4 w-4 mr-2" />
                      Enviar kit pelo WhatsApp
                    </Button>
                  </CardContent>
                </Card>
              </aside>
            </div>
          )}
        </section>
      </main>

      <Footer />
      <WhatsAppButton />
    </div>
  );
}
