// Fase 2 — Dashboard de termos buscados pelos visitantes.
// Mostra os 30 termos com mais buscas e destaca os termos com zero resultados
// (oportunidade clara para o lojista criar um sinônimo ou pinar um produto).

import { useMemo, useState } from "react";
import { Search, AlertTriangle, Loader2, RefreshCw, Download, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useSearchInsights } from "@/hooks/useSearchAdmin";
import { exportCsv } from "@/lib/seoExport";

interface Props {
  onCreateSynonym?: (term: string) => void;
  onCreateBoost?: (term: string) => void;
}

const PERIODS = [
  { value: "7", label: "Últimos 7 dias" },
  { value: "30", label: "Últimos 30 dias" },
  { value: "90", label: "Últimos 90 dias" },
  { value: "all", label: "Todo o período" },
];

const ZERO_OPTIONS = [
  { value: "0", label: "Todos os termos" },
  { value: "1", label: "Com 1+ zero-results" },
  { value: "3", label: "Com 3+ zero-results" },
  { value: "10", label: "Com 10+ zero-results" },
];

export default function SearchInsights({ onCreateSynonym, onCreateBoost }: Props) {
  const { data, isLoading, refetch, isFetching } = useSearchInsights();
  const [filter, setFilter] = useState("");
  const [period, setPeriod] = useState("90");
  const [minZero, setMinZero] = useState("0");

  const rows = useMemo(() => {
    const list = data ?? [];
    const q = filter.trim().toLowerCase();
    const min = Number(minZero) || 0;
    const cutoff =
      period === "all" ? null : Date.now() - Number(period) * 24 * 60 * 60 * 1000;
    return list.filter((r) => {
      if (q && !r.term_normalized.includes(q)) return false;
      if (min > 0 && r.zero_result_count < min) return false;
      if (cutoff && new Date(r.last_searched_at).getTime() < cutoff) return false;
      return true;
    });
  }, [data, filter, period, minZero]);

  const totals = useMemo(() => {
    return {
      total: rows.reduce((s, r) => s + r.total_searches, 0),
      zero: rows.reduce((s, r) => s + r.zero_result_count, 0),
      uniqueTerms: rows.length,
    };
  }, [rows]);

  const exportRows = () =>
    rows.map((r) => ({
      termo: r.term_normalized,
      buscas: r.total_searches,
      zero_results: r.zero_result_count,
      taxa_zero: r.total_searches
        ? `${((r.zero_result_count / r.total_searches) * 100).toFixed(1)}%`
        : "0%",
      ultima_busca: new Date(r.last_searched_at).toLocaleString("pt-BR"),
      sugestao: r.last_suggestion ?? "",
    }));

  const handleCsv = () => exportCsv("search-insights", exportRows());

  /** PDF via janela de impressão do navegador (sem dependência extra). */
  const handlePdf = () => {
    const periodLabel = PERIODS.find((p) => p.value === period)?.label ?? "";
    const body = exportRows()
      .map(
        (r) =>
          `<tr><td>${r.termo}</td><td class="n">${r.buscas}</td><td class="n">${r.zero_results}</td><td class="n">${r.taxa_zero}</td><td>${r.ultima_busca}</td><td>${r.sugestao}</td></tr>`,
      )
      .join("");
    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
      <title>Insights de busca — ${periodLabel}</title>
      <style>
        body{font-family:system-ui,-apple-system,sans-serif;padding:24px;color:#1f2937}
        h1{font-size:18px;margin:0 0 4px}
        p.meta{font-size:12px;color:#6b7280;margin:0 0 16px}
        table{width:100%;border-collapse:collapse;font-size:12px}
        th,td{border-bottom:1px solid #e5e7eb;padding:6px 8px;text-align:left}
        th{background:#f9fafb;text-transform:uppercase;font-size:10px;color:#6b7280}
        td.n{text-align:right;font-variant-numeric:tabular-nums}
      </style></head><body>
      <h1>Insights de busca — Empório LeleCute</h1>
      <p class="meta">${periodLabel} · ${totals.uniqueTerms} termos · ${totals.total} buscas · ${totals.zero} sem resultado · gerado em ${new Date().toLocaleString("pt-BR")}</p>
      <table><thead><tr><th>Termo</th><th>Buscas</th><th>Zero</th><th>Taxa zero</th><th>Última busca</th><th>Sugestão</th></tr></thead>
      <tbody>${body}</tbody></table>
      <script>window.onload=()=>{window.print()}<\/script>
      </body></html>`;
    const w = window.open("", "_blank", "width=1024,height=768");
    if (!w) return;
    w.document.write(html);
    w.document.close();
  };


  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-4 w-4" /> Insights de busca
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            {totals.uniqueTerms} termos únicos · {totals.total} buscas · {totals.zero} sem resultado
          </p>
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleCsv} disabled={!rows.length}>
            <Download className="h-3.5 w-3.5" /> CSV
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handlePdf} disabled={!rows.length}>
            <FileText className="h-3.5 w-3.5" /> PDF
          </Button>
          <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-3">
          <Input
            placeholder="Filtrar termos…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger><SelectValue placeholder="Período" /></SelectTrigger>
            <SelectContent>
              {PERIODS.map((p) => (
                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={minZero} onValueChange={setMinZero}>
            <SelectTrigger><SelectValue placeholder="Zero-results" /></SelectTrigger>
            <SelectContent>
              {ZERO_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Nenhuma busca registrada ainda. Quando os visitantes pesquisarem no site, os termos
            aparecerão aqui.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-muted-foreground border-b">
                  <th className="py-2 px-2">Termo</th>
                  <th className="py-2 px-2 text-right">Buscas</th>
                  <th className="py-2 px-2 text-right">Zero</th>
                  <th className="py-2 px-2">Última</th>
                  <th className="py-2 px-2">Ações</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 80).map((r) => {
                  const zeroRate = r.total_searches
                    ? r.zero_result_count / r.total_searches
                    : 0;
                  const isCritical = r.zero_result_count >= 3 && zeroRate >= 0.5;
                  return (
                    <tr key={r.term_normalized} className="border-b last:border-b-0">
                      <td className="py-2 px-2 font-medium">
                        <div className="flex items-center gap-2">
                          {isCritical && (
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                          )}
                          <span>{r.term_normalized}</span>
                        </div>
                        {r.last_suggestion && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Sugestão atual: {r.last_suggestion}
                          </p>
                        )}
                      </td>
                      <td className="py-2 px-2 text-right tabular-nums">{r.total_searches}</td>
                      <td className="py-2 px-2 text-right">
                        {r.zero_result_count > 0 ? (
                          <Badge variant={isCritical ? "destructive" : "secondary"}>
                            {r.zero_result_count}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </td>
                      <td className="py-2 px-2 text-xs text-muted-foreground">
                        {new Date(r.last_searched_at).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="py-2 px-2">
                        <div className="flex gap-1">
                          {onCreateSynonym && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => onCreateSynonym(r.term_normalized)}
                            >
                              + Sinônimo
                            </Button>
                          )}
                          {onCreateBoost && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => onCreateBoost(r.term_normalized)}
                            >
                              + Pinar
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
