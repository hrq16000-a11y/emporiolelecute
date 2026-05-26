import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useShippingSettings } from "@/hooks/useShippingAdmin";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

export default function ShippingSettingsTab() {
  const { data, isLoading, update } = useShippingSettings();
  const { toast } = useToast();
  const [form, setForm] = useState<any>(null);

  useEffect(() => { if (data) setForm(data); }, [data]);

  if (isLoading || !form) {
    return <div className="flex items-center gap-2 text-muted-foreground p-8"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</div>;
  }

  const save = async () => {
    try {
      await update.mutateAsync({
        id: form.id,
        origin_zip_code: String(form.origin_zip_code ?? "").replace(/\D/g, ""),
        default_box_weight_kg: Number(form.default_box_weight_kg),
        default_box_length_cm: Number(form.default_box_length_cm),
        default_box_width_cm: Number(form.default_box_width_cm),
        default_box_height_cm: Number(form.default_box_height_cm),
        handling_fee: Number(form.handling_fee),
        shipping_markup_percentage: Number(form.shipping_markup_percentage),
      });
      toast({ title: "Configurações salvas" });
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    }
  };

  const field = (label: string, key: string, type: "text" | "number" = "number", step?: string) => (
    <div>
      <Label htmlFor={key}>{label}</Label>
      <Input id={key} type={type} step={step} value={form[key] ?? ""} onChange={(e) => setForm({ ...form, [key]: e.target.value })} className="mt-1" />
    </div>
  );

  return (
    <div className="space-y-6 max-w-2xl">
      <section className="grid md:grid-cols-2 gap-4">
        {field("CEP de Origem", "origin_zip_code", "text")}
        {field("Taxa de Manuseio (R$)", "handling_fee", "number", "0.01")}
        {field("Margem / Markup (%)", "shipping_markup_percentage", "number", "0.01")}
      </section>
      <section>
        <h3 className="text-sm font-medium mb-3 text-foreground">Caixa Padrão (fallback)</h3>
        <div className="grid md:grid-cols-4 gap-4">
          {field("Peso (kg)", "default_box_weight_kg", "number", "0.001")}
          {field("Compr. (cm)", "default_box_length_cm", "number", "0.1")}
          {field("Larg. (cm)", "default_box_width_cm", "number", "0.1")}
          {field("Alt. (cm)", "default_box_height_cm", "number", "0.1")}
        </div>
      </section>
      <Button onClick={save} disabled={update.isPending}>
        {update.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        Salvar configurações
      </Button>
    </div>
  );
}
