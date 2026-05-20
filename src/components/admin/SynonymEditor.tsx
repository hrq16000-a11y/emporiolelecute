// Fase 2 — Editor de sinônimos. Lista os existentes, permite adicionar/editar
// com aliases-como-tags e boost_score (peso de destaque). Toda alteração
// invalida o cache da busca pública via `invalidateSearchCaches` no hook.

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Save, Loader2, Tag, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  SearchSynonymRow,
  useAdminSynonyms,
  useDeleteSynonym,
  useUpsertSynonym,
} from "@/hooks/useSearchAdmin";

interface Props {
  presetCanonical?: string | null;
  onConsumePreset?: () => void;
}

type Draft = {
  id?: string;
  canonical_term: string;
  aliases: string[];
  boost_score: number;
  active: boolean;
  notes: string;
};

const empty = (): Draft => ({
  canonical_term: "",
  aliases: [],
  boost_score: 1,
  active: true,
  notes: "",
});

export default function SynonymEditor({ presetCanonical, onConsumePreset }: Props) {
  const { data, isLoading } = useAdminSynonyms();
  const upsert = useUpsertSynonym();
  const del = useDeleteSynonym();
  const { toast } = useToast();

  const [draft, setDraft] = useState<Draft>(empty());
  const [aliasInput, setAliasInput] = useState("");

  useEffect(() => {
    if (presetCanonical && !draft.id) {
      setDraft((d) => ({ ...d, canonical_term: presetCanonical }));
      onConsumePreset?.();
    }
  }, [presetCanonical]);

  const startEdit = (row: SearchSynonymRow) => {
    setDraft({
      id: row.id,
      canonical_term: row.canonical_term,
      aliases: row.aliases ?? [],
      boost_score: row.boost_score ?? 1,
      active: row.active,
      notes: row.notes ?? "",
    });
    setAliasInput("");
  };

  const addAlias = () => {
    const v = aliasInput.trim();
    if (!v) return;
    if (draft.aliases.includes(v)) return;
    setDraft((d) => ({ ...d, aliases: [...d.aliases, v] }));
    setAliasInput("");
  };

  const removeAlias = (a: string) =>
    setDraft((d) => ({ ...d, aliases: d.aliases.filter((x) => x !== a) }));

  const save = async () => {
    if (!draft.canonical_term.trim()) {
      toast({ title: "Termo canônico obrigatório", variant: "destructive" });
      return;
    }
    try {
      await upsert.mutateAsync({
        id: draft.id,
        canonical_term: draft.canonical_term,
        aliases: draft.aliases,
        boost_score: draft.boost_score,
        active: draft.active,
        notes: draft.notes || null,
      });
      toast({ title: "Sinônimo salvo", description: "A busca pública foi atualizada." });
      setDraft(empty());
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir este sinônimo?")) return;
    await del.mutateAsync(id);
    toast({ title: "Sinônimo removido" });
    if (draft.id === id) setDraft(empty());
  };

  const sorted = useMemo(
    () => [...(data ?? [])].sort((a, b) => a.canonical_term.localeCompare(b.canonical_term)),
    [data],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Tag className="h-4 w-4" /> Sinônimos da busca
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          O termo canônico é o "oficial". Aliases são variações que o cliente pode digitar
          (apelidos, erros comuns, formas regionais). O <strong>boost</strong> reforça a
          relevância na ordenação.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Editor */}
        <div className="space-y-3 border rounded-lg p-4 bg-muted/20">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label>Termo canônico</Label>
              <Input
                value={draft.canonical_term}
                onChange={(e) => setDraft({ ...draft, canonical_term: e.target.value })}
                placeholder="ex.: sabonete artesanal"
              />
            </div>
            <div>
              <Label>Boost score (1.0 = neutro)</Label>
              <Input
                type="number"
                step="0.1"
                min="0"
                value={draft.boost_score}
                onChange={(e) =>
                  setDraft({ ...draft, boost_score: parseFloat(e.target.value) || 1 })
                }
              />
            </div>
          </div>

          <div>
            <Label>Aliases (apelidos / erros comuns)</Label>
            <div className="flex gap-2 mt-1">
              <Input
                value={aliasInput}
                onChange={(e) => setAliasInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    addAlias();
                  }
                }}
                placeholder="Digite e tecle Enter…"
              />
              <Button type="button" variant="outline" onClick={addAlias}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {draft.aliases.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {draft.aliases.map((a) => (
                  <Badge key={a} variant="secondary" className="gap-1">
                    {a}
                    <button
                      type="button"
                      onClick={() => removeAlias(a)}
                      className="hover:text-destructive"
                      aria-label={`Remover ${a}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div>
            <Label>Notas internas (opcional)</Label>
            <Textarea
              rows={2}
              value={draft.notes}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              placeholder="Por que esse sinônimo existe? Ex.: campanha Dia das Mães."
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Switch
                checked={draft.active}
                onCheckedChange={(v) => setDraft({ ...draft, active: v })}
                id="syn-active"
              />
              <Label htmlFor="syn-active">Ativo</Label>
            </div>
            <div className="flex gap-2">
              {draft.id && (
                <Button variant="ghost" onClick={() => setDraft(empty())}>
                  Cancelar
                </Button>
              )}
              <Button onClick={save} disabled={upsert.isPending}>
                {upsert.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                {draft.id ? "Salvar alterações" : "Adicionar sinônimo"}
              </Button>
            </div>
          </div>
        </div>

        {/* Lista */}
        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : sorted.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Nenhum sinônimo cadastrado.
          </p>
        ) : (
          <ul className="divide-y border rounded-lg">
            {sorted.map((s) => (
              <li key={s.id} className="p-3 flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{s.canonical_term}</span>
                    {!s.active && <Badge variant="outline">Inativo</Badge>}
                    {s.boost_score !== 1 && (
                      <Badge variant="secondary">boost {s.boost_score}</Badge>
                    )}
                  </div>
                  {s.aliases?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {s.aliases.map((a) => (
                        <Badge key={a} variant="outline" className="text-xs font-normal">
                          {a}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {s.notes && (
                    <p className="text-xs text-muted-foreground mt-1">{s.notes}</p>
                  )}
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  <Button size="sm" variant="outline" onClick={() => startEdit(s)}>
                    Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => remove(s.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
