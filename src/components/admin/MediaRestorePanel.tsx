import { useState, useCallback, useRef } from "react";
import JSZip from "jszip";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  Upload,
  PackageOpen,
  RotateCcw,
  Loader2,
  CheckCircle2,
  FileArchive,
  Link2,
  Eye,
  ArrowRight,
} from "lucide-react";

interface RelinkPreviewRow {
  img_ref: string;
  entity_type: string | null;
  name: string | null;
  table: string;
  column: string;
  current_url: string | null;
  new_url: string | null;
  will_change: boolean;
  exists: boolean;
}

interface ManifestAsset {
  img_ref: string;
  bucket: string;
  storage_path: string;
  public_url: string | null;
  content_type: string | null;
  entity_type: string | null;
  field: string | null;
  status?: string | null;
}

interface RestorableItem extends ManifestAsset {
  hasBinary: boolean;
}

type Phase = "idle" | "parsing" | "ready" | "restoring" | "done";

const MediaRestorePanel = () => {
  const [phase, setPhase] = useState<Phase>("idle");
  const [zip, setZip] = useState<JSZip | null>(null);
  const [items, setItems] = useState<RestorableItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState(0);
  const [restoredCount, setRestoredCount] = useState(0);
  const [previewing, setPreviewing] = useState(false);
  const [preview, setPreview] = useState<RelinkPreviewRow[] | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    setPhase("parsing");
    setItems([]);
    setSelected(new Set());
    try {
      const loaded = await JSZip.loadAsync(file);
      const manifestFile = loaded.file("manifest.json");
      if (!manifestFile) throw new Error("manifest.json não encontrado no ZIP.");
      const manifest = JSON.parse(await manifestFile.async("string"));
      const assets: ManifestAsset[] = manifest.assets ?? [];

      // Indexa binários: files/<img_ref>.<ext> -> img_ref
      const binaryRefs = new Set<string>();
      loaded.forEach((relativePath, entry) => {
        if (entry.dir) return;
        if (!relativePath.startsWith("files/")) return;
        const base = relativePath.replace(/^files\//, "").replace(/\.[^.]+$/, "");
        binaryRefs.add(base);
      });

      const restorable: RestorableItem[] = assets.map((a) => ({
        ...a,
        hasBinary: binaryRefs.has(a.img_ref),
      }));
      // Itens com binário primeiro
      restorable.sort((a, b) => Number(b.hasBinary) - Number(a.hasBinary));

      setZip(loaded);
      setItems(restorable);
      // Pré-seleciona tudo que tem binário
      setSelected(new Set(restorable.filter((r) => r.hasBinary).map((r) => r.img_ref)));
      setPhase("ready");
      toast.success(
        `Backup lido: ${restorable.length} itens (${restorable.filter((r) => r.hasBinary).length} com binário restaurável).`,
      );
    } catch (e) {
      setPhase("idle");
      toast.error(e instanceof Error ? e.message : "Falha ao ler o ZIP de backup.");
    }
  }, []);

  const findZipBinary = (loaded: JSZip, imgRef: string) => {
    let found: JSZip.JSZipObject | null = null;
    loaded.forEach((relativePath, entry) => {
      if (found || entry.dir) return;
      if (relativePath.startsWith(`files/${imgRef}.`)) found = entry;
    });
    return found;
  };

  const toggle = (ref: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(ref)) next.delete(ref);
      else next.add(ref);
      return next;
    });

  const restorableItems = items.filter((i) => i.hasBinary);
  const allSelected = restorableItems.length > 0 && restorableItems.every((i) => selected.has(i.img_ref));

  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(restorableItems.map((i) => i.img_ref)));

  const handleRestore = async () => {
    if (!zip) return;
    const targets = items.filter((i) => i.hasBinary && selected.has(i.img_ref));
    if (targets.length === 0) {
      toast.error("Selecione ao menos um item com binário.");
      return;
    }
    setPhase("restoring");
    setProgress(0);
    setRestoredCount(0);

    let ok = 0;
    const errors: string[] = [];
    for (let i = 0; i < targets.length; i++) {
      const item = targets[i];
      try {
        const entry = findZipBinary(zip, item.img_ref);
        if (!entry) throw new Error("binário não encontrado");
        const blob = await entry.async("blob");
        const { error } = await supabase.storage
          .from(item.bucket)
          .upload(item.storage_path, blob, {
            upsert: true,
            contentType: item.content_type ?? undefined,
          });
        if (error) throw error;
        ok++;
      } catch (e) {
        errors.push(`${item.storage_path}: ${e instanceof Error ? e.message : "erro"}`);
      }
      setRestoredCount(ok);
      setProgress(Math.round(((i + 1) / targets.length) * 100));
    }

    // Reescreve as URLs no banco a partir do catálogo (relink) para os restaurados.
    try {
      const { error: relinkErr } = await supabase.functions.invoke("admin-media-backup", {
        body: { action: "relink", img_refs: targets.map((t) => t.img_ref) },
      });
      if (relinkErr) throw relinkErr;
    } catch (e) {
      errors.push(`relink: ${e instanceof Error ? e.message : "erro"}`);
    }

    setPhase("done");
    if (errors.length === 0) {
      toast.success(`Restauração concluída: ${ok} imagem(ns) restaurada(s) e re-vinculada(s).`);
    } else {
      toast.warning(`Restaurado ${ok}/${targets.length}. ${errors.length} com erro.`);
      console.error("[media-restore] erros:", errors);
    }
  };

  const handleRelinkOnly = async () => {
    const promise = supabase.functions.invoke("admin-media-backup", {
      body: { action: "relink" },
    });
    toast.promise(promise, {
      loading: "Reescrevendo URLs a partir do catálogo...",
      success: "URLs re-vinculadas com sucesso.",
      error: "Falha ao re-vincular URLs.",
    });
  };

  const reset = () => {
    setPhase("idle");
    setZip(null);
    setItems([]);
    setSelected(new Set());
    setProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <PackageOpen className="h-4 w-4 text-primary" />
            Restaurar do backup
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Envie o ZIP de backup (<code className="text-xs bg-muted px-1 rounded">emporio-media-backup.zip</code>),
            selecione as imagens por <code className="text-xs bg-muted px-1 rounded">img_ref</code> e restaure os
            binários no armazenamento. As URLs no banco são reescritas automaticamente a partir do catálogo.
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept=".zip,application/zip"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={phase === "parsing" || phase === "restoring"}
            >
              {phase === "parsing" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              Selecionar ZIP
            </Button>
            <Button variant="ghost" onClick={handleRelinkOnly} disabled={phase === "restoring"}>
              <Link2 className="h-4 w-4" />
              Apenas re-vincular URLs
            </Button>
            {phase !== "idle" && (
              <Button variant="ghost" onClick={reset} disabled={phase === "restoring"}>
                <RotateCcw className="h-4 w-4" />
                Limpar
              </Button>
            )}
          </div>

          {phase === "restoring" && (
            <div className="space-y-1.5">
              <Progress value={progress} />
              <p className="text-xs text-muted-foreground">
                Restaurando... {restoredCount} concluído(s) ({progress}%)
              </p>
            </div>
          )}

          {phase === "done" && (
            <div className="flex items-center gap-2 text-sm text-emerald-600">
              <CheckCircle2 className="h-4 w-4" /> Restauração finalizada.
            </div>
          )}
        </CardContent>
      </Card>

      {items.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between gap-2 flex-wrap">
              <span className="flex items-center gap-2">
                <FileArchive className="h-4 w-4" />
                Conteúdo do backup
                <Badge variant="outline">{items.length}</Badge>
              </span>
              {restorableItems.length > 0 && (
                <Button variant="outline" size="sm" onClick={toggleAll} disabled={phase === "restoring"}>
                  {allSelected ? "Desmarcar todos" : "Selecionar todos restauráveis"}
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
              <p className="text-xs text-muted-foreground">
                {selected.size} selecionado(s) · {restorableItems.length} com binário restaurável
              </p>
              <Button
                onClick={handleRestore}
                disabled={phase === "restoring" || selected.size === 0}
                size="sm"
              >
                {phase === "restoring" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <PackageOpen className="h-4 w-4" />
                )}
                Restaurar selecionados
              </Button>
            </div>

            <div className="space-y-1.5 max-h-[55vh] overflow-y-auto">
              {items.map((item) => (
                <label
                  key={item.img_ref}
                  className={`flex items-center gap-3 p-2.5 rounded-lg border text-xs cursor-pointer ${
                    item.hasBinary ? "hover:bg-muted/50" : "opacity-50"
                  }`}
                >
                  <Checkbox
                    checked={selected.has(item.img_ref)}
                    onCheckedChange={() => item.hasBinary && toggle(item.img_ref)}
                    disabled={!item.hasBinary || phase === "restoring"}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{item.storage_path}</p>
                    <p className="text-muted-foreground truncate">{item.img_ref}</p>
                  </div>
                  <Badge variant="outline" className="shrink-0">
                    {item.entity_type ?? "?"} · {item.field ?? "?"}
                  </Badge>
                  {item.hasBinary ? (
                    <Badge variant="secondary" className="shrink-0">
                      binário ok
                    </Badge>
                  ) : (
                    <Badge variant="destructive" className="shrink-0">
                      sem binário
                    </Badge>
                  )}
                </label>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default MediaRestorePanel;
