import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  CreditCard,
  RefreshCw,
  Search,
  ShieldAlert,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface PaymentEvent {
  id: string;
  provider: string;
  payment_id: string | null;
  event_id: string | null;
  order_code: string | null;
  provider_status: string | null;
  applied_status: string | null;
  result: string;
  error_message: string | null;
  duration_ms: number | null;
  created_at: string;
}

const RESULT_META: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  applied: { label: "Aplicado", variant: "default" },
  duplicate: { label: "Duplicado (idempotente)", variant: "secondary" },
  stale_ignored: { label: "Evento atrasado ignorado", variant: "secondary" },
  order_not_found: { label: "Pedido não encontrado", variant: "destructive" },
  invalid_signature: { label: "Assinatura inválida", variant: "destructive" },
  provider_error: { label: "Erro do provedor", variant: "destructive" },
  error: { label: "Erro", variant: "destructive" },
  received: { label: "Recebido", variant: "outline" },
};

const FAILURE_RESULTS = ["error", "provider_error", "invalid_signature", "order_not_found"];

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "medium" });

const AdminPayments = () => {
  const [search, setSearch] = useState("");
  const [resultFilter, setResultFilter] = useState<string>("all");
  const [range, setRange] = useState<string>("7");

  const since = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - Number(range));
    return d.toISOString();
  }, [range]);

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["admin-payment-events", since],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_events")
        .select("*")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as PaymentEvent[];
    },
    staleTime: 30_000,
  });

  const events = data ?? [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return events.filter((e) => {
      if (resultFilter !== "all") {
        if (resultFilter === "failures" ? !FAILURE_RESULTS.includes(e.result) : e.result !== resultFilter) {
          return false;
        }
      }
      if (!q) return true;
      return [e.order_code, e.payment_id, e.provider_status, e.error_message]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [events, search, resultFilter]);

  const metrics = useMemo(() => {
    const total = events.length;
    const applied = events.filter((e) => e.result === "applied").length;
    const failures = events.filter((e) => FAILURE_RESULTS.includes(e.result)).length;
    const durations = events.map((e) => e.duration_ms ?? 0).filter((d) => d > 0).sort((a, b) => a - b);
    const p95 = durations.length ? durations[Math.floor(durations.length * 0.95) - 1 < 0 ? 0 : Math.floor(durations.length * 0.95) - 1] : 0;
    const avg = durations.length ? Math.round(durations.reduce((s, d) => s + d, 0) / durations.length) : 0;
    return { total, applied, failures, p95, avg, duplicates: events.filter((e) => e.result === "duplicate").length };
  }, [events]);

  const alerts = useMemo(() => {
    const out: { level: "warn" | "error"; text: string }[] = [];
    if (metrics.failures > 0) {
      out.push({
        level: "error",
        text: `${metrics.failures} evento(s) de pagamento falharam no período — investigue antes que pedidos fiquem sem confirmação.`,
      });
    }
    if (events.some((e) => e.result === "invalid_signature")) {
      out.push({ level: "error", text: "Webhooks com assinatura inválida foram rejeitados (possível tentativa de fraude)." });
    }
    if (metrics.p95 > 4000) {
      out.push({ level: "warn", text: `Latência p95 alta (${metrics.p95} ms) no processamento de webhooks.` });
    }
    return out;
  }, [metrics, events]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <CreditCard className="h-6 w-6 text-primary" aria-hidden />
            Pagamentos & Webhooks
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Log auditável de cada notificação do provedor. O pedido só é confirmado após aprovação real.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={range} onValueChange={setRange}>
            <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Últimas 24h</SelectItem>
              <SelectItem value="7">7 dias</SelectItem>
              <SelectItem value="30">30 dias</SelectItem>
              <SelectItem value="90">90 dias</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => refetch()} aria-label="Atualizar">
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((a, i) => (
            <div
              key={i}
              className={`flex items-start gap-2 rounded-lg border p-3 text-sm animate-fade-in ${
                a.level === "error"
                  ? "border-destructive/40 bg-destructive/5 text-destructive"
                  : "border-amber-500/40 bg-amber-500/5 text-amber-700 dark:text-amber-400"
              }`}
            >
              <ShieldAlert className="h-4 w-4 mt-0.5 flex-shrink-0" aria-hidden />
              <span>{a.text}</span>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Eventos", value: metrics.total, icon: Activity },
          { label: "Aprovações aplicadas", value: metrics.applied, icon: CheckCircle2 },
          { label: "Falhas", value: metrics.failures, icon: AlertTriangle },
          { label: "Latência média", value: `${metrics.avg} ms`, icon: Clock },
        ].map((m) => (
          <Card key={m.label} className="transition-shadow hover:shadow-md">
            <CardContent className="p-4">
              {isLoading ? (
                <Skeleton className="h-10 w-full" />
              ) : (
                <>
                  <div className="flex items-center gap-2 text-muted-foreground text-xs">
                    <m.icon className="h-3.5 w-3.5" aria-hidden />
                    {m.label}
                  </div>
                  <div className="text-2xl font-bold mt-1">{m.value}</div>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Log de eventos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por pedido, payment id ou erro"
                className="pl-9"
              />
            </div>
            <Select value={resultFilter} onValueChange={setResultFilter}>
              <SelectTrigger className="w-full sm:w-[220px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os resultados</SelectItem>
                <SelectItem value="failures">Somente falhas</SelectItem>
                <SelectItem value="applied">Aplicados</SelectItem>
                <SelectItem value="duplicate">Duplicados</SelectItem>
                <SelectItem value="stale_ignored">Ignorados (atrasados)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-lg" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              Nenhum evento de pagamento no período selecionado.
            </div>
          ) : (
            <ul className="space-y-2">
              {filtered.map((e, idx) => {
                const meta = RESULT_META[e.result] ?? { label: e.result, variant: "outline" as const };
                return (
                  <li
                    key={e.id}
                    className="rounded-lg border p-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between transition-colors hover:bg-muted/40 animate-fade-in"
                    style={{ animationDelay: `${Math.min(idx, 12) * 25}ms` }}
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={meta.variant}>{meta.label}</Badge>
                        {e.order_code && (
                          <Link
                            to={`/admin/pedidos?order=${e.order_code}`}
                            className="font-mono text-sm text-primary hover:underline"
                          >
                            {e.order_code}
                          </Link>
                        )}
                        {e.provider_status && (
                          <span className="text-xs text-muted-foreground">
                            provedor: {e.provider_status}
                          </span>
                        )}
                      </div>
                      {e.error_message && (
                        <p className="text-xs text-destructive mt-1 break-words">{e.error_message}</p>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground text-left sm:text-right flex-shrink-0">
                      <div>{formatDate(e.created_at)}</div>
                      <div className="font-mono">
                        {e.payment_id ? `#${e.payment_id}` : "—"}
                        {e.duration_ms ? ` · ${e.duration_ms} ms` : ""}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminPayments;
