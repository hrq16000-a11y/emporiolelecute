import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { RefreshCw, Download, ShieldCheck, AlertTriangle, Archive, ImageOff, Loader2 } from "lucide-react";

interface MissingAsset {
  img_ref: string;
  bucket: string;
  storage_path: string;
  entity_type: string | null;
  field: string | null;
  public_url: string | null;
}

interface InventorySummary {
  total: number;
  active: number;
  archived: number;
  missing: number;
  ran_at: string;
}

interface InventoryResponse {
  ok: boolean;
  summary: InventorySummary;
  missing: MissingAsset[];
}

const AdminMediaBackup = () => {
  const [generating, setGenerating] = useState(false);

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["admin", "media-backup", "inventory"],
    queryFn: async (): Promise<InventoryResponse> => {
      const { data, error } = await supabase.functions.invoke("admin-media-backup", {
        body: { action: "inventory" },
      });
      if (error) throw error;
      return data as InventoryResponse;
    },
  });

  const summary = data?.summary;
  const missing = data?.missing ?? [];

  const handleRefresh = async () => {
    const promise = refetch();
    toast.promise(promise, {
      loading: "Atualizando inventário de mídia...",
      success: "Inventário atualizado.",
      error: "Falha ao atualizar inventário.",
    });
  };

  const handleGenerateBackup = async () => {
    setGenerating(true);
    try {
      const { data: res, error } = await supabase.functions.invoke("admin-media-backup", {
        body: { action: "manifest" },
      });
      if (error) throw error;
      const manifest = (res as { manifest: unknown }).manifest;
      const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `media-manifest-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Manifesto de backup gerado e baixado.");
      refetch();
    } catch (e) {
      toast.error("Falha ao gerar o manifesto de backup.");
    } finally {
      setGenerating(false);
    }
  };

  const stats = [
    { label: "Total catalogado", value: summary?.total ?? "—", icon: ShieldCheck, tone: "" },
    { label: "Ativas (em uso)", value: summary?.active ?? "—", icon: ShieldCheck, tone: "text-emerald-600" },
    { label: "Sem uso (archived)", value: summary?.archived ?? "—", icon: Archive, tone: "text-amber-600" },
    { label: "Ausentes (perdidas)", value: summary?.missing ?? "—", icon: ImageOff, tone: "text-rose-600" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl">Backup de Mídia</h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Catálogo central de todas as imagens com referência estável{" "}
            <code className="text-xs bg-muted px-1 py-0.5 rounded">img_ref</code>, independente do
            identificador interno do armazenamento. Gere o manifesto para exportar tudo para um local externo seguro.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleRefresh} disabled={isFetching}>
            {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Atualizar inventário
          </Button>
          <Button onClick={handleGenerateBackup} disabled={generating || isLoading}>
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Gerar manifesto de backup
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((m) => (
          <Card key={m.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-muted-foreground flex items-center gap-1.5">
                <m.icon className="h-3.5 w-3.5" /> {m.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className={`text-3xl font-bold ${m.tone}`}>
                {isLoading ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /> : m.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-rose-200">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-rose-600" />
            Imagens ausentes
            <Badge variant="destructive">{missing.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && <p className="text-sm text-muted-foreground">Carregando inventário...</p>}
          {!isLoading && missing.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhuma imagem ausente — tudo íntegro ✨</p>
          )}
          <div className="space-y-1.5 max-h-[50vh] overflow-y-auto">
            {missing.map((m) => (
              <div
                key={m.img_ref}
                className="flex items-center justify-between gap-3 p-2.5 rounded-lg border text-xs"
              >
                <div className="min-w-0">
                  <p className="font-medium truncate">{m.storage_path}</p>
                  <p className="text-muted-foreground truncate">{m.img_ref}</p>
                </div>
                <Badge variant="outline" className="shrink-0">
                  {m.entity_type ?? "?"} · {m.field ?? "?"}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        O manifesto lista cada imagem por <code>img_ref</code> com a URL pública para download. A limpeza
        automática agora só remove imagens explicitamente sem uso e que já possuam backup registrado.
      </p>
    </div>
  );
};

export default AdminMediaBackup;
