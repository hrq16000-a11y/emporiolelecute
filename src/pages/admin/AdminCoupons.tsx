import { useState } from "react";
import { useCoupons, useUpsertCoupon, useDeleteCoupon, type Coupon } from "@/hooks/useCoupons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Tag } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const empty: Partial<Coupon> = {
  code: "",
  discount_type: "percent",
  discount_value: 10,
  min_subtotal: 0,
  is_active: true,
};

export default function AdminCoupons() {
  const { data: rows, isLoading } = useCoupons();
  const upsert = useUpsertCoupon();
  const del = useDeleteCoupon();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Partial<Coupon>>(empty);

  const save = async () => {
    if (!edit.code?.trim()) {
      toast({ title: "Código obrigatório", variant: "destructive" });
      return;
    }
    try {
      await upsert.mutateAsync(edit as any);
      toast({ title: "Cupom salvo" });
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
          <h1 className="text-2xl sm:text-3xl font-display">Cupons</h1>
          <p className="text-muted-foreground">Descontos globais aplicados no carrinho.</p>
        </div>
        <Button onClick={() => { setEdit(empty); setOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" /> Novo
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Cupons cadastrados</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {isLoading && <p className="text-muted-foreground">Carregando...</p>}
          {rows?.length === 0 && <p className="text-muted-foreground">Nenhum cupom cadastrado.</p>}
          {rows?.map((c) => (
            <div key={c.id} className="flex items-center gap-3 p-3 border rounded-lg flex-wrap">
              <Tag className="h-4 w-4 text-primary" />
              <code className="font-mono font-bold">{c.code}</code>
              <Badge variant={c.is_active ? "default" : "secondary"}>{c.is_active ? "Ativo" : "Inativo"}</Badge>
              <span className="text-sm">
                {c.discount_type === "percent"
                  ? `${c.discount_value}% off`
                  : `R$ ${Number(c.discount_value).toFixed(2)} off`}
              </span>
              {c.min_subtotal > 0 && (
                <span className="text-xs text-muted-foreground">min R$ {Number(c.min_subtotal).toFixed(2)}</span>
              )}
              <span className="text-xs text-muted-foreground ml-auto">
                {c.used_count}{c.max_uses ? `/${c.max_uses}` : ""} usos
              </span>
              <Button size="sm" variant="ghost" onClick={() => { setEdit(c); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
              <Button size="sm" variant="ghost" onClick={() => del.mutate(c.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{edit.id ? "Editar" : "Novo"} cupom</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Código</Label>
              <Input className="font-mono uppercase" value={edit.code ?? ""} onChange={(e) => setEdit({ ...edit, code: e.target.value.toUpperCase() })} />
            </div>
            <div>
              <Label>Descrição (opcional)</Label>
              <Input value={edit.description ?? ""} onChange={(e) => setEdit({ ...edit, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tipo</Label>
                <select className="w-full border rounded h-10 px-3" value={edit.discount_type} onChange={(e) => setEdit({ ...edit, discount_type: e.target.value as any })}>
                  <option value="percent">Percentual</option>
                  <option value="fixed">Valor fixo (R$)</option>
                </select>
              </div>
              <div>
                <Label>Valor {edit.discount_type === "percent" ? "(%)" : "(R$)"}</Label>
                <Input type="number" step="0.01" value={edit.discount_value ?? 0} onChange={(e) => setEdit({ ...edit, discount_value: Number(e.target.value) })} />
              </div>
            </div>
            <div>
              <Label>Valor mínimo do pedido (R$)</Label>
              <Input type="number" step="0.01" value={edit.min_subtotal ?? 0} onChange={(e) => setEdit({ ...edit, min_subtotal: Number(e.target.value) })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Válido a partir de</Label>
                <Input type="datetime-local" value={edit.valid_from?.slice(0, 16) ?? ""} onChange={(e) => setEdit({ ...edit, valid_from: e.target.value ? new Date(e.target.value).toISOString() : null })} />
              </div>
              <div>
                <Label>Válido até</Label>
                <Input type="datetime-local" value={edit.valid_until?.slice(0, 16) ?? ""} onChange={(e) => setEdit({ ...edit, valid_until: e.target.value ? new Date(e.target.value).toISOString() : null })} />
              </div>
            </div>
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <Label>Limite de usos (vazio = ilimitado)</Label>
                <Input type="number" value={edit.max_uses ?? ""} onChange={(e) => setEdit({ ...edit, max_uses: e.target.value ? Number(e.target.value) : null })} />
              </div>
              <div className="flex flex-col">
                <Label>Ativo</Label>
                <Switch checked={edit.is_active ?? true} onCheckedChange={(v) => setEdit({ ...edit, is_active: v })} />
              </div>
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
