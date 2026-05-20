// Fase 2 — Dashboard de termos buscados pelos visitantes.
// Mostra os 30 termos com mais buscas e destaca os termos com zero resultados
// (oportunidade clara para o lojista criar um sinônimo ou pinar um produto).

import { useMemo, useState } from "react";
import { Search, AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useSearchInsights } from "@/hooks/useSearchAdmin";

interface Props {
  onCreateSynonym?: (term: string) => void;
  onCreateBoost?: (term: string) => void;
}

export default function SearchInsights({ onCreateSynonym, onCreateBoost }: Props) {
  const { data, isLoading, refetch, isFetching } = useSearchInsights();
  const [filter, setFilter] = useState("");

  const rows = useMemo(() => {
    const list = data ?? [];
    const q = filter.trim().toLowerCase();
    if (!q) return list;
    return list.filter((r) => r.term_normalized.includes(q));
  }, [data, filter]);

  const totals = useMemo(() => {
    const list = data ?? [];
    return {
      total: list.reduce((s, r) => s + r.total_searches, 0),
      zero: list.reduce((s, r) => s + r.zero_result_count, 0),
      uniqueTerms: list.length,
    };
  }, [data]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-4 w-4" /> Insights de busca (90 dias)
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            {totals.uniqueTerms} termos únicos · {totals.total} buscas · {totals.zero} sem resultado
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <Input
          placeholder="Filtrar termos…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
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
