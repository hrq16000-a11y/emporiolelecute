import { useState } from "react";
import { useRedirects, useUpsertRedirect, useDeleteRedirect, type Redirect } from "@/hooks/useRedirects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const empty: Partial<Redirect> = { from_path: "", to_path: "", status_code: 301, is_active: true };

export default function AdminRedirects() {
  const { data: rows, isLoading } = useRedirects();
  const upsert = useUpsertRedirect();
  const del = useDeleteRedirect();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Partial<Redirect>>(empty);

  const save = async () => {
    if (!edit.from_path?.startsWith("/") || !edit.to_path) {
      toast({ title: "Caminhos devem começar com /", variant: "destructive" });
      return;
    }
    try {
      await upsert.mutateAsync(edit as any);
      toast({ title: "Redirect salvo" });
      setOpen(false);
      setEdit(empty);
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display">Redirects 301</h1>
          <p className="text-muted-foreground">Preserva SEO ao alterar slugs ou remover páginas.</p>
        </div>
        <Button onClick={() => { setEdit(empty); setOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" /> Novo
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Regras</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {isLoading && <p className="text-muted-foreground">Carregando...</p>}
          {rows?.length === 0 && <p className="text-muted-foreground">Nenhum redirect cadastrado.</p>}
          {rows?.map((r) => (
            <div key={r.id} className="flex items-center gap-3 p-3 border rounded-lg">
              <div className="flex-1 font-mono text-sm flex items-center gap-2 flex-wrap">
                <span className={r.is_active ? "text-foreground" : "text-muted-foreground line-through"}>{r.from_path}</span>
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                <span className="text-primary">{r.to_path}</span>
                <span className="text-xs text-muted-foreground">({r.status_code})</span>
              </div>
              <span className="text-xs text-muted-foreground">{r.hits} acessos</span>
              <Button size="sm" variant="ghost" onClick={() => { setEdit(r); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
              <Button size="sm" variant="ghost" onClick={() => del.mutate(r.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit.id ? "Editar" : "Novo"} redirect</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>De (caminho antigo)</Label>
              <Input placeholder="/produtos/lembrancinha-antiga (legado) ou /produto/nova" value={edit.from_path ?? ""} onChange={(e) => setEdit({ ...edit, from_path: e.target.value })} />
            </div>
            <div>
              <Label>Para (caminho novo)</Label>
              <Input placeholder="/produto/lembrancinha-nova" value={edit.to_path ?? ""} onChange={(e) => setEdit({ ...edit, to_path: e.target.value })} />
            </div>
            <div className="flex gap-4">
              <div className="flex-1">
                <Label>Status HTTP</Label>
                <select className="w-full border rounded h-10 px-3" value={edit.status_code ?? 301} onChange={(e) => setEdit({ ...edit, status_code: Number(e.target.value) })}>
                  <option value={301}>301 - Permanente (recomendado p/ SEO)</option>
                  <option value={302}>302 - Temporário</option>
                  <option value={307}>307 - Temporário (preserva método)</option>
                  <option value={308}>308 - Permanente (preserva método)</option>
                </select>
              </div>
              <div className="flex flex-col justify-end pb-1">
                <Label>Ativo</Label>
                <Switch checked={edit.is_active ?? true} onCheckedChange={(v) => setEdit({ ...edit, is_active: v })} />
              </div>
            </div>
            <div>
              <Label>Notas (opcional)</Label>
              <Input value={edit.notes ?? ""} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={upsert.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
