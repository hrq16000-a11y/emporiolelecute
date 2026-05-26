import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useShippingAuditLogs } from "@/hooks/useShippingAdmin";
import { Loader2 } from "lucide-react";

export default function ShippingAuditTab() {
  const { data, isLoading } = useShippingAuditLogs();
  if (isLoading) return <Loader2 className="h-4 w-4 animate-spin" />;
  if (!data || data.length === 0) {
    return <p className="text-sm text-muted-foreground p-4">Nenhuma falha registrada. 🎉</p>;
  }
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Quando</TableHead>
            <TableHead>CEP destino</TableHead>
            <TableHead>Provedor</TableHead>
            <TableHead>HTTP</TableHead>
            <TableHead>Erro</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((l) => (
            <TableRow key={l.id}>
              <TableCell className="whitespace-nowrap">{new Date(l.created_at).toLocaleString("pt-BR")}</TableCell>
              <TableCell>{l.destination_zip ?? "—"}</TableCell>
              <TableCell>{l.provider_name ?? "—"}</TableCell>
              <TableCell>{l.http_status ?? "—"}</TableCell>
              <TableCell className="max-w-md truncate" title={l.error_message ?? ""}>{l.error_message ?? "—"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
