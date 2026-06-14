import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Download, RefreshCw, Trash2 } from "lucide-react";

interface StaleLog {
  id: string;
  occurred_at: string;
  route: string | null;
  message: string | null;
  stack: string | null;
  user_agent: string | null;
  reloaded: boolean;
}

interface IgFailure {
  id: string;
  occurred_at: string;
  post_url: string | null;
  route: string | null;
  ms_to_fallback: number | null;
  user_agent: string | null;
}

const PERIODS = [
  { v: "1", label: "Últimas 24h" },
  { v: "7", label: "Últimos 7 dias" },
  { v: "30", label: "Últimos 30 dias" },
  { v: "0", label: "Tudo" },
];

const sinceISO = (days: string) => {
  if (days === "0") return null;
  const d = new Date();
  d.setDate(d.getDate() - Number(days));
  return d.toISOString();
};

const toCSV = (rows: Record<string, unknown>[]) => {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h])).join(","))].join("\n");
};

const downloadCSV = (filename: string, csv: string) => {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

const AdminDiagnostics = () => {
  const { toast } = useToast();

  // Stale-bundle logs
  const [staleLogs, setStaleLogs] = useState<StaleLog[]>([]);
  const [stalePeriod, setStalePeriod] = useState("7");
  const [staleRoute, setStaleRoute] = useState("");

  // IG embed failures
  const [igFailures, setIgFailures] = useState<IgFailure[]>([]);
  const [igPeriod, setIgPeriod] = useState("7");
  const [igRoute, setIgRoute] = useState("");

  // Config (toggle + intervalo)
  const [autoReload, setAutoReload] = useState(true);
  const [minIntervalMs, setMinIntervalMs] = useState(30000);
  const [savingCfg, setSavingCfg] = useState(false);

  const loadStale = async () => {
    let q = supabase
      .from("stale_bundle_logs")
      .select("*")
      .order("occurred_at", { ascending: false })
      .limit(500);
    const since = sinceISO(stalePeriod);
    if (since) q = q.gte("occurred_at", since);
    if (staleRoute) q = q.ilike("route", `%${staleRoute}%`);
    const { data, error } = await q;
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else setStaleLogs((data ?? []) as StaleLog[]);
  };

  const loadIg = async () => {
    let q = supabase
      .from("instagram_embed_failures")
      .select("*")
      .order("occurred_at", { ascending: false })
      .limit(500);
    const since = sinceISO(igPeriod);
    if (since) q = q.gte("occurred_at", since);
    if (igRoute) q = q.ilike("route", `%${igRoute}%`);
    const { data, error } = await q;
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else setIgFailures((data ?? []) as IgFailure[]);
  };

  const loadConfig = async () => {
    const { data } = await supabase
      .from("store_settings")
      .select("value")
      .eq("key", "stale_bundle_config")
      .maybeSingle();
    const cfg = (data?.value as { auto_reload?: boolean; min_interval_ms?: number }) ?? {};
    setAutoReload(cfg.auto_reload !== false);
    setMinIntervalMs(cfg.min_interval_ms ?? 30000);
  };

  useEffect(() => {
    loadStale();
    loadIg();
    loadConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadStale();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stalePeriod, staleRoute]);

  useEffect(() => {
    loadIg();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [igPeriod, igRoute]);

  const saveConfig = async () => {
    setSavingCfg(true);
    const value = { auto_reload: autoReload, min_interval_ms: Math.max(5000, Number(minIntervalMs) || 30000) };
    const { data: existing } = await supabase
      .from("store_settings")
      .select("id")
      .eq("key", "stale_bundle_config")
      .maybeSingle();
    let error;
    if (existing) {
      ({ error } = await supabase.from("store_settings").update({ value }).eq("id", existing.id));
    } else {
      ({ error } = await supabase.from("store_settings").insert({ key: "stale_bundle_config", value }));
    }
    setSavingCfg(false);
    if (error) toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    else toast({ title: "Configuração salva" });
  };

  const clearStale = async () => {
    const since = sinceISO(stalePeriod) ?? new Date(0).toISOString();
    await supabase.from("stale_bundle_logs").delete().gte("occurred_at", since);
    loadStale();
  };

  const clearIg = async () => {
    const since = sinceISO(igPeriod) ?? new Date(0).toISOString();
    await supabase.from("instagram_embed_failures").delete().gte("occurred_at", since);
    loadIg();
  };

  const staleByRoute = useMemo(() => {
    const map = new Map<string, number>();
    staleLogs.forEach((l) => map.set(l.route ?? "—", (map.get(l.route ?? "—") ?? 0) + 1));
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [staleLogs]);

  const igByPost = useMemo(() => {
    const map = new Map<string, number>();
    igFailures.forEach((l) => map.set(l.post_url ?? "—", (map.get(l.post_url ?? "—") ?? 0) + 1));
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [igFailures]);

  // Detecção de picos: últimas 24h vs média diária dos últimos 7 dias (excluindo últimas 24h)
  const detectSpike = (rows: { occurred_at: string }[]) => {
    const now = Date.now();
    const last24 = rows.filter((r) => now - new Date(r.occurred_at).getTime() < 86_400_000).length;
    const prev6days = rows.filter((r) => {
      const age = now - new Date(r.occurred_at).getTime();
      return age >= 86_400_000 && age < 7 * 86_400_000;
    }).length;
    const avgDaily = prev6days / 6;
    if (last24 < 5) return null; // ruído baixo
    if (avgDaily === 0 && last24 >= 5) return { last24, avgDaily, ratio: Infinity };
    if (last24 >= avgDaily * 2) return { last24, avgDaily, ratio: last24 / Math.max(avgDaily, 1) };
    return null;
  };
  const staleSpike = useMemo(() => detectSpike(staleLogs), [staleLogs]);
  const igSpike = useMemo(() => detectSpike(igFailures), [igFailures]);

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-display text-foreground">Diagnóstico</h1>
        <p className="text-muted-foreground">Logs de stale-bundle e falhas de embed do Instagram.</p>
      </div>

      {(staleSpike || igSpike) && (
        <div className="space-y-2">
          {staleSpike && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm">
              <strong className="text-destructive">⚠ Pico de stale-bundle:</strong>{" "}
              {staleSpike.last24} ocorrências nas últimas 24h (média diária recente: {staleSpike.avgDaily.toFixed(1)}
              {staleSpike.ratio !== Infinity && ` — ${staleSpike.ratio.toFixed(1)}x acima do normal`}).
            </div>
          )}
          {igSpike && (
            <div className="rounded-lg border border-amber-400/50 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-sm">
              <strong className="text-amber-700 dark:text-amber-300">⚠ Pico de falhas no embed Instagram:</strong>{" "}
              {igSpike.last24} falhas nas últimas 24h (média recente: {igSpike.avgDaily.toFixed(1)}
              {igSpike.ratio !== Infinity && ` — ${igSpike.ratio.toFixed(1)}x acima do normal`}).
            </div>
          )}
        </div>
      )}

      <Tabs defaultValue="stale">
        <TabsList>
          <TabsTrigger value="stale">Stale-bundle ({staleLogs.length})</TabsTrigger>
          <TabsTrigger value="ig">Embed Instagram ({igFailures.length})</TabsTrigger>
          <TabsTrigger value="cfg">Configurações</TabsTrigger>
        </TabsList>

        <TabsContent value="stale" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Filtros</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3 items-end">
              <div className="space-y-1">
                <Label>Período</Label>
                <Select value={stalePeriod} onValueChange={setStalePeriod}>
                  <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PERIODS.map((p) => <SelectItem key={p.v} value={p.v}>{p.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Rota contém</Label>
                <Input value={staleRoute} onChange={(e) => setStaleRoute(e.target.value)} placeholder="/produto" className="w-56" />
              </div>
              <Button variant="outline" onClick={loadStale}><RefreshCw className="w-4 h-4 mr-2" />Atualizar</Button>
              <Button variant="outline" onClick={() => downloadCSV(`stale-bundle-${Date.now()}.csv`, toCSV(staleLogs as unknown as Record<string, unknown>[]))}>
                <Download className="w-4 h-4 mr-2" />CSV
              </Button>
              <Button variant="destructive" onClick={clearStale}><Trash2 className="w-4 h-4 mr-2" />Limpar período</Button>
            </CardContent>
          </Card>

          {staleByRoute.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Top rotas afetadas</CardTitle></CardHeader>
              <CardContent>
                <ul className="space-y-1 text-sm">
                  {staleByRoute.map(([route, count]) => (
                    <li key={route} className="flex justify-between border-b py-1">
                      <span className="font-mono">{route}</span>
                      <span className="font-medium">{count}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left p-2">Quando</th>
                    <th className="text-left p-2">Rota</th>
                    <th className="text-left p-2">Mensagem</th>
                    <th className="text-left p-2">Recarregou?</th>
                  </tr>
                </thead>
                <tbody>
                  {staleLogs.map((l) => (
                    <tr key={l.id} className="border-b">
                      <td className="p-2 whitespace-nowrap">{new Date(l.occurred_at).toLocaleString("pt-BR")}</td>
                      <td className="p-2 font-mono">{l.route}</td>
                      <td className="p-2 max-w-md truncate" title={l.message ?? ""}>{l.message}</td>
                      <td className="p-2">{l.reloaded ? "✅" : "—"}</td>
                    </tr>
                  ))}
                  {staleLogs.length === 0 && (
                    <tr><td colSpan={4} className="p-4 sm:p-6 text-center text-muted-foreground">Nenhum log no período.</td></tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ig" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Filtros</CardTitle></CardHeader>
            <CardContent className="flex flex-wrap gap-3 items-end">
              <div className="space-y-1">
                <Label>Período</Label>
                <Select value={igPeriod} onValueChange={setIgPeriod}>
                  <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PERIODS.map((p) => <SelectItem key={p.v} value={p.v}>{p.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Rota contém</Label>
                <Input value={igRoute} onChange={(e) => setIgRoute(e.target.value)} className="w-56" />
              </div>
              <Button variant="outline" onClick={loadIg}><RefreshCw className="w-4 h-4 mr-2" />Atualizar</Button>
              <Button variant="outline" onClick={() => downloadCSV(`ig-failures-${Date.now()}.csv`, toCSV(igFailures as unknown as Record<string, unknown>[]))}>
                <Download className="w-4 h-4 mr-2" />CSV
              </Button>
              <Button variant="destructive" onClick={clearIg}><Trash2 className="w-4 h-4 mr-2" />Limpar período</Button>
            </CardContent>
          </Card>

          {igByPost.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Top posts com falha</CardTitle></CardHeader>
              <CardContent>
                <ul className="space-y-1 text-sm">
                  {igByPost.map(([url, count]) => (
                    <li key={url} className="flex justify-between border-b py-1 gap-3">
                      <a href={url} target="_blank" rel="noopener noreferrer" className="font-mono truncate text-primary hover:underline">{url}</a>
                      <span className="font-medium shrink-0">{count}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left p-2">Quando</th>
                    <th className="text-left p-2">Post</th>
                    <th className="text-left p-2">Rota</th>
                    <th className="text-left p-2">Tempo (ms)</th>
                  </tr>
                </thead>
                <tbody>
                  {igFailures.map((l) => (
                    <tr key={l.id} className="border-b">
                      <td className="p-2 whitespace-nowrap">{new Date(l.occurred_at).toLocaleString("pt-BR")}</td>
                      <td className="p-2 max-w-xs truncate"><a className="text-primary hover:underline" href={l.post_url ?? "#"} target="_blank" rel="noopener noreferrer">{l.post_url}</a></td>
                      <td className="p-2 font-mono">{l.route}</td>
                      <td className="p-2">{l.ms_to_fallback}</td>
                    </tr>
                  ))}
                  {igFailures.length === 0 && (
                    <tr><td colSpan={4} className="p-4 sm:p-6 text-center text-muted-foreground">Nenhuma falha registrada.</td></tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cfg">
          <Card>
            <CardHeader>
              <CardTitle>Hard-reload automático</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5 max-w-md">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base">Recarregar página automaticamente</Label>
                  <p className="text-xs text-muted-foreground">Quando um chunk antigo falhar.</p>
                </div>
                <Switch checked={autoReload} onCheckedChange={setAutoReload} />
              </div>
              <div className="space-y-1">
                <Label>Intervalo mínimo entre tentativas (ms)</Label>
                <Input type="number" min={5000} step={1000} value={minIntervalMs} onChange={(e) => setMinIntervalMs(Number(e.target.value))} />
                <p className="text-xs text-muted-foreground">Evita loops. Mínimo 5000ms.</p>
              </div>
              <Button onClick={saveConfig} disabled={savingCfg}>{savingCfg ? "Salvando..." : "Salvar"}</Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminDiagnostics;
