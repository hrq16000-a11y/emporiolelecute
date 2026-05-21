// Painel admin para gerenciar o banner de consentimento LGPD.
import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Cookie, Save, Eye } from "lucide-react";

type Cfg = {
  id?: string;
  is_enabled: boolean;
  title: string;
  message: string;
  accept_label: string;
  reject_label: string;
  policy_label: string;
  policy_url: string;
  delay_ms: number;
  position: "bottom" | "top";
  variant: "compact" | "full";
  show_icon: boolean;
};

const DEFAULTS: Cfg = {
  is_enabled: true,
  title: "Sua privacidade importa 🍪",
  message:
    "Usamos cookies para melhorar sua experiência e mostrar produtos relevantes. Aceite para liberar tudo ou recuse para o essencial.",
  accept_label: "Aceitar",
  reject_label: "Recusar",
  policy_label: "Política de Privacidade",
  policy_url: "/politica-de-privacidade",
  delay_ms: 1500,
  position: "bottom",
  variant: "compact",
  show_icon: true,
};

export default function AdminCookieConsent() {
  const [cfg, setCfg] = useState<Cfg>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("cookie_consent_config")
        .select("*")
        .limit(1)
        .maybeSingle();
      if (error) toast.error("Erro ao carregar configuração");
      if (data) setCfg({ ...DEFAULTS, ...data } as Cfg);
      setLoading(false);
    })();
  }, []);

  const update = <K extends keyof Cfg>(k: K, v: Cfg[K]) => setCfg((p) => ({ ...p, [k]: v }));

  async function save() {
    if (!cfg.id) {
      toast.error("Configuração não inicializada");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("cookie_consent_config")
      .update({
        is_enabled: cfg.is_enabled,
        title: cfg.title,
        message: cfg.message,
        accept_label: cfg.accept_label,
        reject_label: cfg.reject_label,
        policy_label: cfg.policy_label,
        policy_url: cfg.policy_url,
        delay_ms: cfg.delay_ms,
        position: cfg.position,
        variant: cfg.variant,
        show_icon: cfg.show_icon,
      })
      .eq("id", cfg.id);
    setSaving(false);
    if (error) toast.error("Falha ao salvar: " + error.message);
    else toast.success("Banner atualizado!");
  }

  function resetConsent() {
    try {
      localStorage.removeItem("elc_consent");
      toast.success("Consentimento resetado. Abra o site em outra aba para ver o banner.");
    } catch {}
  }

  if (loading) return <div className="p-6 text-muted-foreground">Carregando…</div>;

  return (
    <>
      <Helmet>
        <title>Banner de Consentimento | Admin</title>
      </Helmet>
      <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Cookie className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-heading">Banner de Consentimento (LGPD)</h1>
              <p className="text-sm text-muted-foreground">
                Controle textos, posição, formato e ativação do banner exibido no site.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={resetConsent}>
              <Eye className="w-4 h-4 mr-2" /> Resetar consentimento
            </Button>
            <Button onClick={save} disabled={saving}>
              <Save className="w-4 h-4 mr-2" /> {saving ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Conteúdo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm">Banner ativo</Label>
                  <p className="text-xs text-muted-foreground">Desligar oculta o banner para todos.</p>
                </div>
                <Switch checked={cfg.is_enabled} onCheckedChange={(v) => update("is_enabled", v)} />
              </div>

              <div>
                <Label htmlFor="t">Título</Label>
                <Input id="t" value={cfg.title} maxLength={120} onChange={(e) => update("title", e.target.value)} />
              </div>
              <div>
                <Label htmlFor="m">Mensagem</Label>
                <Textarea id="m" rows={3} maxLength={500} value={cfg.message}
                  onChange={(e) => update("message", e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="a">Botão aceitar</Label>
                  <Input id="a" maxLength={30} value={cfg.accept_label}
                    onChange={(e) => update("accept_label", e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="r">Botão recusar</Label>
                  <Input id="r" maxLength={30} value={cfg.reject_label}
                    onChange={(e) => update("reject_label", e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="pl">Texto do link</Label>
                  <Input id="pl" maxLength={60} value={cfg.policy_label}
                    onChange={(e) => update("policy_label", e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="pu">URL da política</Label>
                  <Input id="pu" maxLength={200} value={cfg.policy_url}
                    onChange={(e) => update("policy_url", e.target.value)} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Aparência & comportamento</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Variante</Label>
                  <Select value={cfg.variant} onValueChange={(v) => update("variant", v as Cfg["variant"])}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="compact">Compacto (pílula)</SelectItem>
                      <SelectItem value="full">Completo (card)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Posição</Label>
                  <Select value={cfg.position} onValueChange={(v) => update("position", v as Cfg["position"])}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bottom">Rodapé</SelectItem>
                      <SelectItem value="top">Topo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label htmlFor="d">Atraso de exibição (ms)</Label>
                <Input id="d" type="number" min={0} max={20000} value={cfg.delay_ms}
                  onChange={(e) => update("delay_ms", Math.max(0, Math.min(20000, Number(e.target.value) || 0)))} />
                <p className="text-xs text-muted-foreground mt-1">Evita atrapalhar o carregamento (LCP).</p>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm">Mostrar ícone</Label>
                  <p className="text-xs text-muted-foreground">Cookie ao lado do texto (apenas em telas ≥ sm).</p>
                </div>
                <Switch checked={cfg.show_icon} onCheckedChange={(v) => update("show_icon", v)} />
              </div>

              <div className="pt-2">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Pré-visualização</Label>
                <div className="mt-2 rounded-2xl border border-dashed border-border bg-muted/30 p-3">
                  <div className="bg-card border border-border shadow-sm rounded-full py-2 pl-3 pr-2 flex items-center gap-2 text-xs">
                    {cfg.show_icon && (
                      <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Cookie className="w-3 h-3 text-primary" />
                      </div>
                    )}
                    <span className="truncate">
                      <span className="font-medium">{cfg.title}</span>{" "}
                      <span className="text-muted-foreground">{cfg.message}</span>
                    </span>
                    <button className="h-7 px-2 rounded-full border text-[11px] shrink-0">{cfg.reject_label}</button>
                    <button className="h-7 px-2 rounded-full bg-primary text-primary-foreground text-[11px] shrink-0">
                      {cfg.accept_label}
                    </button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
