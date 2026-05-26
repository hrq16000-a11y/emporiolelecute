import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useShippingSettings } from "@/hooks/useShippingAdmin";
import { useToast } from "@/hooks/use-toast";
import { useFormDraft } from "@/hooks/useFormDraft";
import { Loader2, Power, Store, Gift } from "lucide-react";

export default function ShippingSettingsTab() {
  const { data, isLoading, update } = useShippingSettings();
  const { toast } = useToast();
  const [form, setForm] = useState<any>(null);
  const draft = useFormDraft(form, !!form);

  // Hidratação: primeiro tenta restaurar rascunho global; senão, usa o DB.
  useEffect(() => {
    if (!data || form) return;
    const saved = draft.hydrate<any>();
    setForm(saved ?? data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  if (isLoading || !form) {
    return <div className="flex items-center gap-2 text-muted-foreground p-8"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</div>;
  }

  const save = async () => {
    try {
      await update.mutateAsync({
        id: form.id,
        is_enabled: !!form.is_enabled,
        origin_zip_code: String(form.origin_zip_code ?? "").replace(/\D/g, ""),
        default_box_weight_kg: Number(form.default_box_weight_kg),
        default_box_length_cm: Number(form.default_box_length_cm),
        default_box_width_cm: Number(form.default_box_width_cm),
        default_box_height_cm: Number(form.default_box_height_cm),
        handling_fee: Number(form.handling_fee),
        shipping_markup_percentage: Number(form.shipping_markup_percentage),
        pickup_enabled: !!form.pickup_enabled,
        pickup_label: String(form.pickup_label ?? "").trim() || "Retirada no ateliê",
        pickup_address: String(form.pickup_address ?? "").trim(),
        pickup_instructions: String(form.pickup_instructions ?? "").trim(),
      });
      draft.clear();
      toast({ title: "Configurações salvas" });
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    }
  };

  const toggleEnabled = async (checked: boolean) => {
    setForm({ ...form, is_enabled: checked });
    try {
      await update.mutateAsync({ id: form.id, is_enabled: checked } as any);
      toast({
        title: checked ? "Módulo de frete habilitado" : "Módulo de frete desabilitado",
        description: checked
          ? "O cálculo de frete voltou a ficar disponível no carrinho."
          : "O cálculo de frete foi ocultado no carrinho.",
      });
    } catch (e: any) {
      setForm({ ...form, is_enabled: !checked });
      toast({ title: "Erro ao alternar status", description: e.message, variant: "destructive" });
    }
  };

  const field = (label: string, key: string, type: "text" | "number" = "number", step?: string) => (
    <div>
      <Label htmlFor={key}>{label}</Label>
      <Input id={key} type={type} step={step} value={form[key] ?? ""} onChange={(e) => setForm({ ...form, [key]: e.target.value })} className="mt-1" disabled={!form.is_enabled} />
    </div>
  );

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Master switch: habilitar/desabilitar módulo de frete globalmente */}
      <section className={`rounded-lg border p-4 flex items-center justify-between gap-4 transition-colors ${
        form.is_enabled ? "border-emerald-500/30 bg-emerald-500/5" : "border-destructive/30 bg-destructive/5"
      }`}>
        <div className="flex items-start gap-3">
          <Power className={`h-5 w-5 mt-0.5 ${form.is_enabled ? "text-emerald-600" : "text-destructive"}`} />
          <div>
            <Label htmlFor="is_enabled" className="text-sm font-semibold text-foreground cursor-pointer">
              Módulo de Frete {form.is_enabled ? "Ativo" : "Desativado"}
            </Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              {form.is_enabled
                ? "O cálculo de frete está disponível no carrinho dos clientes."
                : "O cálculo de frete está oculto. Os pedidos seguem combinados pelo WhatsApp."}
            </p>
          </div>
        </div>
        <Switch
          id="is_enabled"
          checked={!!form.is_enabled}
          onCheckedChange={toggleEnabled}
          disabled={update.isPending}
          aria-label="Habilitar ou desabilitar módulo de frete"
        />
      </section>

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

      {/* Retirada no Local — opção adicional, exibida ao cliente quando habilitada */}
      <section className={`rounded-lg border p-4 space-y-4 transition-colors ${
        form.pickup_enabled ? "border-primary/30 bg-primary/5" : "border-border"
      }`}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <Store className={`h-5 w-5 mt-0.5 ${form.pickup_enabled ? "text-primary" : "text-muted-foreground"}`} />
            <div>
              <Label htmlFor="pickup_enabled" className="text-sm font-semibold text-foreground cursor-pointer">
                Retirada no Local {form.pickup_enabled ? "Disponível" : "Desativada"}
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Quando ativa, o cliente vê a opção de retirar o pedido sem custo de frete no carrinho.
              </p>
            </div>
          </div>
          <Switch
            id="pickup_enabled"
            checked={!!form.pickup_enabled}
            onCheckedChange={(checked) => setForm({ ...form, pickup_enabled: checked })}
            disabled={!form.is_enabled}
            aria-label="Habilitar opção de retirada no local"
          />
        </div>

        {form.pickup_enabled && (
          <div className="space-y-3 pl-8">
            <div>
              <Label htmlFor="pickup_label">Rótulo exibido ao cliente</Label>
              <Input
                id="pickup_label"
                value={form.pickup_label ?? ""}
                onChange={(e) => setForm({ ...form, pickup_label: e.target.value })}
                placeholder="Ex.: Retirada no ateliê"
                className="mt-1"
                maxLength={80}
              />
            </div>
            <div>
              <Label htmlFor="pickup_address">Endereço de retirada</Label>
              <Input
                id="pickup_address"
                value={form.pickup_address ?? ""}
                onChange={(e) => setForm({ ...form, pickup_address: e.target.value })}
                placeholder="Rua, número, bairro, cidade/UF"
                className="mt-1"
                maxLength={200}
              />
            </div>
            <div>
              <Label htmlFor="pickup_instructions">Instruções (horários, observações)</Label>
              <Textarea
                id="pickup_instructions"
                value={form.pickup_instructions ?? ""}
                onChange={(e) => setForm({ ...form, pickup_instructions: e.target.value })}
                placeholder="Ex.: Seg a Sex, 9h–18h. Agendar pelo WhatsApp antes de retirar."
                className="mt-1 min-h-[80px]"
                maxLength={500}
              />
            </div>
          </div>
        )}
      </section>

      <Button onClick={save} disabled={update.isPending || !form.is_enabled}>
        {update.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        Salvar configurações
      </Button>
    </div>
  );
}
