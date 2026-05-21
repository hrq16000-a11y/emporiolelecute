/**
 * Search Analytics — admin dashboard for query telemetry.
 *
 * Initial version uses well-structured MOCK data so the UI can ship without
 * waiting on the production aggregation pipeline. To wire real data later,
 * replace the `useSearchAnalytics` hook body with Supabase queries against
 * `search_insights_summary` (already exists) and a click/conversion table.
 *
 * Real-data hookup checklist (when ready):
 *   - totals      → SELECT sum(total_searches), sum(zero_result_count) FROM search_insights_summary WHERE last_searched_at >= :from
 *   - conversion  → needs a `search_click_events` table joined by term_normalized
 *   - topTerms    → ORDER BY total_searches DESC LIMIT 10
 *   - zeroResults → WHERE zero_result_count > 0 ORDER BY zero_result_count DESC
 */
import { useMemo, useState } from "react";
import {
  Search as SearchIcon,
  MousePointerClick,
  AlertTriangle,
  Download,
  TrendingUp,
  Calendar,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";

// ---------- Types ----------

type RangeKey = "today" | "7d" | "30d";

interface TopTerm {
  term: string;
  searches: number;
  avgResults: number;
}

interface ZeroResultTerm {
  term: string;
  searches: number;
  lastSearchedAt: string; // ISO
}

interface SearchAnalyticsData {
  totalSearches: number;
  clickThroughs: number;
  zeroResultSearches: number;
  topTerms: TopTerm[];
  zeroResults: ZeroResultTerm[];
}

// ---------- Mock generator ----------

const RANGE_LABEL: Record<RangeKey, string> = {
  today: "Hoje",
  "7d": "Últimos 7 dias",
  "30d": "Últimos 30 dias",
};

function buildMock(range: RangeKey): SearchAnalyticsData {
  const factor = range === "today" ? 1 : range === "7d" ? 6 : 22;

  const topTerms: TopTerm[] = [
    { term: "sabonete artesanal", searches: 184, avgResults: 12 },
    { term: "kit lembrancinha", searches: 142, avgResults: 9 },
    { term: "caderno personalizado", searches: 128, avgResults: 7 },
    { term: "presente madrinha", searches: 96, avgResults: 5 },
    { term: "sabonete coração", searches: 84, avgResults: 4 },
    { term: "papelaria casamento", searches: 71, avgResults: 6 },
    { term: "agenda 2026", searches: 63, avgResults: 3 },
    { term: "marca pagina", searches: 52, avgResults: 8 },
    { term: "convite chá bebê", searches: 47, avgResults: 5 },
    { term: "tag obrigado", searches: 41, avgResults: 11 },
  ].map((t) => ({ ...t, searches: Math.round(t.searches * (factor / 6)) }));

  const zeroResults: ZeroResultTerm[] = [
    { term: "sapato verde", searches: 38, lastSearchedAt: new Date().toISOString() },
    { term: "vela perfumada lavanda", searches: 27, lastSearchedAt: new Date().toISOString() },
    { term: "buque flores secas", searches: 22, lastSearchedAt: new Date().toISOString() },
    { term: "caixa madeira mdf", searches: 19, lastSearchedAt: new Date().toISOString() },
    { term: "topo de bolo", searches: 15, lastSearchedAt: new Date().toISOString() },
    { term: "lembrança 15 anos", searches: 12, lastSearchedAt: new Date().toISOString() },
    { term: "embalagem kraft", searches: 9, lastSearchedAt: new Date().toISOString() },
    { term: "fita cetim 5cm", searches: 6, lastSearchedAt: new Date().toISOString() },
  ].map((t) => ({ ...t, searches: Math.max(1, Math.round(t.searches * (factor / 6))) }));

  const totalSearches = topTerms.reduce((s, t) => s + t.searches, 0) +
    zeroResults.reduce((s, t) => s + t.searches, 0);
  const zeroResultSearches = zeroResults.reduce((s, t) => s + t.searches, 0);
  const clickThroughs = Math.round(totalSearches * 0.42);

  return {
    totalSearches,
    clickThroughs,
    zeroResultSearches,
    topTerms,
    zeroResults,
  };
}

// ---------- Hook (swap to Supabase later) ----------

function useSearchAnalytics(range: RangeKey) {
  return useMemo(() => buildMock(range), [range]);
}

// ---------- Helpers ----------

const pct = (num: number, den: number) =>
  den === 0 ? "0%" : `${((num / den) * 100).toFixed(1)}%`;

function downloadCsv(filename: string, rows: ZeroResultTerm[]) {
  const header = "termo,buscas,ultima_busca\n";
  const body = rows
    .map(
      (r) =>
        `"${r.term.replace(/"/g, '""')}",${r.searches},${r.lastSearchedAt}`,
    )
    .join("\n");
  const blob = new Blob([header + body], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ---------- Subcomponents ----------

interface MetricCardProps {
  title: string;
  value: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "default" | "success" | "warning";
}

const MetricCard = ({ title, value, hint, icon: Icon, tone = "default" }: MetricCardProps) => {
  const toneClass =
    tone === "warning"
      ? "text-destructive"
      : tone === "success"
      ? "text-primary"
      : "text-foreground";
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className={`h-4 w-4 ${toneClass}`} />
      </CardHeader>
      <CardContent>
        <div className={`text-3xl font-semibold ${toneClass}`}>{value}</div>
        <p className="text-xs text-muted-foreground mt-1">{hint}</p>
      </CardContent>
    </Card>
  );
};

// ---------- Page ----------

const SearchAnalytics = () => {
  const [range, setRange] = useState<RangeKey>("7d");
  const data = useSearchAnalytics(range);

  const conversionRate = pct(data.clickThroughs, data.totalSearches);
  const zeroRate = pct(data.zeroResultSearches, data.totalSearches);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Analytics de Busca</h1>
          <p className="text-sm text-muted-foreground">
            Telemetria de queries dos usuários — entenda o que procuram e onde a busca falha.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <ToggleGroup
            type="single"
            value={range}
            onValueChange={(v) => v && setRange(v as RangeKey)}
            size="sm"
          >
            <ToggleGroupItem value="today">Hoje</ToggleGroupItem>
            <ToggleGroupItem value="7d">7 dias</ToggleGroupItem>
            <ToggleGroupItem value="30d">30 dias</ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>

      {/* Metric cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          title="Total de buscas"
          value={data.totalSearches.toLocaleString("pt-BR")}
          hint={RANGE_LABEL[range]}
          icon={SearchIcon}
        />
        <MetricCard
          title="Taxa de conversão"
          value={conversionRate}
          hint={`${data.clickThroughs.toLocaleString("pt-BR")} cliques em resultados`}
          icon={MousePointerClick}
          tone="success"
        />
        <MetricCard
          title="Zero resultados"
          value={zeroRate}
          hint={`${data.zeroResultSearches.toLocaleString("pt-BR")} buscas sem resposta`}
          icon={AlertTriangle}
          tone="warning"
        />
      </div>

      {/* Top terms */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            <CardTitle>Top 10 termos mais buscados</CardTitle>
          </div>
          <CardDescription>
            Ordenado por volume de buscas em {RANGE_LABEL[range].toLowerCase()}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Termo</TableHead>
                <TableHead className="text-right">Buscas</TableHead>
                <TableHead className="text-right">Média de resultados</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.topTerms.map((t, i) => (
                <TableRow key={t.term}>
                  <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                  <TableCell className="font-medium">{t.term}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {t.searches.toLocaleString("pt-BR")}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {t.avgResults.toFixed(1)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Zero results — friction alert */}
      <Card className="border-destructive/30">
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <CardTitle>Buscas com zero resultados</CardTitle>
                <Badge variant="destructive">Ação recomendada</Badge>
              </div>
              <CardDescription className="mt-1">
                Termos pesquisados que não retornaram nenhum produto. Use esta lista para
                priorizar curadoria de catálogo, sinônimos ou conteúdo.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                downloadCsv(
                  `zero-resultados-${range}-${new Date().toISOString().slice(0, 10)}.csv`,
                  data.zeroResults,
                )
              }
              disabled={data.zeroResults.length === 0}
            >
              <Download className="h-4 w-4 mr-2" />
              Exportar CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {data.zeroResults.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhuma busca sem resultado no período. 🎉
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Termo</TableHead>
                  <TableHead className="text-right">Buscas</TableHead>
                  <TableHead className="text-right">Última busca</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...data.zeroResults]
                  .sort((a, b) => b.searches - a.searches)
                  .map((t) => (
                    <TableRow key={t.term}>
                      <TableCell className="font-medium">{t.term}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {t.searches.toLocaleString("pt-BR")}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground text-sm">
                        {new Date(t.lastSearchedAt).toLocaleDateString("pt-BR")}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SearchAnalytics;
