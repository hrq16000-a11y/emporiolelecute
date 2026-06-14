import { useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useShippingRules, type ShippingRule } from "@/hooks/useShippingAdmin";
import { useToast } from "@/hooks/use-toast";
import { Pencil, Plus, Trash2, Loader2 } from "lucide-react";

type FormState = Omit<ShippingRule, "id"> & { id?: string };

const empty: FormState = {
  rule_name: "",
  condition_type: "min_cart_value",
  condition_value: { value: 300 },
  discount_type: "free_shipping",
  discount_value: 0,
  is_active: true,
  priority: 0,
};

export default function ShippingRulesTab() {
  const { data, isLoading, create, update, remove } = useShippingRules();
  const { toast } = useToast();
  const [editing, setEditing] = useState<FormState | null>(null);

  const save = async () => {
    if (!editing) return;
    try {
      if (editing.id) {
        await update.mutateAsync(editing as any);
      } else {
        await create.mutateAsync(editing as any);
      }
      toast({ title: "Regra salva" });
      setEditing(null);
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const renderCondition = () => {
    if (!editing) return null;
    if (editing.condition_type === "min_cart_value") {
      return (
        <div>
          <Label>Valor mínimo do carrinho (R$)</Label>
          <Input type="number" step="0.01" value={editing.condition_value?.value ?? ""}
            onChange={(e) => setEditing({ ...editing, condition_value: { value: Number(e.target.value) } })} className="mt-1" />
        </div>
      );
    }
    if (editing.condition_type === "specific_state") {
      return (
        <div>
          <Label>Estados (UF, separados por vírgula)</Label>
          <Input value={(editing.condition_value?.states ?? []).join(",")}
            onChange={(e) => setEditing({ ...editing, condition_value: { states: e.target.value.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean) } })} className="mt-1" />
        </div>
      );
    }
    return (
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>CEP de</Label>
          <Input value={editing.condition_value?.from ?? ""}
            onChange={(e) => setEditing({ ...editing, condition_value: { ...editing.condition_value, from: e.target.value } })} className="mt-1" />
        </div>
        <div>
          <Label>CEP até</Label>
          <Input value={editing.condition_value?.to ?? ""}
            onChange={(e) => setEditing({ ...editing, condition_value: { ...editing.condition_value, to: e.target.value } })} className="mt-1" />
        </div>
      </div>
    );
  };

  if (isLoading) return <Loader2 className="h-4 w-4 animate-spin" />;

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={() => setEditing({ ...empty })}><Plus className="h-4 w-4 mr-1" /> Nova regra</Button>
      </div>
      {(data ?? []).map((r) => (
        <div key={r.id} className="flex items-center justify-between p-4 border border-border rounded-lg bg-card">
          <div>
            <p className="font-medium text-foreground">{r.rule_name}</p>
            <p className="text-xs text-muted-foreground">{r.condition_type} → {r.discount_type} {r.discount_value ? `(${r.discount_value})` : ""}</p>
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={r.is_active} onCheckedChange={(v) => update.mutate({ id: r.id, is_active: v })} />
            <Button size="sm" variant="outline" onClick={() => setEditing(r)}><Pencil className="h-3 w-3" /></Button>
            <Button size="sm" variant="outline" onClick={() => { if (confirm("Excluir regra?")) remove.mutate(r.id); }}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
      ))}
      {(data ?? []).length === 0 && <p className="text-sm text-muted-foreground">Nenhuma regra cadastrada.</p>}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing?.id ? "Editar regra" : "Nova regra"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div>
                <Label>Nome</Label>
                <Input value={editing.rule_name} onChange={(e) => setEditing({ ...editing, rule_name: e.target.value })} className="mt-1" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Tipo de condição</Label>
                  <Select value={editing.condition_type} onValueChange={(v: any) => setEditing({ ...editing, condition_type: v, condition_value: {} })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="min_cart_value">Valor mínimo do carrinho</SelectItem>
                      <SelectItem value="specific_state">Estado específico</SelectItem>
                      <SelectItem value="zip_code_range">Faixa de CEP</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Desconto</Label>
                  <Select value={editing.discount_type} onValueChange={(v: any) => setEditing({ ...editing, discount_type: v })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="free_shipping">Frete grátis</SelectItem>
                      <SelectItem value="fixed_discount">Desconto fixo (R$)</SelectItem>
                      <SelectItem value="percentage_discount">Desconto (%)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {renderCondition()}
              {editing.discount_type !== "free_shipping" && (
                <div>
                  <Label>Valor do desconto</Label>
                  <Input type="number" step="0.01" value={editing.discount_value}
                    onChange={(e) => setEditing({ ...editing, discount_value: Number(e.target.value) })} className="mt-1" />
                </div>
              )}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Switch checked={editing.is_active} onCheckedChange={(v) => setEditing({ ...editing, is_active: v })} />
                  <span className="text-sm">Ativa</span>
                </div>
                <div>
                  <Label className="text-xs">Prioridade</Label>
                  <Input className="w-20" type="number" value={editing.priority}
                    onChange={(e) => setEditing({ ...editing, priority: Number(e.target.value) })} />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={save}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
