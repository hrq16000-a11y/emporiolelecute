import { useState, useEffect } from "react";
import { useTrackingConfig, useUpdateTrackingConfig, type TrackingConfig } from "@/hooks/useTrackingConfig";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { BarChart3, Save } from "lucide-react";

export default function AdminTracking() {
  const { data, isLoading } = useTrackingConfig();
  const update = useUpdateTrackingConfig();
  const { toast } = useToast();
  const [form, setForm] = useState<TrackingConfig | null>(null);

  useEffect(() => { if (data && !form) setForm(data); }, [data, form]);

  if (isLoading || !form) return <p className="text-muted-foreground">Carregando...</p>;

  const save = async () => {
    try {
      await update.mutateAsync(form);
      toast({ title: "Configuração de tracking salva" });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const setF = (patch: Partial<TrackingConfig>) => setForm({ ...form, ...patch });

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display flex items-center gap-2"><BarChart3 className="h-7 w-7" /> Analytics & Ads</h1>
          <p className="text-muted-foreground">IDs de rastreamento e carregamento condicional por rota.</p>
        </div>
        <Button onClick={save} disabled={update.isPending}><Save className="h-4 w-4 mr-2" /> Salvar</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Status global</CardTitle>
          <CardDescription>Quando desativado, nenhum script de tracking é carregado em qualquer página.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Switch checked={form.enabled} onCheckedChange={(v) => setF({ enabled: v })} />
            <span>{form.enabled ? "Ativo" : "Desativado"}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>IDs</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Google Analytics 4 (GA4) — formato G-XXXXXXX</Label>
            <Input value={form.ga4_id} onChange={(e) => setF({ ga4_id: e.target.value.trim() })} placeholder="G-ABCDEF1234" />
          </div>
          <div>
            <Label>Google Tag Manager (GTM) — formato GTM-XXXXXXX</Label>
            <Input value={form.gtm_id} onChange={(e) => setF({ gtm_id: e.target.value.trim() })} placeholder="GTM-ABCD123" />
          </div>
          <div>
            <Label>Meta (Facebook) Pixel ID</Label>
            <Input value={form.meta_pixel_id} onChange={(e) => setF({ meta_pixel_id: e.target.value.trim() })} placeholder="1234567890123456" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Google Ads ID — formato AW-XXXXXXX</Label>
              <Input value={form.google_ads_id} onChange={(e) => setF({ google_ads_id: e.target.value.trim() })} placeholder="AW-1234567890" />
            </div>
            <div>
              <Label>Conversion Label (opcional)</Label>
              <Input value={form.google_ads_conversion_label} onChange={(e) => setF({ google_ads_conversion_label: e.target.value.trim() })} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Carregamento condicional</CardTitle>
          <CardDescription>
            Use uma rota por linha. Curingas ao final: <code>/produtos/*</code>. Deixe vazio para carregar em todas as rotas
            (exceto as desativadas). O painel /admin é sempre excluído por padrão.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Carregar APENAS nestas rotas (opcional)</Label>
            <Textarea
              rows={4}
              value={form.enabled_paths.join("\n")}
              onChange={(e) => setF({ enabled_paths: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })}
              placeholder="/&#10;/produtos/*&#10;/loja"
            />
          </div>
          <div>
            <Label>NÃO carregar nestas rotas</Label>
            <Textarea
              rows={3}
              value={form.disabled_paths.join("\n")}
              onChange={(e) => setF({ disabled_paths: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
