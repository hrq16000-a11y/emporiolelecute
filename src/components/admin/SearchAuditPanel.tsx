// Log de auditoria da busca: quem criou/editou/removeu sinônimos e boosts.
// Somente admin (RLS em `search_audit_log`).

import { useMemo, useState } from "react";
import { History, Loader2, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useSearchAuditLog, type SearchAuditRow } from "@/hooks/useSearchAdmin";
import { exportCsv } from "@/lib/seoExport";

const ACTION_LABEL: Record<string, string> = {
  INSERT: "Criação",
  UPDATE: "Edição",
  DELETE: "Exclusão",
};

const ENTITY_LABEL: Record<string, string> = {
  search_boosts: "Boost",
  search_synonyms: "Sinônimo",
};

const summarize = (row: SearchAuditRow): string => {
  const payload = (row.after ?? row.before ?? {}) as Record<string, unknown>;
  const term = payload.term ?? payload.term_normalized ?? payload.canonical ?? payload.alias ?? "—";
  return String(term);
};

export default function SearchAuditPanel() {
  const { data, isLoading } = useSearchAuditLog(300);
  const [entity, setEntity] = useState("all");
  const [action, setAction] = useState("all");
  const [search, setSearch] = useState("");

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data ?? []).filter((r) => {
      if (entity !== "all" && r.entity !== entity) return false;
      if (action !== "all" && r.action !== action) return false;
      if (!q) return true;
      return (
        summarize(r).toLowerCase().includes(q) ||
        (r.actor_email ?? "").toLowerCase().includes(q)
      );
    });
  }, [data, entity, action, search]);

  const handleExport = () => {
    exportCsv(
      "busca-auditoria",
      rows.map((r) => ({
        data: new Date(r.created_at).toLocaleString("pt-BR"),
        entidade: ENTITY_LABEL[r.entity] ?? r.entity,
        acao: ACTION_LABEL[r.action] ?? r.action,
        termo: summarize(r),
        usuario: r.actor_email ?? "",
      })),
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-4 w-4" /> Auditoria de sinônimos e boosts
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Registro de todas as alterações de configuração da busca, com data e usuário.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-4">
          <Select value={entity} onValueChange={setEntity}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as entidades</SelectItem>
              <SelectItem value="search_boosts">Boosts</SelectItem>
              <SelectItem value="search_synonyms">Sinônimos</SelectItem>
            </SelectContent>
          </Select>
          <Select value={action} onValueChange={setAction}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as ações</SelectItem>
              <SelectItem value="INSERT">Criação</SelectItem>
              <SelectItem value="UPDATE">Edição</SelectItem>
              <SelectItem value="DELETE">Exclusão</SelectItem>
            </SelectContent>
          </Select>
          <Input
            placeholder="Buscar termo ou usuário…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Button variant="outline" onClick={handleExport} disabled={rows.length === 0}>
            <Download className="h-4 w-4 mr-2" /> CSV
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Nenhum registro para os filtros selecionados.
          </p>
        ) : (
          <ul className="divide-y border rounded-lg">
            {rows.map((r) => (
              <li key={r.id} className="px-3 py-2 flex flex-wrap items-center gap-2 text-sm">
                <Badge variant="outline">{ENTITY_LABEL[r.entity] ?? r.entity}</Badge>
                <Badge variant={r.action === "DELETE" ? "destructive" : "secondary"}>
                  {ACTION_LABEL[r.action] ?? r.action}
                </Badge>
                <span className="font-medium truncate max-w-[16rem]">{summarize(r)}</span>
                <span className="text-xs text-muted-foreground ml-auto">
                  {r.actor_email ?? "sistema"} · {new Date(r.created_at).toLocaleString("pt-BR")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
