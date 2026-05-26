import { useMemo, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useShippingAuditLogs } from "@/hooks/useShippingAdmin";
import { AlertTriangle, KeyRound, Loader2, Truck, XCircle } from "lucide-react";

type EventFilter = "all" | "provider_error" | "estimate_fallback" | "missing_credentials";

const EVENT_META: Record<string, { label: string; icon: any; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  provider_error: { label: "Erro provedor", icon: XCircle, variant: "destructive" },
  estimate_fallback: { label: "Estimativa (fallback)", icon: Truck, variant: "secondary" },
  missing_credentials: { label: "Credenciais ausentes", icon: KeyRound, variant: "destructive" },
};

export default function ShippingAuditTab() {
  const { data, isLoading } = useShippingAuditLogs();
  const [filter, setFilter] = useState<EventFilter>("all");

  const rows = useMemo(() => {
    const list = data ?? [];
    return filter === "all" ? list : list.filter((l) => (l.event_type ?? "provider_error") === filter);
  }, [data, filter]);

  const counters = useMemo(() => {
    const list = data ?? [];
    return {
      total: list.length,
      errors: list.filter((l) => (l.event_type ?? "provider_error") === "provider_error").length,
      fallback: list.filter((l) => l.event_type === "estimate_fallback").length,
      missing: list.filter((l) => l.event_type === "missing_credentials").length,
    };
  }, [data]);

  if (isLoading) return <Loader2 className="h-4 w-4 animate-spin" />;
  if (!data || data.length === 0) {
    return <p className="text-sm text-muted-foreground p-4">Nenhum evento registrado. 🎉</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-2 text-xs">
          <Badge variant="outline">{counters.total} eventos</Badge>
          <Badge variant="destructive">{counters.errors} erros</Badge>
          <Badge variant="secondary">{counters.fallback} fallbacks</Badge>
          <Badge variant="destructive" className="bg-amber-600 hover:bg-amber-600/90">
            {counters.missing} sem token
          </Badge>
        </div>
        <Select value={filter} onValueChange={(v) => setFilter(v as EventFilter)}>
          <SelectTrigger className="w-[220px] ml-auto"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os eventos</SelectItem>
            <SelectItem value="provider_error">Apenas erros</SelectItem>
            <SelectItem value="estimate_fallback">Apenas fallback estimado</SelectItem>
            <SelectItem value="missing_credentials">Credenciais ausentes</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {(counters.missing > 0 || counters.fallback > 5) && (
        <div role="alert" className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-950/30 dark:border-amber-900/60 dark:text-amber-200">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>
            {counters.missing > 0
              ? "Token do Melhor Envio ausente em chamadas recentes — clientes estão recebendo valores estimados. Configure em Provedores."
              : "Muitas cotações caíram em fallback. Verifique conectividade do Melhor Envio."}
          </span>
        </div>
      )}

      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[160px]">Quando</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>CEP destino</TableHead>
              <TableHead>Peso (kg)</TableHead>
              <TableHead>Token ME</TableHead>
              <TableHead>Provedor</TableHead>
              <TableHead>HTTP</TableHead>
              <TableHead>Mensagem</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((l) => {
              const type = l.event_type ?? "provider_error";
              const meta = EVENT_META[type] ?? EVENT_META.provider_error;
              const Icon = meta.icon;
              return (
                <TableRow key={l.id}>
                  <TableCell className="whitespace-nowrap text-xs">
                    {new Date(l.created_at).toLocaleString("pt-BR")}
                  </TableCell>
                  <TableCell>
                    <Badge variant={meta.variant} className="text-[10px] gap-1">
                      <Icon className="h-3 w-3" /> {meta.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{l.destination_zip ?? "—"}</TableCell>
                  <TableCell className="text-xs">
                    {l.total_weight_kg != null ? Number(l.total_weight_kg).toFixed(2) : "—"}
                  </TableCell>
                  <TableCell className="text-xs">
                    {l.melhor_envio_has_key == null ? (
                      "—"
                    ) : l.melhor_envio_has_key ? (
                      <span className="text-emerald-600 dark:text-emerald-400">presente</span>
                    ) : (
                      <span className="text-destructive font-medium">ausente</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs">{l.provider_name ?? "—"}</TableCell>
                  <TableCell className="text-xs">{l.http_status ?? "—"}</TableCell>
                  <TableCell className="max-w-sm truncate text-xs" title={l.error_message ?? ""}>
                    {l.error_message ?? "—"}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
