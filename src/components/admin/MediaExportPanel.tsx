import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { sha256Hex, inferExtension } from "@/lib/sha256";
import {
  Download,
  Loader2,
  ShieldCheck,
  ShieldAlert,
  PackageCheck,
  FileWarning,
  RefreshCw,
  Percent,
  Boxes,
  CheckCircle2,
  Clock,
} from "lucide-react";

interface ExportAsset {
  img_ref: string;
  bucket: string;
  storage_path: string;
  public_url: string | null;
  content_type: string | null;
  size_bytes: number | null;
  entity_type: string | null;
  entity_id: string | null;
  field: string | null;
  status: string | null;
}

interface CoverageData {
  cataloged: number;
  exported: number;
  with_checksum: number;
  coverage_pct: number;
  missing_count: number;
  last_run: {
    ran_at: string;
    status: string;
    verified_count: number;
    total_assets: number;
    coverage_pct: number;
    bytes_total: number;
  } | null;
}

type Phase = "idle" | "fetching" | "zipping" | "confirming" | "done";

const formatBytes = (n: number): string => {
  if (!n) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(n) / Math.log(1024));
  return `${(n / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
};

const MediaExportPanel = () => {
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(0);
  const [total, setTotal] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const [lastResult, setLastResult] = useState<{
    exported: number;
    failed: number;
    bytes: number;
    complete: boolean;
  } | null>(null);

  const {
    data: coverage,
    isLoading: coverageLoading,
    refetch: refetchCoverage,
  } = useQuery({
    queryKey: ["admin", "media-backup", "coverage"],
    queryFn: async (): Promise<CoverageData> => {
      const { data, error } = await supabase.functions.invoke("admin-media-backup", {
        body: { action: "coverage" },
      });
      if (error) throw error;
      return (data as { coverage: CoverageData }).coverage;
    },
  });

  const running = phase === "fetching" || phase === "zipping" || phase === "confirming";

  const handleExport = async () => {
    setPhase("fetching");
    setProgress(0);
    setDone(0);
    setErrors([]);
    setLastResult(null);

    try {
      // 1) Lista de assets com binário físico (active + archived).
      const { data: res, error } = await supabase.functions.invoke("admin-media-backup", {
        body: { action: "export_manifest" },
      });
      if (error) throw error;
      const assets: ExportAsset[] = (res as { assets: ExportAsset[] }).assets ?? [];
      setTotal(assets.length);

      if (assets.length === 0) {
        toast.info("Nenhum asset com binário para exportar.");
        setPhase("idle");
        return;
      }

      setPhase("zipping");
      const zip = new JSZip();
      const filesFolder = zip.folder("files")!;
      const manifestAssets: Array<Record<string, unknown>> = [];
      const verified: Array<{ img_ref: string; sha256: string; size_bytes: number }> = [];
      const failures: string[] = [];
      let bytesTotal = 0;

      // 2) Baixa cada binário, calcula SHA-256 e adiciona ao ZIP.
      for (let i = 0; i < assets.length; i++) {
        const a = assets[i];
        try {
          if (!a.public_url) throw new Error("sem public_url");
          const resp = await fetch(a.public_url, { cache: "no-store" });
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          const buffer = await resp.arrayBuffer();
          const size = buffer.byteLength;
          const sha = await sha256Hex(buffer);
          const ext = inferExtension(a.storage_path, a.content_type);
          filesFolder.file(`${a.img_ref}.${ext}`, buffer);

          manifestAssets.push({
            img_ref: a.img_ref,
            bucket: a.bucket,
            storage_path: a.storage_path,
            public_url: a.public_url,
            content_type: a.content_type,
            entity_type: a.entity_type,
            entity_id: a.entity_id,
            field: a.field,
            status: a.status,
            size_bytes: size,
            sha256: sha,
            file: `files/${a.img_ref}.${ext}`,
          });
          verified.push({ img_ref: a.img_ref, sha256: sha, size_bytes: size });
          bytesTotal += size;
        } catch (e) {
          failures.push(`${a.storage_path}: ${e instanceof Error ? e.message : "erro"}`);
        }
        setDone(i + 1);
        setProgress(Math.round(((i + 1) / assets.length) * 100));
      }

      // 3) Auditoria de integridade: todo asset do manifesto tem binário e hash?
      const complete = failures.length === 0 && verified.length === assets.length;

      const manifest = {
        version: 2,
        generated_at: new Date().toISOString(),
        backup_type: "full_binary",
        complete,
        total_assets: assets.length,
        exported_count: verified.length,
        bytes_total: bytesTotal,
        note:
          "ZIP autossuficiente: cada asset do manifesto possui binário em files/<img_ref>.<ext> com sha256 + size_bytes para validação. Restauração não depende de URLs externas.",
        assets: manifestAssets,
      };
      zip.file("manifest.json", JSON.stringify(manifest, null, 2));

      // 4) Gera o ZIP e baixa.
      const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
      const stamp = new Date().toISOString().slice(0, 10);
      saveAs(blob, `emporio-media-backup-${stamp}.zip`);

      // 5) Persiste evidência de backup validado (checksum + backed_up_at se completo).
      setPhase("confirming");
      const { error: confErr } = await supabase.functions.invoke("admin-media-backup", {
        body: {
          action: "confirm_backup",
          runComplete: complete,
          total_assets: assets.length,
          bytes_total: bytesTotal,
          assets: verified,
          notes: complete
            ? "Backup completo e validado via painel."
            : `Backup parcial: ${failures.length} falha(s).`,
        },
      });
      if (confErr) throw confErr;

      setErrors(failures);
      setLastResult({
        exported: verified.length,
        failed: failures.length,
        bytes: bytesTotal,
        complete,
      });
      setPhase("done");
      await refetchCoverage();

      if (complete) {
        toast.success(`Backup completo: ${verified.length} binário(s) exportado(s) e validado(s).`);
      } else {
        toast.warning(
          `Backup parcial: ${verified.length}/${assets.length} exportado(s). backed_up_at NÃO foi marcado.`,
        );
      }
    } catch (e) {
      setPhase("idle");
      toast.error(e instanceof Error ? e.message : "Falha ao gerar o backup completo.");
    }
  };

  const cov = coverage;
  const coveragePct = cov?.coverage_pct ?? 0;
  const isFull = coveragePct >= 100;

  return (
    <div className="space-y-4">
      <Card className={isFull ? "border-emerald-200" : "border-amber-200"}>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between gap-2 flex-wrap">
            <span className="flex items-center gap-2">
              {isFull ? (
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
              ) : (
                <ShieldAlert className="h-4 w-4 text-amber-600" />
              )}
              Cobertura de backup físico
            </span>
            <span className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => refetchCoverage()} disabled={coverageLoading}>
                {coverageLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Atualizar
              </Button>
              <Button onClick={handleExport} disabled={running}>
                {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Gerar backup completo (ZIP)
              </Button>
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Boxes className="h-3.5 w-3.5" /> Catalogados
              </p>
              <p className="text-2xl font-bold">{cov?.cataloged ?? "—"}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <PackageCheck className="h-3.5 w-3.5" /> Exportados (backed_up)
              </p>
              <p className="text-2xl font-bold text-emerald-600">{cov?.exported ?? "—"}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5" /> Hashes válidos
              </p>
              <p className="text-2xl font-bold">{cov?.with_checksum ?? "—"}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Percent className="h-3.5 w-3.5" /> Cobertura
              </p>
              <p className={`text-2xl font-bold ${isFull ? "text-emerald-600" : "text-amber-600"}`}>
                {coverageLoading ? "—" : `${coveragePct}%`}
              </p>
            </div>
          </div>

          <Progress value={coveragePct} />

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <FileWarning className="h-3.5 w-3.5" />
              Faltantes: <strong className={cov?.missing_count ? "text-rose-600" : ""}>{cov?.missing_count ?? "—"}</strong>
            </span>
            {cov?.last_run && (
              <span className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                Última validação: {new Date(cov.last_run.ran_at).toLocaleString("pt-BR")} ·{" "}
                <Badge variant={cov.last_run.status === "complete" ? "secondary" : "outline"}>
                  {cov.last_run.status === "complete" ? "completo" : "parcial"}
                </Badge>{" "}
                {formatBytes(cov.last_run.bytes_total)}
              </span>
            )}
          </div>

          {running && (
            <div className="space-y-1.5">
              <Progress value={progress} />
              <p className="text-xs text-muted-foreground">
                {phase === "fetching" && "Preparando inventário..."}
                {phase === "zipping" && `Baixando e empacotando binários... ${done}/${total} (${progress}%)`}
                {phase === "confirming" && "Registrando evidência de backup validado..."}
              </p>
            </div>
          )}

          {phase === "done" && lastResult && (
            <div
              className={`rounded-lg border p-3 text-sm ${
                lastResult.complete ? "border-emerald-200 bg-emerald-50/50" : "border-amber-200 bg-amber-50/50"
              }`}
            >
              <p className="flex items-center gap-2 font-medium">
                {lastResult.complete ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                ) : (
                  <ShieldAlert className="h-4 w-4 text-amber-600" />
                )}
                {lastResult.complete
                  ? "Backup completo e validado (backed_up_at marcado)."
                  : "Backup parcial — backed_up_at NÃO marcado."}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {lastResult.exported} exportado(s) · {lastResult.failed} falha(s) ·{" "}
                {formatBytes(lastResult.bytes)}
              </p>
              {errors.length > 0 && (
                <ul className="mt-2 space-y-0.5 text-xs text-rose-600 max-h-40 overflow-y-auto list-disc pl-4">
                  {errors.slice(0, 50).map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            O ZIP contém <code className="bg-muted px-1 rounded">manifest.json</code> +{" "}
            <code className="bg-muted px-1 rounded">files/&lt;img_ref&gt;.&lt;ext&gt;</code> — totalmente
            autossuficiente, sem depender de URLs externas para restaurar. O carimbo de backup só é
            aplicado quando <strong>todos</strong> os binários são exportados e validados por checksum.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default MediaExportPanel;
