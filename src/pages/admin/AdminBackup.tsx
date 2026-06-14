import { useEffect, useMemo, useState } from "react";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Download, Upload, Database, Image as ImageIcon, ShoppingBag, FileCode2, AlertTriangle, Loader2, Package, ShieldCheck } from "lucide-react";

type ExportManifest = {
  version: number;
  exported_at: string;
  scope: { catalog: boolean; images: boolean; orders: boolean; sql: boolean };
  catalog?: Record<string, unknown[]>;
  orders?: { orders: unknown[]; order_items: unknown[] };
  images?: { external_ref: string; idx: number; filename: string; signed_url: string }[];
  sqlDump?: string;
};

export default function AdminBackup() {
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const [scope, setScope] = useState({ catalog: true, images: true, orders: false, sql: true });

  const [importing, setImporting] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importMode, setImportMode] = useState<"merge" | "replace">("merge");
  const [importPreview, setImportPreview] = useState<{ products: number; cats: number; occs: number; tags: number; kits: number; images: number; orders: number } | null>(null);
  const [importReport, setImportReport] = useState<unknown>(null);
  const [confirmReplaceOpen, setConfirmReplaceOpen] = useState(false);
  const [replaceAck, setReplaceAck] = useState(false);

  // Per-product selection
  const [productList, setProductList] = useState<{ external_ref: string; name: string; slug: string; is_active: boolean }[]>([]);
  const [selectedRefs, setSelectedRefs] = useState<Set<string>>(new Set());
  const [filterQ, setFilterQ] = useState("");
  const [exportMode, setExportMode] = useState<"all" | "selected">("all");

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("products")
        .select("external_ref, name, slug, is_active")
        .order("name");
      if (error) { console.warn(error); return; }
      setProductList((data ?? []).filter((p) => p.external_ref));
    })();
  }, []);

  const filteredProducts = useMemo(() => {
    const q = filterQ.trim().toLowerCase();
    if (!q) return productList;
    return productList.filter((p) => p.name.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q) || p.external_ref.toLowerCase().includes(q));
  }, [productList, filterQ]);

  function toggleRef(ref: string) {
    setSelectedRefs((s) => {
      const n = new Set(s);
      if (n.has(ref)) n.delete(ref); else n.add(ref);
      return n;
    });
  }
  function selectAllVisible() { setSelectedRefs(new Set(filteredProducts.map((p) => p.external_ref))); }
  function clearSelection() { setSelectedRefs(new Set()); }

  async function handleExport() {
    setExporting(true);
    setProgress(2);
    setProgressLabel("Coletando dados do servidor...");
    try {
      const productRefs = exportMode === "selected" ? Array.from(selectedRefs) : undefined;
      if (exportMode === "selected" && (!productRefs || productRefs.length === 0)) {
        toast.error("Selecione ao menos um produto");
        setExporting(false); setProgress(0); return;
      }
      const { data, error } = await supabase.functions.invoke<ExportManifest>("admin-backup-export", { body: { scope, productRefs } });
      if (error || !data) throw new Error(error?.message ?? "Falha ao exportar");
      setProgress(25);

      const zip = new JSZip();
      zip.file("manifest.json", JSON.stringify({ version: data.version, exported_at: data.exported_at, scope: data.scope }, null, 2));
      if (data.catalog) zip.file("catalog.json", JSON.stringify(data.catalog, null, 2));
      if (data.orders) zip.file("orders.json", JSON.stringify(data.orders, null, 2));
      if (data.sqlDump) zip.file("catalog.sql", data.sqlDump);

      if (data.images && data.images.length > 0) {
        const imgFolder = zip.folder("images")!;
        const total = data.images.length;
        let done = 0;
        const CONCURRENCY = 6;
        const queue = [...data.images];
        const workers = Array.from({ length: CONCURRENCY }, async () => {
          while (queue.length) {
            const img = queue.shift();
            if (!img) break;
            try {
              const r = await fetch(img.signed_url);
              if (r.ok) {
                const blob = await r.blob();
                imgFolder.file(img.filename, blob);
              }
            } catch (e) {
              console.warn("img fail", img.filename, e);
            }
            done++;
            setProgress(25 + Math.round((done / total) * 65));
            setProgressLabel(`Baixando imagens ${done}/${total}...`);
          }
        });
        await Promise.all(workers);
      }

      setProgress(95);
      setProgressLabel("Compactando ZIP...");
      const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
      const stamp = new Date().toISOString().slice(0, 10);
      const suffix = exportMode === "selected" ? `-${selectedRefs.size}produtos` : "";
      saveAs(blob, `backup-emporio${suffix}-${stamp}.zip`);
      setProgress(100);
      setProgressLabel("Pronto.");
      toast.success("Backup gerado com sucesso");
    } catch (e) {
      console.error(e);
      toast.error((e as Error).message);
    } finally {
      setTimeout(() => { setExporting(false); setProgress(0); setProgressLabel(""); }, 1200);
    }
  }

  async function handleFilePick(f: File | null) {
    setImportFile(f);
    setImportPreview(null);
    setImportReport(null);
    if (!f) return;
    try {
      const zip = await JSZip.loadAsync(f);
      const catFile = zip.file("catalog.json");
      const cat = catFile ? JSON.parse(await catFile.async("string")) as Record<string, unknown[]> : {};
      const ordFile = zip.file("orders.json");
      const ord = ordFile ? JSON.parse(await ordFile.async("string")) as { orders?: unknown[] } : {};
      const imgs = Object.keys(zip.files).filter((n) => n.startsWith("images/") && !zip.files[n].dir);
      setImportPreview({
        products: cat.products?.length ?? 0,
        cats: cat.categories?.length ?? 0,
        occs: cat.occasions?.length ?? 0,
        tags: cat.tags?.length ?? 0,
        kits: cat.kits?.length ?? 0,
        images: imgs.length,
        orders: ord.orders?.length ?? 0,
      });
    } catch (e) {
      toast.error("Arquivo inválido: " + (e as Error).message);
      setImportFile(null);
    }
  }

  function handleImport() {
    if (!importFile) return;
    if (importMode === "replace") {
      setReplaceAck(false);
      setConfirmReplaceOpen(true);
      return;
    }
    void runImport();
  }

  async function runImport() {
    if (!importFile) return;

    setImporting(true);
    setProgress(2);
    setProgressLabel("Lendo ZIP...");
    try {
      const zip = await JSZip.loadAsync(importFile);
      const catalog = zip.file("catalog.json") ? JSON.parse(await zip.file("catalog.json")!.async("string")) : {};

      // 1) Upload de imagens para o bucket (paths estáveis por external_ref)
      const imageFiles = Object.keys(zip.files).filter((n) => n.startsWith("images/") && !zip.files[n].dir);
      const imagesByRef: Record<string, string[]> = {};
      const total = imageFiles.length;
      let done = 0;

      for (const path of imageFiles) {
        const filename = path.replace(/^images\//, "");
        const m = filename.match(/^(.+?)__(\d+)\.([a-zA-Z0-9]+)$/);
        if (!m) { done++; continue; }
        const [, ref, idxStr, ext] = m;
        const idx = parseInt(idxStr, 10);
        const storagePath = `imported/${ref}/${String(idx).padStart(2, "0")}.${ext.toLowerCase()}`;
        const blob = await zip.file(path)!.async("blob");
        const contentType = ext.match(/png/i) ? "image/png" : ext.match(/webp/i) ? "image/webp" : "image/jpeg";
        const { error: upErr } = await supabase.storage.from("product-images").upload(storagePath, blob, { upsert: true, contentType });
        if (upErr) {
          console.warn("upload fail", storagePath, upErr);
        } else {
          const { data } = supabase.storage.from("product-images").getPublicUrl(storagePath);
          (imagesByRef[ref] ||= [])[idx - 1] = data.publicUrl;
        }
        done++;
        setProgress(Math.round((done / Math.max(total, 1)) * 60));
        setProgressLabel(`Subindo imagens ${done}/${total}...`);
      }
      // Compacta arrays (remove undefined gaps)
      for (const k of Object.keys(imagesByRef)) imagesByRef[k] = imagesByRef[k].filter(Boolean);

      setProgress(70);
      setProgressLabel("Recriando registros no banco...");
      const { data, error } = await supabase.functions.invoke("admin-backup-import", {
        body: { manifest: { catalog, images: imagesByRef }, mode: importMode },
      });
      if (error) throw new Error(error.message);
      setImportReport(data);
      setProgress(100);
      setProgressLabel("Concluído.");
      toast.success("Importação concluída — confira o relatório abaixo");
    } catch (e) {
      console.error(e);
      toast.error((e as Error).message);
    } finally {
      setTimeout(() => { setImporting(false); setProgress(0); setProgressLabel(""); }, 1500);
    }
  }

  return (
    <div className="container max-w-5xl py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-heading">Backup & Migração</h1>
        <p className="text-muted-foreground mt-1">Exporte produtos, imagens e SQL com chave global <code className="text-xs bg-muted px-1 py-0.5 rounded">external_ref</code> — reimporte em outro projeto sem perder relacionamentos.</p>
      </div>

      <Tabs defaultValue="export">
        <TabsList>
          <TabsTrigger value="export"><Download className="w-4 h-4 mr-2" />Exportar</TabsTrigger>
          <TabsTrigger value="import"><Upload className="w-4 h-4 mr-2" />Importar</TabsTrigger>
          <TabsTrigger value="audit"><ShieldCheck className="w-4 h-4 mr-2" />Auditoria do sistema</TabsTrigger>
        </TabsList>

        <TabsContent value="export" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>O que incluir no backup</CardTitle>
              <CardDescription>O ZIP final terá pastas separadas e um manifest.json descrevendo o conteúdo.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { k: "catalog", icon: Database, label: "Catálogo (produtos + categorias + ocasiões + tags + kits + relacionamentos)" },
                { k: "images", icon: ImageIcon, label: "Imagens dos produtos (renomeadas como {external_ref}__NN.ext)" },
                { k: "sql", icon: FileCode2, label: "SQL dump (INSERTs prontos para Supabase)" },
                { k: "orders", icon: ShoppingBag, label: "Pedidos e clientes (inclui dados pessoais — LGPD)" },
              ].map((row) => {
                const Icon = row.icon;
                return (
                  <Label key={row.k} className="flex items-start gap-3 cursor-pointer">
                    <Checkbox checked={scope[row.k as keyof typeof scope]} onCheckedChange={(v) => setScope((s) => ({ ...s, [row.k]: !!v }))} />
                    <Icon className="w-4 h-4 mt-0.5 text-muted-foreground" />
                    <span className="text-sm">{row.label}</span>
                  </Label>
                );
              })}
              {scope.orders && (
                <Alert variant="destructive">
                  <AlertTriangle className="w-4 h-4" />
                  <AlertTitle>Atenção LGPD</AlertTitle>
                  <AlertDescription>O arquivo conterá nomes, e-mails, telefones e endereços de clientes. Armazene em local seguro.</AlertDescription>
                </Alert>
              )}

              <div className="space-y-3 pt-2 border-t">
                <div>
                  <Label className="text-sm font-medium flex items-center gap-2"><Package className="w-4 h-4" />Escopo dos produtos</Label>
                  <div className="mt-2 space-y-2">
                    <Label className="flex items-start gap-3 cursor-pointer">
                      <input type="radio" checked={exportMode === "all"} onChange={() => setExportMode("all")} className="mt-1" />
                      <div>
                        <p className="text-sm font-medium">Todos os produtos</p>
                        <p className="text-xs text-muted-foreground">Catálogo completo ({productList.length} produtos)</p>
                      </div>
                    </Label>
                    <Label className="flex items-start gap-3 cursor-pointer">
                      <input type="radio" checked={exportMode === "selected"} onChange={() => setExportMode("selected")} className="mt-1" />
                      <div>
                        <p className="text-sm font-medium">Apenas produtos selecionados ({selectedRefs.size})</p>
                        <p className="text-xs text-muted-foreground">Exporta SQL + imagens só dos produtos marcados. Categorias e kits relacionados são incluídos automaticamente.</p>
                      </div>
                    </Label>
                  </div>
                </div>

                {exportMode === "selected" && (
                  <div className="rounded-lg border p-3 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Input placeholder="Filtrar por nome, slug ou ref..." value={filterQ} onChange={(e) => setFilterQ(e.target.value)} className="flex-1 min-w-[200px] h-9" />
                      <Button type="button" variant="outline" size="sm" onClick={selectAllVisible}>Selecionar visíveis</Button>
                      <Button type="button" variant="ghost" size="sm" onClick={clearSelection}>Limpar</Button>
                    </div>
                    <ScrollArea className="h-64 rounded border">
                      <div className="p-2 space-y-1">
                        {filteredProducts.length === 0 && <p className="text-sm text-muted-foreground p-2">Nenhum produto encontrado.</p>}
                        {filteredProducts.map((p) => (
                          <Label key={p.external_ref} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer">
                            <Checkbox checked={selectedRefs.has(p.external_ref)} onCheckedChange={() => toggleRef(p.external_ref)} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm truncate">{p.name} {!p.is_active && <Badge variant="outline" className="ml-1 text-[10px]">inativo</Badge>}</p>
                              <p className="text-[11px] text-muted-foreground truncate">{p.external_ref}</p>
                            </div>
                          </Label>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}
              </div>

              {exporting && (
                <div className="space-y-1">
                  <Progress value={progress} />
                  <p className="text-xs text-muted-foreground">{progressLabel}</p>
                </div>
              )}
              <Button onClick={handleExport} disabled={exporting} className="w-full sm:w-auto">
                {exporting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Gerando...</> : <><Download className="w-4 h-4 mr-2" />Gerar backup .zip</>}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="import" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Importar um backup</CardTitle>
              <CardDescription>O sistema casa registros por <code className="text-xs bg-muted px-1 py-0.5 rounded">external_ref</code> — funciona mesmo se os UUIDs originais não existirem.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="zip-file" className="text-sm font-medium">Arquivo ZIP do backup</Label>
                <input
                  id="zip-file"
                  type="file"
                  accept=".zip"
                  onChange={(e) => handleFilePick(e.target.files?.[0] ?? null)}
                  className="mt-1 block w-full text-sm file:mr-3 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                />
              </div>

              {importPreview && (
                <div className="rounded-lg border p-3 space-y-2">
                  <p className="text-sm font-medium">Conteúdo detectado</p>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">{importPreview.products} produtos</Badge>
                    <Badge variant="secondary">{importPreview.cats} categorias</Badge>
                    <Badge variant="secondary">{importPreview.occs} ocasiões</Badge>
                    <Badge variant="secondary">{importPreview.tags} tags</Badge>
                    <Badge variant="secondary">{importPreview.kits} kits</Badge>
                    <Badge variant="secondary">{importPreview.images} imagens</Badge>
                    {importPreview.orders > 0 && <Badge variant="outline">{importPreview.orders} pedidos (não importados nesta versão)</Badge>}
                  </div>
                </div>
              )}

              <div>
                <Label className="text-sm font-medium">Modo</Label>
                <div className="mt-2 space-y-2">
                  <Label className="flex items-start gap-3 cursor-pointer">
                    <input type="radio" checked={importMode === "merge"} onChange={() => setImportMode("merge")} className="mt-1" />
                    <div>
                      <p className="text-sm font-medium">Mesclar (recomendado)</p>
                      <p className="text-xs text-muted-foreground">Atualiza por external_ref, cria novos. Não apaga nada existente.</p>
                    </div>
                  </Label>
                  <Label className="flex items-start gap-3 cursor-pointer">
                    <input type="radio" checked={importMode === "replace"} onChange={() => setImportMode("replace")} className="mt-1" />
                    <div>
                      <p className="text-sm font-medium text-destructive">Substituir tudo</p>
                      <p className="text-xs text-muted-foreground">APAGA todo o catálogo atual antes de importar. Pedirá confirmação dupla.</p>
                    </div>
                  </Label>
                </div>
              </div>

              {importing && (
                <div className="space-y-1">
                  <Progress value={progress} />
                  <p className="text-xs text-muted-foreground">{progressLabel}</p>
                </div>
              )}

              <Button onClick={handleImport} disabled={!importFile || importing} className="w-full sm:w-auto" variant={importMode === "replace" ? "destructive" : "default"}>
                {importing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Importando...</> : <><Upload className="w-4 h-4 mr-2" />Iniciar importação</>}
              </Button>

              {importReport != null && (
                <div className="rounded-lg border p-3">
                  <p className="text-sm font-medium mb-2">Relatório</p>
                  <pre className="text-xs bg-muted p-3 rounded overflow-x-auto max-h-96">{JSON.stringify(importReport, null, 2)}</pre>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="space-y-4">
          <AuditTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

type AuditPayload = {
  generated_at: string;
  report: string;
  schema: Record<string, unknown[]>;
  config: Record<string, unknown[]>;
  users: unknown[];
  secrets_inventory: string[];
  edge_functions: string[];
};

function AuditTab() {
  const [running, setRunning] = useState(false);
  const [payload, setPayload] = useState<AuditPayload | null>(null);

  async function runAudit() {
    setRunning(true);
    setPayload(null);
    try {
      const { data, error } = await supabase.functions.invoke<AuditPayload>("admin-system-audit", { body: {} });
      if (error || !data) throw new Error(error?.message ?? "Falha");
      setPayload(data);
      toast.success("Auditoria coletada");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setRunning(false);
    }
  }

  async function downloadZip() {
    if (!payload) return;
    const zip = new JSZip();
    zip.file("report.md", payload.report);
    zip.file("generated_at.txt", payload.generated_at);

    const schema = zip.folder("schema")!;
    for (const [k, v] of Object.entries(payload.schema ?? {})) {
      schema.file(`${k}.json`, JSON.stringify(v, null, 2));
    }

    const cfg = zip.folder("config")!;
    for (const [k, v] of Object.entries(payload.config ?? {})) {
      cfg.file(`${k}.json`, JSON.stringify(v, null, 2));
    }

    const users = zip.folder("users")!;
    users.file("auth_users.json", JSON.stringify(payload.users, null, 2));
    users.file("user_roles.json", JSON.stringify(payload.schema.user_roles ?? [], null, 2));
    users.file("profiles.json", JSON.stringify(payload.schema.profiles ?? [], null, 2));

    zip.file("secrets_inventory.json", JSON.stringify(payload.secrets_inventory, null, 2));
    zip.file("edge_functions.json", JSON.stringify(payload.edge_functions, null, 2));

    // SQL legível das policies
    const policies = (payload.schema.policies as Array<Record<string, unknown>>) ?? [];
    let sql = "-- RLS POLICIES SNAPSHOT\n-- " + payload.generated_at + "\n\n";
    for (const p of policies) {
      sql += `-- ${p.table} :: ${p.name} (${p.cmd})\n`;
      sql += `CREATE POLICY "${p.name}" ON public."${p.table}" `;
      sql += `AS ${p.permissive === "PERMISSIVE" || p.permissive === true ? "PERMISSIVE" : "RESTRICTIVE"} `;
      sql += `FOR ${p.cmd} `;
      if (Array.isArray(p.roles)) sql += `TO ${(p.roles as string[]).join(", ")} `;
      if (p.using) sql += `\n  USING (${p.using}) `;
      if (p.with_check) sql += `\n  WITH CHECK (${p.with_check}) `;
      sql += ";\n\n";
    }
    zip.file("schema/rls_policies.sql", sql);

    const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
    const stamp = new Date().toISOString().slice(0, 10);
    saveAs(blob, `auditoria-sistema-${stamp}.zip`);
  }

  const counts = payload ? {
    tables: payload.schema.tables?.length ?? 0,
    policies: payload.schema.policies?.length ?? 0,
    functions: payload.schema.functions?.length ?? 0,
    triggers: payload.schema.triggers?.length ?? 0,
    users: payload.users?.length ?? 0,
    secrets: payload.secrets_inventory?.length ?? 0,
    config: Object.keys(payload.config ?? {}).length,
  } : null;

  const rlsDisabled = payload
    ? ((payload.schema.tables as Array<{ name: string; rls_enabled: boolean }>) ?? []).filter((t) => !t.rls_enabled)
    : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Auditoria completa do sistema</CardTitle>
        <CardDescription>
          Coleta schema do banco, políticas RLS, triggers, funções, índices, buckets, tarefas agendadas,
          configurações administrativas, contas de usuário, papéis, inventário de segredos e edge functions.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert variant="destructive">
          <AlertTriangle className="w-4 h-4" />
          <AlertTitle>Contém dados sensíveis (LGPD)</AlertTitle>
          <AlertDescription>
            O ZIP inclui emails e IDs de todos os usuários. Armazene em local seguro com acesso restrito
            e descarte quando não for mais necessário.
          </AlertDescription>
        </Alert>

        <Button onClick={runAudit} disabled={running}>
          {running ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Coletando...</> : <><ShieldCheck className="w-4 h-4 mr-2" />Executar auditoria</>}
        </Button>

        {payload && counts && (
          <div className="space-y-4">
            <div className="rounded-lg border p-4 space-y-3">
              <p className="text-sm font-medium">Resumo coletado</p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{counts.tables} tabelas</Badge>
                <Badge variant={rlsDisabled.length ? "destructive" : "secondary"}>
                  {rlsDisabled.length} sem RLS
                </Badge>
                <Badge variant="secondary">{counts.policies} políticas RLS</Badge>
                <Badge variant="secondary">{counts.functions} funções</Badge>
                <Badge variant="secondary">{counts.triggers} triggers</Badge>
                <Badge variant="secondary">{counts.users} usuários</Badge>
                <Badge variant="secondary">{counts.config} tabelas de config</Badge>
                <Badge variant="secondary">{counts.secrets} segredos</Badge>
              </div>
              {rlsDisabled.length > 0 && (
                <div className="text-xs text-destructive">
                  <strong>⚠️ Tabelas sem RLS:</strong> {rlsDisabled.map((t) => t.name).join(", ")}
                </div>
              )}
            </div>

            <Button onClick={downloadZip} variant="default">
              <Download className="w-4 h-4 mr-2" />Baixar pacote ZIP completo
            </Button>

            <details className="rounded-lg border p-3">
              <summary className="text-sm font-medium cursor-pointer">Pré-visualização do relatório</summary>
              <pre className="text-xs bg-muted p-3 rounded overflow-x-auto mt-2 whitespace-pre-wrap">{payload.report}</pre>
            </details>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
