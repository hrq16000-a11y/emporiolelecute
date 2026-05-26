import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, Truck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/format";

export type ShippingOption = {
  provider: string;
  service_name: string;
  price: number;
  estimated_delivery_days: string;
};

type Item = {
  product_id?: string;
  name: string;
  quantity: number;
  unit_price?: number;
  weight_kg?: number;
  width?: number;
  height?: number;
  length?: number;
  requires_shipping?: boolean;
};

interface Props {
  items: Item[];
  state?: string;
  initialCep?: string;
  onSelect?: (opt: ShippingOption | null) => void;
}

const ERROR_MSG =
  "Não foi possível calcular o frete para este CEP. Verifique o número ou entre em contato com o suporte.";

function maskCep(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

export default function ShippingCalculator({ items, state, initialCep = "", onSelect }: Props) {
  const [cep, setCep] = useState(initialCep);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [options, setOptions] = useState<ShippingOption[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [moduleEnabled, setModuleEnabled] = useState<boolean | null>(null);

  // Verifica se o módulo de frete está habilitado no admin
  useEffect(() => {
    let cancelled = false;
    supabase
      .from("shipping_settings")
      .select("is_enabled")
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setModuleEnabled(data?.is_enabled !== false);
      });
    return () => { cancelled = true; };
  }, []);

  const calculate = async () => {
    setError(null);
    setOptions(null);
    setSelected(null);
    onSelect?.(null);
    const clean = cep.replace(/\D/g, "");
    if (clean.length !== 8) {
      setError(ERROR_MSG);
      return;
    }
    setLoading(true);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("calculate-shipping", {
        body: { cep_destino: cep, state, items },
      });
      if (fnErr) throw fnErr;
      const opts: ShippingOption[] = data?.options ?? [];
      if (!opts.length) {
        setError(ERROR_MSG);
        return;
      }
      setOptions(opts);
      const cheapest = opts[0];
      setSelected(optionKey(cheapest));
      onSelect?.(cheapest);
    } catch (e) {
      console.error("[shipping] error", e);
      setError(ERROR_MSG);
    } finally {
      setLoading(false);
    }
  };

  const optionKey = (o: ShippingOption) => `${o.provider}|${o.service_name}`;

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <Label htmlFor="ship-cep">CEP de entrega</Label>
          <Input
            id="ship-cep"
            inputMode="numeric"
            placeholder="00000-000"
            value={cep}
            onChange={(e) => setCep(maskCep(e.target.value))}
            maxLength={9}
            className="mt-1"
          />
        </div>
        <Button onClick={calculate} disabled={loading} className="bg-primary hover:bg-primary-dark text-primary-foreground">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Calcular"}
        </Button>
      </div>

      {loading && (
        <div className="space-y-2">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      )}

      {error && (
        <div role="alert" className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-3">
          {error}
        </div>
      )}

      {options && options.length > 0 && (
        <RadioGroup
          value={selected ?? ""}
          onValueChange={(v) => {
            setSelected(v);
            const found = options.find((o) => optionKey(o) === v) ?? null;
            onSelect?.(found);
          }}
          className="space-y-2"
        >
          {options.map((o) => {
            const key = optionKey(o);
            return (
              <Label
                key={key}
                htmlFor={key}
                className="flex items-center justify-between gap-3 border border-border rounded-lg p-3 cursor-pointer hover:border-primary transition-colors"
              >
                <div className="flex items-center gap-3">
                  <RadioGroupItem id={key} value={key} />
                  <Truck className="h-4 w-4 text-primary" />
                  <div>
                    <p className="font-medium text-foreground text-sm">{o.service_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {o.provider} · {o.estimated_delivery_days} dias úteis
                    </p>
                  </div>
                </div>
                <span className="font-semibold text-foreground">
                  {o.price === 0 ? "Grátis" : formatBRL(o.price)}
                </span>
              </Label>
            );
          })}
        </RadioGroup>
      )}
    </div>
  );
}
