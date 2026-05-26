import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Save, RotateCcw, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Settings = {
  is_enabled: boolean;
  initial_delay_ms: number;
  visible_ms: number;
  interval_ms: number;
  position: "bottom-left" | "bottom-right" | "top-left" | "top-right";
  show_on_mobile: boolean;
  show_on_desktop: boolean;
  min_rating: number;
  pool_size: number;
  require_verified: boolean;
  excluded_paths: string[];
  included_paths: string[];
  dismiss_persistence: "session" | "never";
};

const DEFAULTS: Settings = {
  is_enabled: true,
  initial_delay_ms: 6000,
  visible_ms: 9000,
  interval_ms: 18000,
  position: "bottom-left",
  show_on_mobile: true,
  show_on_desktop: true,
  min_rating: 4,
  pool_size: 60,
  require_verified: false,
  excluded_paths: ["/admin", "/acesso-restrito", "/rastrear"],
  included_paths: [],
  dismiss_persistence: "session",
};

export default function AdminSocialProof() {
  const [draft, setDraft] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("social_proof_settings")
        .select("*")
        .eq("id", true)
        .maybeSingle();
      if (error) toast.error("Erro ao carregar configurações");
      setDraft({ ...DEFAULTS, ...(data ?? {}) } as Settings);
      setLoading(false);
    })();
  }, []);

  if (loading || !draft) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const set = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    setDraft((d) => (d ? { ...d, [key]: value } : d));

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("social_proof_settings")
      .update({
        is_enabled: draft.is_enabled,
        initial_delay_ms: Math.max(0, Math.min(draft.initial_delay_ms, 120000)),
        visible_ms: Math.max(2000, Math.min(draft.visible_ms, 60000)),
        interval_ms: Math.max(2000, Math.min(draft.interval_ms, 600000)),
        position: draft.position,
        show_on_mobile: draft.show_on_mobile,
        show_on_desktop: draft.show_on_desktop,
        min_rating: Math.max(1, Math.min(draft.min_rating, 5)),
        pool_size: Math.max(10, Math.min(draft.pool_size, 200)),
        require_verified: draft.require_verified,
        excluded_paths: draft.excluded_paths,
        included_paths: draft.included_paths,
        dismiss_persistence: draft.dismiss_persistence,
      })
      .eq("id", true);
    setSaving(false);
    if (error) toast.error("Erro ao salvar: " + error.message);
    else toast.success("Configurações salvas! As mudanças refletem ao vivo.");
  };

  const handleReset = () => {
    setDraft(DEFAULTS);
    toast.info("Valores padrão carregados (clique em Salvar para aplicar).");
  };

  const pathsToText = (arr: string[]) => arr.join("\n");
  const textToPaths = (txt: string) =>
    txt
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-display flex items-center gap-2">
            <MessageCircle className="h-6 w-6 text-primary" />
            Prova Social Flutuante
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Mini-toast com avaliações reais (escolhidas aleatoriamente) e miniatura do produto.
            Mudanças são aplicadas <strong>ao vivo</strong> em todos os visitantes.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleReset} disabled={saving}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Restaurar padrão
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Salvar
          </Button>
        </div>
      </div>

      {/* Geral */}
      <Card>
        <CardHeader>
          <CardTitle>Status & Posição</CardTitle>
          <CardDescription>
            Ative/desative globalmente e escolha onde o card aparece.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label className="text-base">Ativar prova social</Label>
              <p className="text-xs text-muted-foreground">
                Quando desligado, o componente não é renderizado em nenhuma página.
              </p>
            </div>
            <Switch
              checked={draft.is_enabled}
              onCheckedChange={(v) => set("is_enabled", v)}
            />
          </div>

          <Separator />

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label>Posição na tela</Label>
              <Select
                value={draft.position}
                onValueChange={(v) => set("position", v as Settings["position"])}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bottom-left">Inferior esquerdo</SelectItem>
                  <SelectItem value="bottom-right">Inferior direito</SelectItem>
                  <SelectItem value="top-left">Superior esquerdo</SelectItem>
                  <SelectItem value="top-right">Superior direito</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Persistência ao fechar</Label>
              <Select
                value={draft.dismiss_persistence}
                onValueChange={(v) =>
                  set("dismiss_persistence", v as Settings["dismiss_persistence"])
                }
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="session">Esta sessão (volta no próximo acesso)</SelectItem>
                  <SelectItem value="never">Nunca mais (até limpar cache)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
              <Label>Exibir em mobile</Label>
              <Switch
                checked={draft.show_on_mobile}
                onCheckedChange={(v) => set("show_on_mobile", v)}
              />
            </div>
            <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
              <Label>Exibir em desktop</Label>
              <Switch
                checked={draft.show_on_desktop}
                onCheckedChange={(v) => set("show_on_desktop", v)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tempos */}
      <Card>
        <CardHeader>
          <CardTitle>Tempos (em milissegundos)</CardTitle>
          <CardDescription>
            1 segundo = 1000 ms. Ex.: 9000 = 9 segundos.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid md:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="delay">Atraso inicial</Label>
            <Input
              id="delay"
              type="number"
              min={0}
              max={120000}
              step={500}
              value={draft.initial_delay_ms}
              onChange={(e) => set("initial_delay_ms", Number(e.target.value))}
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Tempo até aparecer pela primeira vez.
            </p>
          </div>
          <div>
            <Label htmlFor="visible">Tempo visível</Label>
            <Input
              id="visible"
              type="number"
              min={2000}
              max={60000}
              step={500}
              value={draft.visible_ms}
              onChange={(e) => set("visible_ms", Number(e.target.value))}
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Quanto tempo cada toast fica na tela.
            </p>
          </div>
          <div>
            <Label htmlFor="interval">Intervalo entre toasts</Label>
            <Input
              id="interval"
              type="number"
              min={2000}
              max={600000}
              step={1000}
              value={draft.interval_ms}
              onChange={(e) => set("interval_ms", Number(e.target.value))}
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Pausa entre uma avaliação e a próxima.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Critérios das avaliações */}
      <Card>
        <CardHeader>
          <CardTitle>Critérios das avaliações</CardTitle>
          <CardDescription>
            Filtros aplicados antes de sortear aleatoriamente.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="min_rating">Nota mínima (1–5 estrelas)</Label>
            <Input
              id="min_rating"
              type="number"
              min={1}
              max={5}
              value={draft.min_rating}
              onChange={(e) => set("min_rating", Number(e.target.value))}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="pool_size">Tamanho do sorteio (10–200)</Label>
            <Input
              id="pool_size"
              type="number"
              min={10}
              max={200}
              value={draft.pool_size}
              onChange={(e) => set("pool_size", Number(e.target.value))}
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Quantas avaliações entram no pool aleatório.
            </p>
          </div>
          <div className="md:col-span-2 flex items-center justify-between gap-4 rounded-lg border border-border p-3">
            <div>
              <Label>Apenas avaliações verificadas</Label>
              <p className="text-xs text-muted-foreground">
                Mostra somente avaliações com selo de compra verificada.
              </p>
            </div>
            <Switch
              checked={draft.require_verified}
              onCheckedChange={(v) => set("require_verified", v)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Rotas */}
      <Card>
        <CardHeader>
          <CardTitle>Onde exibir</CardTitle>
          <CardDescription>
            Uma rota por linha. Use <code className="px-1 bg-muted rounded">*</code> no final para
            prefixos (ex.: <code className="px-1 bg-muted rounded">/admin*</code>).
          </CardDescription>
        </CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="excluded">Rotas excluídas (não exibir)</Label>
            <Textarea
              id="excluded"
              rows={6}
              value={pathsToText(draft.excluded_paths)}
              onChange={(e) => set("excluded_paths", textToPaths(e.target.value))}
              className="mt-1 font-mono text-xs"
              placeholder="/admin&#10;/acesso-restrito&#10;/rastrear"
            />
          </div>
          <div>
            <Label htmlFor="included">Rotas exclusivas (se vazio, exibe em todas)</Label>
            <Textarea
              id="included"
              rows={6}
              value={pathsToText(draft.included_paths)}
              onChange={(e) => set("included_paths", textToPaths(e.target.value))}
              className="mt-1 font-mono text-xs"
              placeholder="(vazio = todas as páginas, exceto excluídas)"
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2 sticky bottom-3">
        <Button onClick={handleSave} disabled={saving} size="lg">
          {saving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Salvar configurações
        </Button>
      </div>
    </div>
  );
}
