import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  Loader2, MessageCircle, Save, RotateCcw, Eye, BarChart3, ClipboardCheck,
  ExternalLink, RefreshCw, Trash2,
} from "lucide-react";
import {
  useConversionCtaConfig,
  useSaveConversionCtaConfig,
  DEFAULT_CONVERSION_CTA,
  validateConversionCtaConfig,
  type ConversionCtaConfig,
} from "@/hooks/useConversionCtaConfig";
import { renderWhatsAppMessage } from "@/lib/whatsappTemplate";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDbProducts } from "@/hooks/useProducts";
import { urls, CANONICAL_ORIGIN } from "@/lib/urls";
import { PdpBadge } from "@/components/PdpBadge";

// ============================================================================
// Pré-visualização padrão (quando nenhum produto é selecionado)
// ============================================================================
const FALLBACK_VARS = {
  productName: "Sabonete artesanal lavanda",
  productSlug: "sabonete-lavanda",
  link: urls.productAbsolute("sabonete-lavanda"),
  quantity: 30,
  personalization: "Nome: Maria · Cor da fita: rosa",
  price: "R$ 12,90",
  imageUrl: "https://emporiolelecute.com.br/img/sabonete.jpg",
  category: "Sabonetes",
  occasion: "Casamento",
  segment: "Lembrancinhas",
};

// ============================================================================
// Página principal — abas
// ============================================================================
export default function AdminConversionCTA() {
  const { data, isLoading } = useConversionCtaConfig();
  const saveMut = useSaveConversionCtaConfig();
  const [draft, setDraft] = useState<ConversionCtaConfig | null>(null);

  useEffect(() => {
    if (data && !draft) setDraft(data);
  }, [data, draft]);

  if (isLoading || !draft) {
    return (
      <div className="p-8 flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando configurações…
      </div>
    );
  }

  const update = <K extends keyof ConversionCtaConfig>(key: K, patch: Partial<ConversionCtaConfig[K]>) =>
    setDraft((d) => (d ? { ...d, [key]: { ...d[key], ...patch } } : d));

  const handleSave = async () => {
    if (!draft) return;
    try {
      validateConversionCtaConfig(draft); // valida antes de chamar a mutation (mensagem amigável)
      await saveMut.mutateAsync(draft);
      toast.success("Configurações salvas com sucesso.");
    } catch (e: any) {
      toast.error(e?.message || "Erro ao salvar configurações.");
    }
  };

  const handleReset = () => {
    setDraft(DEFAULT_CONVERSION_CTA);
    toast.message("Padrões restaurados (clique em salvar para aplicar).");
  };

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MessageCircle className="h-6 w-6 text-primary" /> CTA & Conversão (PDP)
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Controle dos elementos de conversão, validação robusta, preview ao vivo,
            funil de analytics e checklist de QA.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleReset}>
            <RotateCcw className="h-4 w-4 mr-1" /> Padrões
          </Button>
          <Button onClick={handleSave} disabled={saveMut.isPending}>
            {saveMut.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
            Salvar
          </Button>
        </div>
      </header>

      <Tabs defaultValue="config" className="space-y-4">
        <TabsList>
          <TabsTrigger value="config"><MessageCircle className="h-4 w-4 mr-1" /> Configuração</TabsTrigger>
          <TabsTrigger value="preview"><Eye className="h-4 w-4 mr-1" /> Pré-visualização</TabsTrigger>
          <TabsTrigger value="funnel"><BarChart3 className="h-4 w-4 mr-1" /> Funil</TabsTrigger>
          <TabsTrigger value="qa"><ClipboardCheck className="h-4 w-4 mr-1" /> Checklist & QA</TabsTrigger>
        </TabsList>

        <TabsContent value="config">
          <ConfigTab draft={draft} update={update} />
        </TabsContent>

        <TabsContent value="preview">
          <PreviewTab template={draft.whatsappTemplate.template} />
        </TabsContent>

        <TabsContent value="funnel">
          <FunnelTab />
        </TabsContent>

        <TabsContent value="qa">
          <QATab draft={draft} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================================================
// 1) CONFIG
// ============================================================================
function ConfigTab({
  draft,
  update,
}: {
  draft: ConversionCtaConfig;
  update: <K extends keyof ConversionCtaConfig>(k: K, p: Partial<ConversionCtaConfig[K]>) => void;
}) {
  const previewMessage = renderWhatsAppMessage(draft.whatsappTemplate.template, FALLBACK_VARS);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>Sticky CTA (mobile)</CardTitle>
              <CardDescription>Botão fixo no rodapé após scroll.</CardDescription>
            </div>
            <Switch checked={draft.sticky.enabled} onCheckedChange={(v) => update("sticky", { enabled: v })} />
          </div>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-4">
          <Field label="Texto do botão" value={draft.sticky.buttonLabel} onChange={(v) => update("sticky", { buttonLabel: v })} />
          <div className="space-y-1">
            <Label>Gatilho de scroll (fração da viewport)</Label>
            <Input
              type="number" step="0.05" min={0.1} max={1}
              value={draft.sticky.scrollViewportRatio}
              onChange={(e) => update("sticky", { scrollViewportRatio: Number(e.target.value) })}
            />
            <p className="text-xs text-muted-foreground">0.7 = aparece após rolar ~70% da altura da tela.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>Resumo rápido (Quick Summary)</CardTitle>
              <CardDescription>Bloco com mínimo, prazo, envio e CTA.</CardDescription>
            </div>
            <Switch checked={draft.quickSummary.enabled} onCheckedChange={(v) => update("quickSummary", { enabled: v })} />
          </div>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-4">
          <Field label="Título" value={draft.quickSummary.title} onChange={(v) => update("quickSummary", { title: v })} />
          <Field label="CTA" value={draft.quickSummary.ctaLabel} onChange={(v) => update("quickSummary", { ctaLabel: v })} />
          <Field label="Label mínimo" value={draft.quickSummary.minLabel} onChange={(v) => update("quickSummary", { minLabel: v })} />
          <Field label="Label prazo" value={draft.quickSummary.prazoLabel} onChange={(v) => update("quickSummary", { prazoLabel: v })} />
          <Field label="Label envio" value={draft.quickSummary.shippingLabel} onChange={(v) => update("quickSummary", { shippingLabel: v })} />
          <Field label="Valor envio" value={draft.quickSummary.shippingValue} onChange={(v) => update("quickSummary", { shippingValue: v })} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>Exit Intent Popup</CardTitle>
              <CardDescription>Frequência e cooldown — bloqueios ficam registrados no funil.</CardDescription>
            </div>
            <Switch checked={draft.exitPopup.enabled} onCheckedChange={(v) => update("exitPopup", { enabled: v })} />
          </div>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-4">
          <Field label="Título" value={draft.exitPopup.title} onChange={(v) => update("exitPopup", { title: v })} />
          <Field label="CTA" value={draft.exitPopup.ctaLabel} onChange={(v) => update("exitPopup", { ctaLabel: v })} />
          <div className="sm:col-span-2 space-y-1">
            <Label>Descrição</Label>
            <Textarea rows={3} value={draft.exitPopup.description} onChange={(e) => update("exitPopup", { description: e.target.value })} />
          </div>
          <Field label="Botão recusar" value={draft.exitPopup.dismissLabel} onChange={(v) => update("exitPopup", { dismissLabel: v })} />
          <div className="grid grid-cols-3 gap-2 sm:col-span-2">
            <div className="space-y-1">
              <Label>Máx/sessão</Label>
              <Input type="number" min={1} max={5} value={draft.exitPopup.maxPerSession}
                onChange={(e) => update("exitPopup", { maxPerSession: Number(e.target.value) })} />
            </div>
            <div className="space-y-1">
              <Label>Cooldown (min)</Label>
              <Input type="number" min={1} max={720} value={draft.exitPopup.cooldownMinutes}
                onChange={(e) => update("exitPopup", { cooldownMinutes: Number(e.target.value) })} />
            </div>
            <div className="space-y-1">
              <Label>Arm delay (ms)</Label>
              <Input type="number" min={0} max={60000} step={500} value={draft.exitPopup.armDelayMs}
                onChange={(e) => update("exitPopup", { armDelayMs: Number(e.target.value) })} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Template da mensagem WhatsApp</CardTitle>
          <CardDescription>
            Obrigatórios: <code>{"{produto}"}</code>, <code>{"{qtd}"}</code>, <code>{"{link}"}</code>.{" "}
            Opcionais: <code>{"{preco} {personalizacao_linha} {imagem_linha} {contexto} {categoria} {ocasiao} {segmento}"}</code>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            rows={10}
            className="font-mono text-xs"
            value={draft.whatsappTemplate.template}
            onChange={(e) => update("whatsappTemplate", { template: e.target.value })}
          />
          <Separator />
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Preview (dados de exemplo — use a aba Pré-visualização para escolher produto real)</Label>
            <pre className="rounded-md border bg-muted/40 p-3 text-xs whitespace-pre-wrap break-words">{previewMessage}</pre>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>Toast de confirmação</CardTitle>
              <CardDescription>Aparece após o clique no WhatsApp para confirmar a ação.</CardDescription>
            </div>
            <Switch checked={draft.toast.enabled} onCheckedChange={(v) => update("toast", { enabled: v })} />
          </div>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2 space-y-1">
            <Label>Mensagem</Label>
            <Input value={draft.toast.message} onChange={(e) => update("toast", { message: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label>Duração (ms)</Label>
            <Input
              type="number" min={1000} max={15000} step={500}
              value={draft.toast.durationMs}
              onChange={(e) => update("toast", { durationMs: Number(e.target.value) })}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>Badge da PDP (ex.: "Frete reduzido")</CardTitle>
              <CardDescription>Selo flutuante sobre a imagem do produto. Pode ser sobrescrito por produto.</CardDescription>
            </div>
            <Switch
              checked={draft.pdpBadge.enabled}
              onCheckedChange={(v) => update("pdpBadge", { enabled: v })}
            />
          </div>
        </CardHeader>
        <CardContent className="grid lg:grid-cols-[1fr_320px] gap-6">
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2 space-y-1">
              <Label>Texto</Label>
              <Input
                value={draft.pdpBadge.label}
                maxLength={40}
                onChange={(e) => update("pdpBadge", { label: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>Cor</Label>
              <select
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={draft.pdpBadge.tone}
                onChange={(e) => update("pdpBadge", { tone: e.target.value as any })}
              >
                <option value="blue">Azul</option>
                <option value="coral">Coral (marca)</option>
                <option value="green">Verde</option>
                <option value="amber">Âmbar</option>
                <option value="neutral">Neutro</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label>Posição</Label>
              <select
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={draft.pdpBadge.position}
                onChange={(e) => update("pdpBadge", { position: e.target.value as any })}
              >
                <option value="top-left">Superior esquerda</option>
                <option value="top-right">Superior direita</option>
                <option value="bottom-left">Inferior esquerda</option>
                <option value="bottom-right">Inferior direita</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label>Offset horizontal (px)</Label>
              <Input
                type="number" min={0} max={80}
                value={draft.pdpBadge.offsetX}
                onChange={(e) => update("pdpBadge", { offsetX: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-1">
              <Label>Offset vertical (px)</Label>
              <Input
                type="number" min={0} max={80}
                value={draft.pdpBadge.offsetY}
                onChange={(e) => update("pdpBadge", { offsetY: Number(e.target.value) })}
              />
            </div>
            <label className="flex items-center gap-2 sm:col-span-3">
              <Switch
                checked={draft.pdpBadge.showIcon}
                onCheckedChange={(v) => update("pdpBadge", { showIcon: v })}
              />
              <span className="text-sm">Mostrar ícone de caminhão</span>
            </label>
          </div>

          {/* Live preview */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Pré-visualização ao vivo</Label>
            <div className="relative w-[320px] h-[320px] rounded-lg overflow-hidden border bg-gradient-to-br from-muted/40 to-muted">
              <img
                src="/placeholder.svg"
                alt="Mock produto"
                className="absolute inset-0 w-full h-full object-cover opacity-70"
              />
              <PdpBadge config={draft.pdpBadge} previewOnly />
            </div>
            <p className="text-[11px] text-muted-foreground">
              Posição e offsets aplicados sobre a imagem real do produto na PDP.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// 2) PREVIEW — seleciona produto real e simula qty/personalização
// ============================================================================
function PreviewTab({ template }: { template: string }) {
  const { data: products = [], isLoading } = useDbProducts();
  const active = useMemo(() => (products || []).filter((p) => p.is_active), [products]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [qty, setQty] = useState(10);
  const [personalization, setPersonalization] = useState("Nome: Maria · Cor: rosa");

  const product = active.find((p) => p.id === selectedId) || active[0];

  useEffect(() => {
    if (!selectedId && active[0]) {
      setSelectedId(active[0].id);
      setQty(active[0].min_quantity || 10);
    }
  }, [active, selectedId]);

  const rendered = product
    ? renderWhatsAppMessage(template, {
        productName: product.name,
        productSlug: product.slug,
        link: urls.productShare(product.slug),
        quantity: qty,
        personalization,
        price: `R$ ${product.price.toFixed(2).replace(".", ",")}`,
        imageUrl: product.images?.[0],
        category: product.category?.name,
        occasion: product.occasions?.[0]?.name,
        segment: product.segments?.[0]?.name,
      })
    : "(selecione um produto)";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pré-visualização ao vivo</CardTitle>
        <CardDescription>
          Selecione um produto e simule quantidade/personalização — a mensagem do WhatsApp
          é renderizada usando o template salvo (ou em edição na aba Configuração).
        </CardDescription>
      </CardHeader>
      <CardContent className="grid lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="space-y-1">
            <Label>Produto</Label>
            <Select value={selectedId} onValueChange={(v) => {
              setSelectedId(v);
              const p = active.find((x) => x.id === v);
              if (p) setQty(p.min_quantity || 10);
            }}>
              <SelectTrigger>
                <SelectValue placeholder={isLoading ? "Carregando…" : "Selecione um produto"} />
              </SelectTrigger>
              <SelectContent>
                {active.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Quantidade</Label>
            <Input type="number" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value) || 1)} />
            {product && (
              <p className="text-xs text-muted-foreground">Mínimo do produto: {product.min_quantity}</p>
            )}
          </div>
          <div className="space-y-1">
            <Label>Personalização (opcional)</Label>
            <Textarea rows={3} value={personalization} onChange={(e) => setPersonalization(e.target.value)} />
          </div>
          {product && (
            <div className="flex flex-wrap gap-2 text-xs">
              {product.category?.name && <Badge variant="secondary">Categoria: {product.category.name}</Badge>}
              {product.occasions?.[0]?.name && <Badge variant="secondary">Ocasião: {product.occasions[0].name}</Badge>}
              {product.segments?.[0]?.name && <Badge variant="secondary">Segmento: {product.segments[0].name}</Badge>}
            </div>
          )}
        </div>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Mensagem final do WhatsApp</Label>
          <pre className="rounded-md border bg-muted/40 p-3 text-xs whitespace-pre-wrap break-words min-h-[300px]">
{rendered}
          </pre>
          <Button
            variant="outline"
            className="w-full"
            disabled={!product}
            onClick={() => {
              navigator.clipboard.writeText(rendered);
              toast.success("Mensagem copiada para a área de transferência.");
            }}
          >
            Copiar mensagem
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// 3) FUNIL — chama RPC pdp_funnel_stats(_from, _to)
// ============================================================================
const PERIODS = [
  { label: "Últimas 24h", days: 1 },
  { label: "Últimos 7 dias", days: 7 },
  { label: "Últimos 30 dias", days: 30 },
  { label: "Últimos 90 dias", days: 90 },
];

interface FunnelStats {
  from: string;
  to: string;
  counts: Record<string, number>;
  by_source: Record<string, number>;
  blocked_by_rule: Record<string, number>;
  top_products: { product_slug: string; clicks: number }[];
}

function FunnelTab() {
  const [days, setDays] = useState(7);
  const qc = useQueryClient();
  const queryKey = ["pdp_funnel_stats", days];

  const { data, isFetching, error } = useQuery({
    queryKey,
    queryFn: async (): Promise<FunnelStats> => {
      const _to = new Date();
      const _from = new Date(_to.getTime() - days * 24 * 60 * 60 * 1000);
      const { data, error } = await supabase.rpc("pdp_funnel_stats" as any, {
        _from: _from.toISOString(),
        _to: _to.toISOString(),
      });
      if (error) throw error;
      return data as FunnelStats;
    },
  });

  const c = data?.counts || {};
  const stickyView = c.pdp_sticky_view || 0;
  const summaryView = c.pdp_quick_summary_view || 0;
  const waClick = c.pdp_whatsapp_click || 0;
  const waConfirmed = c.whatsapp_click_confirmed || 0;
  const popupOpen = c.exit_popup_open || 0;
  const popupClose = c.exit_popup_close || 0;
  const popupBlocked = c.exit_popup_blocked || 0;
  const popupWa = c.exit_popup_whatsapp_click || 0;

  const rate = (a: number, b: number) => (b > 0 ? `${((a / b) * 100).toFixed(1)}%` : "—");

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
          <div>
            <CardTitle>Funil de conversão</CardTitle>
            <CardDescription>Dados persistidos em <code>pdp_funnel_events</code>.</CardDescription>
          </div>
          <div className="flex gap-2 items-center">
            <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERIODS.map((p) => <SelectItem key={p.days} value={String(p.days)}>{p.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={() => qc.invalidateQueries({ queryKey })}>
              <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && <p className="text-sm text-destructive">Erro ao carregar: {(error as Error).message}</p>}

          <section>
            <h3 className="text-sm font-semibold mb-2">CTA principal</h3>
            <div className="grid sm:grid-cols-4 gap-3">
              <Metric label="Sticky views" value={stickyView} />
              <Metric label="Quick summary views" value={summaryView} />
              <Metric label="WhatsApp clicks" value={waClick} />
              <Metric label="Confirmações" value={waConfirmed} />
            </div>
            <div className="grid sm:grid-cols-3 gap-3 mt-3 text-sm">
              <RateRow label="Sticky → Clique" value={rate(waClick, stickyView)} />
              <RateRow label="Clique → Confirmação" value={rate(waConfirmed, waClick)} />
              <RateRow label="Sticky → Confirmação (e2e)" value={rate(waConfirmed, stickyView)} />
            </div>
          </section>

          <Separator />

          <section>
            <h3 className="text-sm font-semibold mb-2">Exit Intent Popup</h3>
            <div className="grid sm:grid-cols-4 gap-3">
              <Metric label="Aberturas" value={popupOpen} />
              <Metric label="Fechamentos" value={popupClose} />
              <Metric label="Bloqueios" value={popupBlocked} />
              <Metric label="WhatsApp pelo popup" value={popupWa} />
            </div>
            <div className="grid sm:grid-cols-3 gap-3 mt-3 text-sm">
              <RateRow label="Abertura → WhatsApp" value={rate(popupWa, popupOpen)} />
              <RateRow label="Bloqueio / tentativa" value={rate(popupBlocked, popupBlocked + popupOpen)} />
              <RateRow label="Fechamento / abertura" value={rate(popupClose, popupOpen)} />
            </div>
            {Object.keys(data?.blocked_by_rule || {}).length > 0 && (
              <div className="mt-3 text-xs text-muted-foreground">
                Bloqueios por regra:{" "}
                {Object.entries(data!.blocked_by_rule).map(([k, v]) => (
                  <Badge key={k} variant="outline" className="mr-1">{k}: {v}</Badge>
                ))}
              </div>
            )}
          </section>

          <Separator />

          <section className="grid lg:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-semibold mb-2">Cliques por origem</h3>
              <div className="space-y-1 text-sm">
                {Object.entries(data?.by_source || {}).length === 0 && (
                  <p className="text-xs text-muted-foreground">Sem dados no período.</p>
                )}
                {Object.entries(data?.by_source || {}).map(([src, n]) => (
                  <div key={src} className="flex justify-between border-b py-1">
                    <span>{src}</span><span className="font-mono">{n as number}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-sm font-semibold mb-2">Top produtos (cliques WhatsApp)</h3>
              <div className="space-y-1 text-sm">
                {(data?.top_products || []).length === 0 && (
                  <p className="text-xs text-muted-foreground">Sem dados no período.</p>
                )}
                {(data?.top_products || []).map((p) => (
                  <div key={p.product_slug} className="flex justify-between border-b py-1">
                    <span className="truncate mr-2">{p.product_slug}</span>
                    <span className="font-mono">{p.clicks}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-2xl font-bold">{value.toLocaleString("pt-BR")}</div>
    </div>
  );
}

function RateRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between rounded-md bg-muted/40 px-3 py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono font-semibold">{value}</span>
    </div>
  );
}

// ============================================================================
// 4) CHECKLIST & QA
// ============================================================================
const CHECKLIST_KEY = "__pdp_qa_checklist__";
const CHECKLIST_ITEMS = [
  { id: "sticky_mobile", label: "Sticky aparece ao rolar abaixo do CTA principal no mobile (360×640)" },
  { id: "sticky_tablet", label: "Sticky respeita scrollViewportRatio no tablet (768×1024)" },
  { id: "sticky_hide", label: "Sticky some quando o CTA principal volta ao viewport" },
  { id: "qty_fresh_sticky", label: "Alterar quantidade reflete na mensagem do sticky imediatamente" },
  { id: "qty_fresh_summary", label: "Alterar quantidade reflete na mensagem do Quick Summary imediatamente" },
  { id: "person_fresh", label: "Adicionar personalização aparece na mensagem do WhatsApp" },
  { id: "toast_shown", label: "Toast de confirmação aparece após clicar no WhatsApp" },
  { id: "ga_event", label: "Evento pdp_whatsapp_click chega no GA com source correto" },
  { id: "popup_once", label: "Exit popup abre 1× por sessão (mouse no topo / scroll up rápido)" },
  { id: "popup_blocked", label: "Segunda tentativa na mesma sessão é bloqueada (registra exit_popup_blocked)" },
  { id: "popup_cooldown", label: "Após cooldown (30 min) o popup pode reaparecer" },
];

function QATab({ draft }: { draft: ConversionCtaConfig }) {
  const { data: products = [] } = useDbProducts();
  const firstProduct = (products || []).find((p) => p.is_active);
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CHECKLIST_KEY);
      if (raw) setChecked(JSON.parse(raw));
    } catch { /* noop */ }
  }, []);

  const toggle = (id: string) => {
    setChecked((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      try { localStorage.setItem(CHECKLIST_KEY, JSON.stringify(next)); } catch { /* noop */ }
      return next;
    });
  };

  const resetExitPopup = () => {
    try {
      sessionStorage.removeItem("__exit_intent_state__");
      sessionStorage.removeItem("__exit_intent_shown__"); // legado
      toast.success("Estado do Exit Popup resetado nesta sessão. Recarregue a PDP para testar novamente.");
    } catch {
      toast.error("Não foi possível resetar o sessionStorage.");
    }
  };

  const resetSession = () => {
    try {
      sessionStorage.clear();
      toast.success("sessionStorage limpo (sticky/popup/session id).");
    } catch {
      toast.error("Não foi possível limpar a sessão.");
    }
  };

  const completedCount = Object.values(checked).filter(Boolean).length;
  const total = CHECKLIST_ITEMS.length;
  const productUrl = firstProduct ? urls.product(firstProduct.slug) : "/produtos";

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Atalhos de teste</CardTitle>
          <CardDescription>
            Use para validar trigger do sticky, frequência 1×/sessão e cooldown de {draft.exitPopup.cooldownMinutes} min.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <a href={productUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-1" /> Abrir PDP em nova aba
            </a>
          </Button>
          <Button variant="outline" onClick={resetExitPopup}>
            <RefreshCw className="h-4 w-4 mr-1" /> Resetar estado do Exit Popup
          </Button>
          <Button variant="outline" onClick={resetSession}>
            <Trash2 className="h-4 w-4 mr-1" /> Limpar sessionStorage
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>Checklist de QA</CardTitle>
              <CardDescription>Marque cada item conforme valida em produção/preview.</CardDescription>
            </div>
            <Badge variant={completedCount === total ? "default" : "secondary"}>
              {completedCount}/{total}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {CHECKLIST_ITEMS.map((item) => (
            <label
              key={item.id}
              className="flex items-start gap-3 rounded-md border p-3 cursor-pointer hover:bg-muted/30"
            >
              <Checkbox checked={!!checked[item.id]} onCheckedChange={() => toggle(item.id)} />
              <span className={`text-sm ${checked[item.id] ? "line-through text-muted-foreground" : ""}`}>
                {item.label}
              </span>
            </label>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Como validar (passo a passo)</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-3 text-muted-foreground">
          <div>
            <strong className="text-foreground">1. Sticky (mobile 360×640):</strong> abra a PDP, role para baixo até passar do CTA principal.
            O sticky deve aparecer suavemente. Volte ao topo e ele deve sumir.
          </div>
          <div>
            <strong className="text-foreground">2. Estado fresco:</strong> aumente a quantidade enquanto rola, clique no WhatsApp do sticky.
            A mensagem precisa refletir a nova quantidade.
          </div>
          <div>
            <strong className="text-foreground">3. Exit popup (desktop):</strong> mova o mouse rapidamente para fora do topo da janela após 8s.
            Popup abre 1×. Tente novamente — deve ser bloqueado (verifique evento <code>exit_popup_blocked</code> no funil).
          </div>
          <div>
            <strong className="text-foreground">4. Cooldown:</strong> espere {draft.exitPopup.cooldownMinutes} min ou clique em
            “Resetar estado do Exit Popup” acima. O popup voltará a poder ser disparado.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================
function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
