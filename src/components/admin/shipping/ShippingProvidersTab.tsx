import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useShippingProviders, type ShippingProvider } from "@/hooks/useShippingAdmin";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Pencil } from "lucide-react";

export default function ShippingProvidersTab() {
  const { data, isLoading, upsert } = useShippingProviders();
  const { toast } = useToast();
  const [editing, setEditing] = useState<ShippingProvider | null>(null);

  const toggle = async (p: ShippingProvider, active: boolean) => {
    try {
      await upsert.mutateAsync({ id: p.id, is_active: active });
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

  return (
    <div className="space-y-3">
      {(data ?? []).map((p) => (
        <div key={p.id} className="flex items-center justify-between p-4 border border-border rounded-lg bg-card">
          <div>
            <p className="font-medium text-foreground">{p.provider_name}</p>
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
      ))}

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
