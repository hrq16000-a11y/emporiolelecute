import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ShieldCheck, History, AlertCircle, CheckCircle2, Download, FileText, ShieldOff,
  Users, UserPlus, UserMinus, ExternalLink, RefreshCw,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface UserRow {
  user_id: string;
  email: string | null;
  full_name: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
  roles: string[];
  linked_customer_id: string | null;
  linked_visitors: number;
}

interface AuditRow {
  id: string;
  promoted_by_email: string | null;
  target_email: string;
  role: string;
  status: string;
  message: string | null;
  created_at: string;
}

const AdminUsers = () => {
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterText, setFilterText] = useState("");

  const { data: audit = [], isLoading } = useQuery({
    queryKey: ["role_promotion_audit"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("role_promotion_audit")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data || []) as AuditRow[];
    },
  });

  const promote = useMutation({
    mutationFn: async (target: string) => {
      const { data, error } = await (supabase as any).rpc("promote_user_to_admin", { _email: target });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      if (data?.success) {
        toast.success(data.already ? "Usuário já era admin." : "Usuário promovido a admin.");
        setEmail("");
      } else {
        toast.error(data?.error || "Falha ao promover.");
      }
      qc.invalidateQueries({ queryKey: ["role_promotion_audit"] });
    },
    onError: (e: any) => {
      toast.error(e.message || "Erro ao promover");
      qc.invalidateQueries({ queryKey: ["role_promotion_audit"] });
    },
  });

  const handlePromote = (e: React.FormEvent) => {
    e.preventDefault();
    const v = email.trim();
    if (!v || !v.includes("@")) {
      toast.error("Informe um e-mail válido");
      return;
    }
    if (!confirm(`Confirmar promoção de ${v} a administrador?`)) return;
    promote.mutate(v);
  };

  // ============== Lista de usuários ==============
  const [userSearch, setUserSearch] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState<string>("all");

  const usersQ = useQuery({
    queryKey: ["admin-all-users", userSearch, userRoleFilter],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("list_all_users", {
        _search: userSearch || null,
        _role: userRoleFilter,
      });
      if (error) throw error;
      return ((data as any)?.rows || []) as UserRow[];
    },
  });

  const setRole = useMutation({
    mutationFn: async (p: { user_id: string; role: string; action: "add" | "remove" }) => {
      const { data, error } = await (supabase as any).rpc("set_user_role", {
        _user_id: p.user_id, _role: p.role, _action: p.action,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, vars) => {
      toast.success(vars.action === "add" ? `Papel "${vars.role}" adicionado.` : `Papel "${vars.role}" removido.`);
      qc.invalidateQueries({ queryKey: ["admin-all-users"] });
      qc.invalidateQueries({ queryKey: ["role_promotion_audit"] });
    },
    onError: (e: any) => toast.error(e.message || "Falha ao atualizar papel"),
  });

  const toggleRole = (u: UserRow, role: "admin" | "editor") => {
    const has = u.roles.includes(role);
    const action = has ? "remove" : "add";
    const label = role === "admin" ? "administrador" : "editor";
    if (!confirm(`Confirmar ${has ? "remoção" : "atribuição"} do papel de ${label} para ${u.email}?`)) return;
    setRole.mutate({ user_id: u.user_id, role, action });
  };

  const filtered = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    return audit.filter((r) => {
      if (filterStatus !== "all" && r.status !== filterStatus) return false;
      if (q && !r.target_email.toLowerCase().includes(q) && !(r.promoted_by_email || "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [audit, filterStatus, filterText]);

  const exportCSV = () => {
    if (!filtered.length) {
      toast.info("Nada para exportar.");
      return;
    }
    const header = ["Data/hora", "E-mail alvo", "Realizado por", "Papel", "Status", "Mensagem"];
    const escape = (v: any) => {
      const s = v === null || v === undefined ? "" : String(v);
      return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows = filtered.map((r) => [
      format(new Date(r.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR }),
      r.target_email,
      r.promoted_by_email || "",
      r.role,
      r.status,
      r.message || "",
    ]);
    const csv = [header, ...rows].map((row) => row.map(escape).join(",")).join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `auditoria-admin-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success("CSV exportado.");
  };

  const exportPDF = () => {
    if (!filtered.length) {
      toast.info("Nada para exportar.");
      return;
    }
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(14);
    doc.text("Auditoria de papéis admin", 14, 16);
    doc.setFontSize(9);
    doc.text(`Gerado em ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })} — ${filtered.length} registros`, 14, 22);
    autoTable(doc, {
      startY: 26,
      head: [["Data/hora", "E-mail alvo", "Realizado por", "Status", "Mensagem"]],
      body: filtered.map((r) => [
        format(new Date(r.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR }),
        r.target_email,
        r.promoted_by_email || "—",
        r.status,
        r.message || "—",
      ]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [180, 90, 80] },
    });
    doc.save(`auditoria-admin-${new Date().toISOString().slice(0, 10)}.pdf`);
    toast.success("PDF exportado.");
  };

  const buildSummary = () => {
    const counts: Record<string, number> = {};
    for (const r of audit) counts[r.status] = (counts[r.status] || 0) + 1;
    return counts;
  };

  const exportConsolidatedCSV = () => {
    if (!audit.length) return toast.info("Nada para exportar.");
    const summary = buildSummary();
    const escape = (v: any) => {
      const s = v === null || v === undefined ? "" : String(v);
      return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines: string[] = [];
    lines.push("# Relatório consolidado de promoções e solicitações de acesso");
    lines.push(`# Gerado em ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}`);
    lines.push(`# Total de eventos: ${audit.length}`);
    Object.entries(summary).forEach(([k, v]) => lines.push(`# ${k}: ${v}`));
    lines.push("");
    const header = ["Data/hora", "Evento", "E-mail alvo", "Realizado por", "Papel", "Mensagem"];
    lines.push(header.map(escape).join(","));
    audit.forEach((r) => {
      lines.push([
        format(new Date(r.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR }),
        r.status,
        r.target_email,
        r.promoted_by_email || "",
        r.role,
        r.message || "",
      ].map(escape).join(","));
    });
    const blob = new Blob([`\uFEFF${lines.join("\n")}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio-consolidado-usuarios-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success("Relatório CSV exportado.");
  };

  const exportConsolidatedPDF = () => {
    if (!audit.length) return toast.info("Nada para exportar.");
    const summary = buildSummary();
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(16);
    doc.text("Relatório consolidado — Promoções & Solicitações de acesso", 14, 16);
    doc.setFontSize(10);
    doc.text(
      `Gerado em ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })} — ${audit.length} eventos no total`,
      14,
      23,
    );
    autoTable(doc, {
      startY: 28,
      head: [["Status", "Total"]],
      body: Object.entries(summary).map(([k, v]) => [k, String(v)]),
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [180, 90, 80] },
      margin: { left: 14 },
      tableWidth: 80,
    });
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 8,
      head: [["Data/hora", "Evento", "E-mail alvo", "Realizado por", "Mensagem"]],
      body: audit.map((r) => [
        format(new Date(r.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR }),
        r.status,
        r.target_email,
        r.promoted_by_email || "—",
        r.message || "—",
      ]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [180, 90, 80] },
    });
    doc.save(`relatorio-consolidado-usuarios-${new Date().toISOString().slice(0, 10)}.pdf`);
    toast.success("Relatório PDF exportado.");
  };

  const statusBadge = (s: string) => {
    if (s === "success") return <span className="inline-flex items-center gap-1 text-emerald-600 text-xs"><CheckCircle2 className="h-3 w-3" /> sucesso</span>;
    if (s === "noop") return <span className="text-xs text-muted-foreground">já era admin</span>;
    if (s === "error") return <span className="inline-flex items-center gap-1 text-destructive text-xs"><AlertCircle className="h-3 w-3" /> erro</span>;
    if (s === "requested") return <span className="text-xs text-blue-600">solicitado</span>;
    if (s === "revoked") return <span className="inline-flex items-center gap-1 text-amber-600 text-xs"><ShieldOff className="h-3 w-3" /> revogado</span>;
    if (s === "rejected") return <span className="inline-flex items-center gap-1 text-destructive text-xs"><AlertCircle className="h-3 w-3" /> reprovado</span>;
    return <span className="text-xs">{s}</span>;
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-display text-foreground flex items-center gap-2">
          <ShieldCheck className="h-7 w-7" /> Usuários e permissões
        </h1>
        <p className="text-muted-foreground">
          Gerencie todos os usuários autenticados, papéis e veja o vínculo com clientes do CRM. Para visitantes anônimos e contatos sem login, use <Link to="/admin/clientes" className="underline">/admin/clientes</Link>.
        </p>
      </div>

      {/* ============== Lista de usuários ============== */}
      <Card className="p-5 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="font-medium flex items-center gap-2">
            <Users className="h-4 w-4" /> Lista de usuários ({usersQ.data?.length ?? 0})
          </h2>
          <Button size="sm" variant="ghost" onClick={() => qc.invalidateQueries({ queryKey: ["admin-all-users"] })}>
            <RefreshCw className="h-4 w-4 mr-2" /> Recarregar
          </Button>
        </div>
        <div className="flex flex-col md:flex-row gap-2">
          <Input
            placeholder="Buscar por nome ou e-mail…"
            value={userSearch}
            onChange={(e) => setUserSearch(e.target.value)}
            className="md:max-w-sm"
          />
          <select
            value={userRoleFilter}
            onChange={(e) => setUserRoleFilter(e.target.value)}
            className="border rounded-md bg-background px-3 py-2 text-sm"
          >
            <option value="all">Todos os papéis</option>
            <option value="admin">Admin</option>
            <option value="editor">Editor</option>
            <option value="customer">Customer</option>
            <option value="none">Sem papel</option>
          </select>
        </div>
        {usersQ.isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando usuários…</p>
        ) : (usersQ.data?.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum usuário encontrado com os filtros atuais.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground border-b">
                <tr>
                  <th className="py-2 pr-3">Usuário</th>
                  <th className="py-2 pr-3">Papéis</th>
                  <th className="py-2 pr-3">Cadastro</th>
                  <th className="py-2 pr-3">Último login</th>
                  <th className="py-2 pr-3">Cliente CRM</th>
                  <th className="py-2 pr-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {usersQ.data!.map((u) => (
                  <tr key={u.user_id} className="border-b last:border-0 align-top">
                    <td className="py-2 pr-3">
                      <div className="font-medium break-all">{u.full_name || "—"}</div>
                      <div className="text-xs text-muted-foreground break-all">{u.email}</div>
                      {!u.email_confirmed_at && (
                        <div className="text-[10px] text-amber-600 mt-0.5">e-mail não confirmado</div>
                      )}
                    </td>
                    <td className="py-2 pr-3">
                      <div className="flex flex-wrap gap-1">
                        {u.roles.length === 0 ? (
                          <span className="text-xs text-muted-foreground">sem papel</span>
                        ) : (
                          u.roles.map((r) => (
                            <Badge key={r} variant={r === "admin" ? "default" : "secondary"} className="text-xs">
                              {r}
                            </Badge>
                          ))
                        )}
                      </div>
                    </td>
                    <td className="py-2 pr-3 text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(u.created_at), "dd/MM/yyyy", { locale: ptBR })}
                    </td>
                    <td className="py-2 pr-3 text-xs text-muted-foreground whitespace-nowrap">
                      {u.last_sign_in_at
                        ? format(new Date(u.last_sign_in_at), "dd/MM/yyyy HH:mm", { locale: ptBR })
                        : "nunca"}
                    </td>
                    <td className="py-2 pr-3">
                      {u.linked_customer_id ? (
                        <Link
                          to={`/admin/clientes?customer=${u.linked_customer_id}`}
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          ver ficha <ExternalLink className="h-3 w-3" />
                        </Link>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-right whitespace-nowrap">
                      <Button
                        size="sm"
                        variant={u.roles.includes("admin") ? "outline" : "default"}
                        className="mr-1"
                        disabled={setRole.isPending}
                        onClick={() => toggleRole(u, "admin")}
                      >
                        {u.roles.includes("admin") ? (<><UserMinus className="h-3 w-3 mr-1" /> Admin</>) : (<><UserPlus className="h-3 w-3 mr-1" /> Admin</>)}
                      </Button>
                      <Button
                        size="sm"
                        variant={u.roles.includes("editor") ? "outline" : "secondary"}
                        disabled={setRole.isPending}
                        onClick={() => toggleRole(u, "editor")}
                      >
                        {u.roles.includes("editor") ? (<><UserMinus className="h-3 w-3 mr-1" /> Editor</>) : (<><UserPlus className="h-3 w-3 mr-1" /> Editor</>)}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="p-5 space-y-4">
        <h2 className="font-medium">Promover usuário a admin por e-mail</h2>

        <form onSubmit={handlePromote} className="flex flex-col md:flex-row gap-3 items-end">
          <div className="flex-1 space-y-1 w-full">
            <Label htmlFor="promoteEmail">E-mail do usuário</Label>
            <Input
              id="promoteEmail"
              type="email"
              placeholder="usuario@exemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={promote.isPending || !email}>
            <ShieldCheck className="h-4 w-4 mr-2" />
            {promote.isPending ? "Promovendo..." : "Confirmar permissão"}
          </Button>
        </form>
        <p className="text-xs text-muted-foreground">
          Dica: peça para o usuário acessar <code>/admin/login</code> e entrar com Google ou e-mail/senha primeiro. Depois informe o e-mail aqui.
        </p>
      </Card>

      <Card className="p-5 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="font-medium flex items-center gap-2">
            <History className="h-4 w-4" /> Histórico ({filtered.length}/{audit.length})
          </h2>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={exportCSV} disabled={!filtered.length}>
              <Download className="h-4 w-4 mr-2" /> CSV (filtrado)
            </Button>
            <Button size="sm" variant="outline" onClick={exportPDF} disabled={!filtered.length}>
              <FileText className="h-4 w-4 mr-2" /> PDF (filtrado)
            </Button>
            <Button size="sm" onClick={exportConsolidatedCSV} disabled={!audit.length}>
              <Download className="h-4 w-4 mr-2" /> Relatório CSV
            </Button>
            <Button size="sm" onClick={exportConsolidatedPDF} disabled={!audit.length}>
              <FileText className="h-4 w-4 mr-2" /> Relatório PDF
            </Button>
          </div>
        </div>
        <div className="flex flex-col md:flex-row gap-2">
          <Input
            placeholder="Buscar por e-mail..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            className="md:max-w-xs"
          />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="border rounded-md bg-background px-3 py-2 text-sm"
          >
            <option value="all">Todos os status</option>
            <option value="success">Sucesso</option>
            <option value="error">Erro</option>
            <option value="noop">Já era admin</option>
            <option value="requested">Solicitado</option>
            <option value="revoked">Revogado</option>
            <option value="rejected">Reprovado</option>
          </select>
        </div>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum registro com os filtros atuais.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground border-b">
                <tr>
                  <th className="py-2 pr-3">Data/hora</th>
                  <th className="py-2 pr-3">E-mail alvo</th>
                  <th className="py-2 pr-3">Realizado por</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Detalhes</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="py-2 pr-3 whitespace-nowrap text-muted-foreground">
                      {format(new Date(r.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </td>
                    <td className="py-2 pr-3 break-all">{r.target_email}</td>
                    <td className="py-2 pr-3 break-all text-muted-foreground">{r.promoted_by_email || "—"}</td>
                    <td className="py-2 pr-3">{statusBadge(r.status)}</td>
                    <td className="py-2 pr-3 text-xs text-muted-foreground">{r.message || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};


export default AdminUsers;
