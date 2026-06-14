import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Trash2, Save, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  useAdminProductFaqs,
  useUpsertProductFaq,
  useDeleteProductFaq,
  buildAutoFaq,
  type ProductFaq,
} from "@/hooks/useProductFaqs";

interface Props {
  productId: string;
  productName: string;
  productionDays?: number | null;
  personalizationEnabled?: boolean | null;
  categoryName?: string | null;
}

type Draft = Pick<ProductFaq, "id" | "question" | "answer" | "position" | "is_active">;

const emptyDraft = (position: number): Draft => ({
  id: "" as unknown as string,
  question: "",
  answer: "",
  position,
  is_active: true,
});

export default function ProductFaqEditor({
  productId,
  productName,
  productionDays,
  personalizationEnabled,
  categoryName,
}: Props) {
  const { data: faqs = [], isLoading } = useAdminProductFaqs(productId);
  const upsert = useUpsertProductFaq();
  const del = useDeleteProductFaq();
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});

  const currentDraft = (faq?: ProductFaq, idx = 0): Draft => {
    const key = faq?.id || `new-${idx}`;
    if (drafts[key]) return drafts[key];
    if (faq) return { id: faq.id, question: faq.question, answer: faq.answer, position: faq.position, is_active: faq.is_active };
    return emptyDraft(idx);
  };

  const update = (key: string, patch: Partial<Draft>) => {
    setDrafts((prev) => ({ ...prev, [key]: { ...currentDraft(faqs.find((f) => f.id === key), faqs.length), ...patch } }));
  };

  const save = async (faq: ProductFaq | undefined, key: string) => {
    const d = currentDraft(faq, faqs.length);
    if (!d.question.trim() || !d.answer.trim()) {
      toast.error("Preencha pergunta e resposta.");
      return;
    }
    try {
      await upsert.mutateAsync({
        id: faq?.id,
        product_id: productId,
        question: d.question.trim(),
        answer: d.answer.trim(),
        position: d.position,
        is_active: d.is_active,
      });
      setDrafts((prev) => {
        const { [key]: _, ...rest } = prev;
        return rest;
      });
      toast.success(faq ? "FAQ atualizada." : "FAQ criada.");
    } catch (e) {
      toast.error("Erro ao salvar FAQ.");
    }
  };

  const remove = async (faq: ProductFaq) => {
    try {
      await del.mutateAsync({ id: faq.id, product_id: productId });
      toast.success("FAQ removida.");
    } catch {
      toast.error("Erro ao remover.");
    }
  };

  const seedAuto = async () => {
    const items = buildAutoFaq({ productName, productionDays, personalizationEnabled, categoryName });
    try {
      for (let i = 0; i < items.length; i++) {
        await upsert.mutateAsync({
          product_id: productId,
          question: items[i].question,
          answer: items[i].answer,
          position: i,
          is_active: true,
        });
      }
      toast.success("3 perguntas-padrão adicionadas. Edite à vontade.");
    } catch {
      toast.error("Erro ao gerar FAQ automática.");
    }
  };

  return (
    <Card className="shadow-card">
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="text-lg font-display">FAQ do Produto</CardTitle>
          <CardDescription>
            Sem perguntas cadastradas? A página do produto mostra automaticamente 3 perguntas-padrão
            (ingredientes, durabilidade, personalização). Adicione abaixo para sobrescrever.
          </CardDescription>
        </div>
        {faqs.length === 0 && (
          <Button type="button" variant="outline" size="sm" onClick={seedAuto} disabled={upsert.isPending}>
            <Sparkles className="w-4 h-4 mr-1" />
            Gerar 3 perguntas-padrão
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading && (
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Carregando FAQ…
          </div>
        )}

        {faqs.map((faq, idx) => {
          const d = currentDraft(faq, idx);
          const dirty =
            d.question !== faq.question ||
            d.answer !== faq.answer ||
            d.position !== faq.position ||
            d.is_active !== faq.is_active;
          return (
            <div key={faq.id} className="rounded-lg border p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Badge variant="secondary">#{idx + 1}</Badge>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 text-xs">
                    <Switch
                      checked={d.is_active}
                      onCheckedChange={(v) => update(faq.id, { is_active: v })}
                    />
                    {d.is_active ? "Ativa" : "Oculta"}
                  </div>
                  <Input
                    type="number"
                    value={d.position}
                    onChange={(e) => update(faq.id, { position: Number(e.target.value) || 0 })}
                    className="w-20 h-8 text-xs"
                    title="Ordem"
                  />
                  <Button type="button" size="sm" variant="ghost" onClick={() => remove(faq)} disabled={del.isPending}>
                    <Trash2 className="w-4 h-4 text-rose-600" />
                  </Button>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Pergunta</Label>
                <Input value={d.question} onChange={(e) => update(faq.id, { question: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Resposta</Label>
                <Textarea rows={3} value={d.answer} onChange={(e) => update(faq.id, { answer: e.target.value })} />
              </div>
              {dirty && (
                <div className="flex justify-end">
                  <Button type="button" size="sm" onClick={() => save(faq, faq.id)} disabled={upsert.isPending}>
                    <Save className="w-4 h-4 mr-1" /> Salvar
                  </Button>
                </div>
              )}
            </div>
          );
        })}

        {/* Nova FAQ */}
        {(() => {
          const key = `new-${faqs.length}`;
          const d = currentDraft(undefined, faqs.length);
          return (
            <div className="rounded-lg border border-dashed p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Plus className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">Nova pergunta</span>
              </div>
              <Input
                placeholder="Pergunta"
                value={d.question}
                onChange={(e) => update(key, { question: e.target.value, position: faqs.length })}
              />
              <Textarea
                rows={3}
                placeholder="Resposta"
                value={d.answer}
                onChange={(e) => update(key, { answer: e.target.value, position: faqs.length })}
              />
              <div className="flex justify-end">
                <Button type="button" size="sm" onClick={() => save(undefined, key)} disabled={upsert.isPending || !d.question || !d.answer}>
                  <Plus className="w-4 h-4 mr-1" /> Adicionar FAQ
                </Button>
              </div>
            </div>
          );
        })()}
      </CardContent>
    </Card>
  );
}
