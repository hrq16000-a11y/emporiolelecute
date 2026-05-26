import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useShippingProviders, type ShippingProvider } from "@/hooks/useShippingAdmin";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Pencil, AlertTriangle, ShieldOff, CheckCircle2 } from "lucide-react";

// Provedores que só funcionam com credenciais válidas (api_key + endpoint).
const REQUIRES_CREDENTIALS = new Set(["melhor_envio"]);

function isMisconfigured(p: ShippingProvider) {
  return REQUIRES_CREDENTIALS.has(p.provider_code) && (!p.api_key || !p.endpoint_url);
}

export default function ShippingProvidersTab() {
  const { data, isLoading, upsert } = useShippingProviders();
  const { toast } = useToast();
  const [editing, setEditing] = useState<ShippingProvider | null>(null);

  const toggle = async (p: ShippingProvider, active: boolean) => {
    // Bloqueia ativar provedor sem credenciais — evita cotação quebrada.
    if (active && isMisconfigured(p)) {
      toast({
        title: "Credenciais ausentes",
        description: "Configure API Key e Endpoint antes de ativar este provedor.",
        variant: "destructive",
      });
      return;
    }
    try {
      await upsert.mutateAsync({ id: p.id, is_active: active });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const safeDeactivate = async (p: ShippingProvider) => {
    try {
      await upsert.mutateAsync({ id: p.id, is_active: false });
      toast({ title: "Provedor desativado", description: `${p.provider_name} foi desativado com segurança.` });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const save = async () => {
    if (!editing) return;
    try {
      await upsert.mutateAsync({
        id: editing.id,
        api_key: editing.api_key,
        api_secret: editing.api_secret,
        endpoint_url: editing.endpoint_url,
      });
      toast({ title: "Provedor atualizado" });
      setEditing(null);
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  if (isLoading) return <Loader2 className="h-4 w-4 animate-spin" />;

  const misconfiguredActive = (data ?? []).filter((p) => p.is_active && isMisconfigured(p));

  return (
    <div className="space-y-3">
      {misconfiguredActive.length > 0 && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4"
        >
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div className="flex-1 text-sm">
            <p className="font-medium text-destructive">
              {misconfiguredActive.length === 1
                ? "1 provedor ativo está sem credenciais"
                : `${misconfiguredActive.length} provedores ativos estão sem credenciais`}
            </p>
            <p className="text-muted-foreground mt-1">
              Cotações desses provedores falham e o sistema cai para valores estimados.
              Configure as credenciais ou desative com segurança.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {misconfiguredActive.map((p) => (
                <Button
                  key={p.id}
                  size="sm"
                  variant="destructive"
                  onClick={() => safeDeactivate(p)}
                  disabled={upsert.isPending}
                >
                  <ShieldOff className="h-3 w-3 mr-1.5" /> Desativar {p.provider_name}
                </Button>
              ))}
            </div>
          </div>
        </div>
      )}

      {(data ?? []).map((p) => {
        const broken = isMisconfigured(p);
        return (
          <div
            key={p.id}
            className={`flex items-center justify-between p-4 border rounded-lg bg-card ${
              broken && p.is_active ? "border-destructive/40" : "border-border"
            }`}
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-medium text-foreground">{p.provider_name}</p>
                {broken ? (
                  <span className="inline-flex items-center gap-1 text-xs text-destructive">
                    <AlertTriangle className="h-3 w-3" /> sem credenciais
                  </span>
                ) : REQUIRES_CREDENTIALS.has(p.provider_code) ? (
                  <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="h-3 w-3" /> credenciais OK
                  </span>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground">{p.provider_code}</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch checked={p.is_active} onCheckedChange={(v) => toggle(p, v)} />
                <span className="text-sm text-muted-foreground">{p.is_active ? "Ativo" : "Inativo"}</span>
              </div>
              <Button variant="outline" size="sm" onClick={() => setEditing(p)}>
                <Pencil className="h-3 w-3 mr-1" /> Editar
              </Button>
            </div>
          </div>
        );
      })}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Credenciais — {editing?.provider_name}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div>
                <Label>Endpoint URL</Label>
                <Input value={editing.endpoint_url ?? ""} onChange={(e) => setEditing({ ...editing, endpoint_url: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label>API Key / Token</Label>
                <Input type="password" value={editing.api_key ?? ""} onChange={(e) => setEditing({ ...editing, api_key: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label>API Secret (opcional)</Label>
                <Input type="password" value={editing.api_secret ?? ""} onChange={(e) => setEditing({ ...editing, api_secret: e.target.value })} className="mt-1" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={save} disabled={upsert.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
