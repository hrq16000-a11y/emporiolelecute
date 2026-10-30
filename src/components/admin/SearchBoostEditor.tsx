// Fase 2 — Pinagem de produtos por termo de busca (search boosts).
// Permite ao lojista forçar produtos específicos no topo do resultado para
// campanhas sazonais (ex.: "dia das mães"), independentemente da similaridade
// trigram. Toda alteração invalida o cache da busca pública.

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Save, Loader2, Pin } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useDbProducts } from "@/hooks/useProducts";
import {
  useAdminBoosts,
  useDeleteBoost,
  useUpsertBoost,
  isBoostLive,
} from "@/hooks/useSearchAdmin";

interface Props {
  presetTerm?: string | null;
  onConsumePreset?: () => void;
}

/** ISO → valor aceito por <input type="datetime-local"> (horário local). */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export default function SearchBoostEditor({ presetTerm, onConsumePreset }: Props) {
  const { data: boosts, isLoading } = useAdminBoosts();
  const { data: products } = useDbProducts();
  const upsert = useUpsertBoost();
  const del = useDeleteBoost();
  const { toast } = useToast();

  const [term, setTerm] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [productId, setProductId] = useState<string>("");
  const [weight, setWeight] = useState(100);
  const [isActive, setIsActive] = useState(true);
  const [campaignLabel, setCampaignLabel] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");

  useEffect(() => {
    if (presetTerm) {
      setTerm(presetTerm);
      onConsumePreset?.();
    }
  }, [presetTerm]);


  const productOptions = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    const list = (products ?? []).filter((p) => p.is_active);
    if (!q) return list.slice(0, 30);
    return list.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 30);
  }, [products, productSearch]);

  const grouped = useMemo(() => {
    const out: Record<string, typeof boosts> = {};
    for (const b of boosts ?? []) {
      const key = b.term_normalized;
      if (!out[key]) out[key] = [] as any;
      (out[key] as any).push(b);
    }
    return out;
  }, [boosts]);

  const save = async () => {
    if (!term.trim() || !productId) {
      toast({ title: "Informe o termo e o produto", variant: "destructive" });
      return;
    }
    const starts = fromLocalInput(startsAt);
    const ends = fromLocalInput(endsAt);
    if (starts && ends && new Date(ends) <= new Date(starts)) {
      toast({ title: "Período inválido", description: "O fim deve ser depois do início.", variant: "destructive" });
      return;
    }
    try {
      await upsert.mutateAsync({
        term,
        product_id: productId,
        weight,
        is_active: isActive,
        campaign_label: campaignLabel,
        starts_at: starts,
        ends_at: ends,
      });
      toast({ title: "Produto pinado", description: "Aparecerá no topo da busca por esse termo." });
      setProductId("");
      setProductSearch("");
    } catch (e: any) {
      toast({ title: "Erro ao pinar", description: e.message, variant: "destructive" });
    }
  };


  const remove = async (id: string) => {
    await del.mutateAsync(id);
    toast({ title: "Pin removido" });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Pin className="h-4 w-4" /> Produtos pinados (Search Boost)
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Use para campanhas sazonais. Quando o cliente buscar pelo termo, os produtos pinados
          aparecem primeiro, ordenados pelo peso (maior = mais alto).
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3 border rounded-lg p-4 bg-muted/20">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label>Termo de busca</Label>
              <Input
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="ex.: dia das mães"
              />
            </div>
            <div>
              <Label>Peso (1–1000)</Label>
              <Input
                type="number"
                min="1"
                max="1000"
                value={weight}
                onChange={(e) => setWeight(parseInt(e.target.value, 10) || 100)}
              />
            </div>
          </div>
          <div>
            <Label>Produto</Label>
            <Input
              placeholder="Buscar produto…"
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
            />
            <div className="mt-2 max-h-48 overflow-y-auto border rounded-md divide-y">
              {productOptions.length === 0 ? (
                <p className="text-xs text-muted-foreground p-3">Nenhum produto encontrado.</p>
              ) : (
                productOptions.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setProductId(p.id)}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-muted ${
                      productId === p.id ? "bg-primary/10 font-medium" : ""
                    }`}
                  >
                    {p.name}
                    <span className="block text-xs text-muted-foreground">{p.slug}</span>
                  </button>
                ))
              )}
            </div>
          </div>
          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <Label>Campanha (opcional)</Label>
              <Input
                value={campaignLabel}
                onChange={(e) => setCampaignLabel(e.target.value)}
                placeholder="ex.: Dia das Mães 2026"
              />
            </div>
            <div>
              <Label>Início (opcional)</Label>
              <Input
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
              />
            </div>
            <div>
              <Label>Fim (opcional)</Label>
              <Input
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Com datas preenchidas, o boost entra e sai do ar automaticamente na janela definida.
            Sem datas, vale enquanto estiver ativo.
          </p>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Switch checked={isActive} onCheckedChange={setIsActive} id="boost-active" />
              <Label htmlFor="boost-active">Ativo</Label>
            </div>

            <Button onClick={save} disabled={upsert.isPending}>
              {upsert.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Pinar produto
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : Object.keys(grouped).length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Nenhum produto pinado ainda.
          </p>
        ) : (
          <div className="space-y-3">
            {Object.entries(grouped).map(([t, items]) => (
              <div key={t} className="border rounded-lg">
                <div className="px-3 py-2 bg-muted/40 border-b text-sm font-medium flex items-center gap-2">
                  <Pin className="h-3.5 w-3.5" />
                  {t}
                  <Badge variant="outline" className="ml-auto">
                    {items?.length} item(ns)
                  </Badge>
                </div>
                <ul className="divide-y">
                  {items?.map((b: any) => (
                    <li key={b.id} className="px-3 py-2 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm truncate">
                          {b.product_name ?? b.product_id}
                          {!b.is_active ? (
                            <Badge variant="outline" className="ml-2">Inativo</Badge>
                          ) : isBoostLive(b) ? (
                            <Badge variant="secondary" className="ml-2">No ar</Badge>
                          ) : (
                            <Badge variant="outline" className="ml-2">
                              {b.starts_at && new Date(b.starts_at) > new Date() ? "Agendado" : "Encerrado"}
                            </Badge>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          peso {b.weight} · {b.product_slug}
                          {b.campaign_label ? ` · ${b.campaign_label}` : ""}
                        </p>
                        {(b.starts_at || b.ends_at) && (
                          <p className="text-xs text-muted-foreground">
                            {b.starts_at ? new Date(b.starts_at).toLocaleString("pt-BR") : "—"}
                            {" → "}
                            {b.ends_at ? new Date(b.ends_at).toLocaleString("pt-BR") : "—"}
                          </p>
                        )}
                      </div>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="ghost" className="text-destructive">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remover este pin?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta ação não pode ser desfeita.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              className={buttonVariants({ variant: "destructive" })}
                              onClick={() => remove(b.id)}
                            >
                              Remover
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
