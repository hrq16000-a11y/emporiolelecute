import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useContactInfo } from "@/hooks/useContactInfo";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  ShieldCheck, History, AlertCircle, CheckCircle2, Download, ShieldOff,
  Users, UserPlus, UserMinus, ExternalLink, RefreshCw, ArrowUpDown, ArrowUp, ArrowDown,
  Mail, Calendar, LogIn, User as UserIcon, Link2, Copy, MessageCircle, FileEdit,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface UserRow {
  source: "auth" | "customer" | "visitor" | "order";
  user_id: string;
  email: string | null;
  full_name: string | null;
  whatsapp: string | null;
  last_ip: string | null;
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

type SortKey = "created_at" | "last_sign_in_at" | "email_confirmed_at" | "role" | "email" | "full_name" | "source";
type SortDir = "asc" | "desc";
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

const csvEscape = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const downloadCSV = (filename: string, rows: (string | number | null | undefined)[][]) => {
  const csv = rows.map((r) => r.map(csvEscape).join(",")).join("\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
};

const AdminUsers = () => {
  const qc = useQueryClient();
  const { user: currentAuthUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // ====== Filters / paging state (inicializados da URL para persistir ao recarregar) ======
  const initialUrl = searchParams;
  const [search, setSearch] = useState(initialUrl.get("q") || "");
  const [roleFilter, setRoleFilter] = useState(initialUrl.get("role") || "all");
  const [sourceFilter, setSourceFilter] = useState(initialUrl.get("src") || "all");
  const [whatsappFilter, setWhatsappFilter] = useState(initialUrl.get("wa") || "");
  const [ipFilter, setIpFilter] = useState(initialUrl.get("ip") || "");
  const [sortKey, setSortKey] = useState<SortKey>((initialUrl.get("sk") as SortKey) || "created_at");
  const [sortDir, setSortDir] = useState<SortDir>((initialUrl.get("sd") as SortDir) || "desc");
  const [page, setPage] = useState(Number(initialUrl.get("pg")) || 1);
  const [pageSize, setPageSize] = useState(Number(initialUrl.get("ps")) || 25);

  const [selected, setSelected] = useState<UserRow | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState<"perfil" | "auditoria">("perfil");
  const { buildWhatsappUrl } = useContactInfo();

  // Sincroniza filtros com a URL (mantém ao recarregar / compartilhar)
  const syncRef = useRef(false);
  useEffect(() => {
    if (!syncRef.current) { syncRef.current = true; return; }
    const next = new URLSearchParams(searchParams);
    const setOrDel = (k: string, v: string, defVal?: string) => {
      if (!v || v === defVal) next.delete(k); else next.set(k, v);
    };
    setOrDel("q", search);
    setOrDel("role", roleFilter, "all");
    setOrDel("src", sourceFilter, "all");
    setOrDel("wa", whatsappFilter);
    setOrDel("ip", ipFilter);
    setOrDel("sk", sortKey, "created_at");
    setOrDel("sd", sortDir, "desc");
    setOrDel("pg", page > 1 ? String(page) : "");
    setOrDel("ps", pageSize !== 25 ? String(pageSize) : "");
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, roleFilter, sourceFilter, whatsappFilter, ipFilter, sortKey, sortDir, page, pageSize]);

  // Contadores por fonte
  const countsQ = useQuery({
    queryKey: ["users-source-counts"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("users_source_counts");
      if (error) throw error;
      return data as Record<string, number>;
    },
  });

  // ====== Query: paginated users ======
  const usersQ = useQuery({
    queryKey: ["users-pag", search, roleFilter, sourceFilter, whatsappFilter, ipFilter, sortKey, sortDir, page, pageSize],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("list_all_users_paginated", {
        _search: search || null,
        _role: roleFilter,
        _source: sourceFilter,
        _whatsapp: whatsappFilter || null,
        _ip: ipFilter || null,
        _sort_key: sortKey,
        _sort_dir: sortDir,
        _limit: pageSize,
        _offset: (page - 1) * pageSize,
      });
      if (error) throw error;
      return { rows: ((data as any)?.rows || []) as UserRow[], total: Number((data as any)?.total || 0) };
    },
  });
  const rows = usersQ.data?.rows || [];
  const total = usersQ.data?.total || 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // ====== Deep link ?user=<id> ======
  useEffect(() => {
    const uid = searchParams.get("user");
    if (!uid) return;
    if (selected?.user_id === uid) return;
    // procura nos rows carregados; senão busca pontual
    const found = rows.find((r) => r.user_id === uid);
    if (found) { setSelected(found); return; }
    // fallback: busca direta (1 página por id)
    (async () => {
      const { data } = await (supabase as any).rpc("list_all_users_paginated", {
        _search: uid.replace(/^(auth|customer|visitor|order):/, ""),
        _role: "all", _source: "all", _whatsapp: null, _ip: null,
        _sort_key: "created_at", _sort_dir: "desc", _limit: 50, _offset: 0,
      });
      const list = ((data as any)?.rows || []) as UserRow[];
      const u = list.find((r) => r.user_id === uid);
      if (u) setSelected(u);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, rows]);

  const openUser = (u: UserRow) => {
    setSelected(u);
    setDrawerTab("perfil");
    const next = new URLSearchParams(searchParams);
    next.set("user", u.user_id);
    setSearchParams(next, { replace: true });
  };
  const closeUser = () => {
    setSelected(null);
    const next = new URLSearchParams(searchParams);
    next.delete("user");
    setSearchParams(next, { replace: true });
  };

  // ====== Mutations ======
  const setRole = useMutation({
    mutationFn: async (p: { user_id: string; role: string; action: "add" | "remove" }) => {
      const { data, error } = await (supabase as any).rpc("set_user_role", {
        _user_id: p.user_id, _role: p.role, _action: p.action,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Papel atualizado.");
      qc.invalidateQueries({ queryKey: ["users-pag"] });
    },
    onError: (e: any) => toast.error(e.message || "Falha ao atualizar papel"),
  });

  const toggleRole = (u: UserRow, role: "admin" | "editor") => {
    if (u.source !== "auth") { toast.error("Contato sem login. Crie ou convide o usuário primeiro."); return; }
    const has = u.roles.includes(role);
    const authId = u.user_id.replace(/^auth:/, "");
    if (role === "admin" && has) {
      toast.error("O papel de admin não pode ser removido. Administradores têm acesso permanente.");
      return;
    }
    if (!confirm(`Confirmar ${has ? "remoção" : "atribuição"} do papel ${role} para ${u.email}?`)) return;
    setRole.mutate({ user_id: authId, role, action: has ? "remove" : "add" });
  };

  const [editingName, setEditingName] = useState("");
  const updateName = useMutation({
    mutationFn: async (p: { user_id: string; full_name: string }) => {
      const { error } = await (supabase as any).rpc("update_user_profile", { _user_id: p.user_id, _full_name: p.full_name });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Nome atualizado."); qc.invalidateQueries({ queryKey: ["users-pag"] }); },
    onError: (e: any) => toast.error(e.message || "Falha"),
  });

  const migrateVisitor = useMutation({
    mutationFn: async (visitorId: string) => {
      const { data, error } = await (supabase as any).rpc("migrate_visitor_to_customer", { _visitor_id: visitorId });
      if (error) throw error;
      return data;
    },
    onSuccess: (d: any) => {
      toast.success(d?.created ? "Cliente criado a partir do visitante." : "Visitante vinculado a cliente existente.");
      qc.invalidateQueries({ queryKey: ["users-pag"] });
    },
    onError: (e: any) => toast.error(e.message || "Falha na migração"),
  });

  const promoteContact = useMutation({
    // pega email+nome+phone do "order/auth/visitor" e cria customer simples
    mutationFn: async (u: UserRow) => {
      const payload = {
        name: u.full_name || u.email || u.whatsapp || "Contato",
        email: u.email,
        whatsapp: u.whatsapp,
        phone: u.whatsapp,
        source: u.source,
        status: "active",
        notes: `Migrado de ${u.source}. ${u.last_ip ? "IP: " + u.last_ip : ""}`,
      };
      const { error } = await supabase.from("customers").insert(payload as any);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Ficha de cliente criada."); qc.invalidateQueries({ queryKey: ["users-pag"] }); },
    onError: (e: any) => toast.error(e.message || "Falha"),
  });

  const handleMigrateToCustomer = (u: UserRow) => {
    if (u.source === "customer") { toast.info("Já é cliente."); return; }
    if (u.source === "visitor") {
      migrateVisitor.mutate(u.user_id.replace(/^visitor:/, ""));
    } else {
      if (!confirm(`Criar ficha de cliente CRM para ${u.email || u.whatsapp}?`)) return;
      promoteContact.mutate(u);
    }
  };

  // ====== Sort UI ======
  const handleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir("desc"); }
    setPage(1);
  };
  const sortIcon = (k: SortKey) =>
    sortKey !== k ? <ArrowUpDown className="h-3 w-3 inline ml-1 opacity-50" />
    : sortDir === "asc" ? <ArrowUp className="h-3 w-3 inline ml-1" />
    : <ArrowDown className="h-3 w-3 inline ml-1" />;

  // ====== CSV de todos os usuários filtrados (multi-page) ======
  const [exporting, setExporting] = useState(false);
  const exportAllCSV = async () => {
    if (!total) return toast.info("Nada para exportar.");
    setExporting(true);
    const all: UserRow[] = [];
    const batch = 1000;
    try {
      for (let off = 0; off < total; off += batch) {
        const { data, error } = await (supabase as any).rpc("list_all_users_paginated", {
          _search: search || null,
          _role: roleFilter,
          _source: sourceFilter,
          _whatsapp: whatsappFilter || null,
          _ip: ipFilter || null,
          _sort_key: sortKey,
          _sort_dir: sortDir,
          _limit: batch,
          _offset: off,
        });
        if (error) throw error;
        all.push(...(((data as any)?.rows || []) as UserRow[]));
      }
      const header = ["Origem","Nome","E-mail","WhatsApp","IP","Papéis","Cadastro","Último login","E-mail confirmado","Cliente CRM"];
      const body = all.map((u) => [
        u.source,
        u.full_name || "",
        u.email || "",
        u.whatsapp || "",
        u.last_ip || "",
        u.roles.join(" | "),
        u.created_at ? format(new Date(u.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "",
        u.last_sign_in_at ? format(new Date(u.last_sign_in_at), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "",
        u.email_confirmed_at ? "sim" : "não",
        u.linked_customer_id || "",
      ]);
      downloadCSV(`usuarios-${new Date().toISOString().slice(0,10)}.csv`, [header, ...body]);
      toast.success(`CSV exportado (${all.length} registros).`);
    } catch (e: any) {
      toast.error(e.message || "Falha na exportação");
    } finally {
      setExporting(false);
    }
  };

  const statusBadge = (s: string) => {
    if (s === "success") return <span className="inline-flex items-center gap-1 text-emerald-600 text-xs"><CheckCircle2 className="h-3 w-3" />sucesso</span>;
    if (s === "noop") return <span className="text-xs text-muted-foreground">já era admin</span>;
    if (s === "error") return <span className="inline-flex items-center gap-1 text-destructive text-xs"><AlertCircle className="h-3 w-3" />erro</span>;
    if (s === "requested") return <span className="text-xs text-blue-600">solicitado</span>;
    if (s === "revoked") return <span className="inline-flex items-center gap-1 text-amber-600 text-xs"><ShieldOff className="h-3 w-3" />revogado</span>;
    if (s === "rejected") return <span className="inline-flex items-center gap-1 text-destructive text-xs"><AlertCircle className="h-3 w-3" />reprovado</span>;
    return <span className="text-xs">{s}</span>;
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-display text-foreground flex items-center gap-2">
            <ShieldCheck className="h-7 w-7" /> Usuários e permissões
          </h1>
          <p className="text-muted-foreground">
            Gestão unificada: usuários com login, clientes do CRM, visitantes e contatos de pedidos.{" "}
            <Link to="/admin/clientes" className="underline">Ir para o CRM</Link>.
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setCreateOpen(true)}>
            <UserPlus className="h-4 w-4 mr-2" /> Novo usuário
          </Button>
        </div>
      </div>

      <Card className="p-5 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="font-medium flex items-center gap-2">
            <Users className="h-4 w-4" /> Lista ({total})
          </h2>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={exportAllCSV} disabled={!total || exporting}>
              <Download className="h-4 w-4 mr-2" /> {exporting ? "Exportando…" : "Exportar CSV"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => {
              qc.invalidateQueries({ queryKey: ["users-pag"] });
              qc.invalidateQueries({ queryKey: ["users-source-counts"] });
              toast.success("Dados sincronizados.");
            }}>
              <RefreshCw className="h-4 w-4 mr-2" /> Sincronizar
            </Button>
          </div>
        </div>

        {/* Contadores por fonte */}
        {countsQ.data && (
          <div className="grid grid-cols-2 md:grid-cols-6 gap-2 pt-1">
            {[
              { k: "auth", lbl: "Com login", val: countsQ.data.auth, src: "auth" },
              { k: "customer", lbl: "CRM", val: countsQ.data.customer, src: "customer" },
              { k: "visitor", lbl: "Visitantes", val: countsQ.data.visitor, src: "visitor" },
              { k: "order", lbl: "Pedidos (e-mails únicos)", val: countsQ.data.order, src: "order" },
              { k: "admin", lbl: "Admins", val: countsQ.data.admin, src: null },
              { k: "editor", lbl: "Editores", val: countsQ.data.editor, src: null },
            ].map((c) => (
              <button
                key={c.k}
                onClick={() => { if (c.src) { setSourceFilter(c.src); setPage(1); } }}
                className={`text-left border rounded-md px-3 py-2 transition ${c.src ? "hover:bg-muted/40 cursor-pointer" : "cursor-default"} ${sourceFilter === c.src ? "border-primary bg-primary/5" : ""}`}
              >
                <div className="text-[10px] uppercase text-muted-foreground">{c.lbl}</div>
                <div className="text-lg font-medium">{c.val ?? 0}</div>
              </button>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
          <Input placeholder="Buscar nome/e-mail…" value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="md:col-span-2" />
          <Input placeholder="WhatsApp/telefone" value={whatsappFilter}
            onChange={(e) => { setWhatsappFilter(e.target.value); setPage(1); }} />
          <Input placeholder="IP (visitantes)" value={ipFilter}
            onChange={(e) => { setIpFilter(e.target.value); setPage(1); }} />
          <select value={roleFilter}
            onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
            className="border rounded-md bg-background px-3 py-2 text-sm">
            <option value="all">Todos os papéis</option>
            <option value="admin">Admin</option>
            <option value="editor">Editor</option>
            <option value="customer">Customer</option>
            <option value="none">Sem papel</option>
          </select>
          <select value={sourceFilter}
            onChange={(e) => { setSourceFilter(e.target.value); setPage(1); }}
            className="border rounded-md bg-background px-3 py-2 text-sm">
            <option value="all">Todas as origens</option>
            <option value="auth">Com login</option>
            <option value="customer">CRM</option>
            <option value="visitor">Visitante</option>
            <option value="order">Pedido</option>
          </select>
        </div>

        {usersQ.isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : total === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum registro com os filtros atuais.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-muted-foreground border-b">
                  <tr>
                    <th className="py-2 pr-3 cursor-pointer" onClick={() => handleSort("full_name")}>Usuário {sortIcon("full_name")}</th>
                    <th className="py-2 pr-3 cursor-pointer" onClick={() => handleSort("source")}>Origem {sortIcon("source")}</th>
                    <th className="py-2 pr-3 cursor-pointer" onClick={() => handleSort("role")}>Papéis {sortIcon("role")}</th>
                    <th className="py-2 pr-3 cursor-pointer" onClick={() => handleSort("created_at")}>Cadastro {sortIcon("created_at")}</th>
                    <th className="py-2 pr-3 cursor-pointer" onClick={() => handleSort("last_sign_in_at")}>Último login {sortIcon("last_sign_in_at")}</th>
                    <th className="py-2 pr-3">IP / CRM</th>
                    <th className="py-2 pr-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((u) => (
                    <tr key={u.user_id} className="border-b last:border-0 align-top hover:bg-muted/30">
                      <td className="py-2 pr-3">
                        <button onClick={() => openUser(u)} className="text-left hover:underline">
                          <div className="font-medium break-all">{u.full_name || u.email || u.whatsapp || "—"}</div>
                          <div className="text-xs text-muted-foreground break-all">{u.email || u.whatsapp || "—"}</div>
                        </button>
                      </td>
                      <td className="py-2 pr-3">
                        <Badge variant={u.source === "auth" ? "default" : "outline"} className="text-[10px]">
                          {u.source === "auth" ? "login" : u.source === "customer" ? "CRM" : u.source}
                        </Badge>
                      </td>
                      <td className="py-2 pr-3">
                        <div className="flex flex-wrap gap-1">
                          {u.source !== "auth" ? <span className="text-xs text-muted-foreground italic">sem login</span>
                          : u.roles.length === 0 ? <span className="text-xs text-muted-foreground">—</span>
                          : u.roles.map((r) => <Badge key={r} variant={r === "admin" ? "default" : "secondary"} className="text-xs">{r}</Badge>)}
                        </div>
                      </td>
                      <td className="py-2 pr-3 text-xs text-muted-foreground whitespace-nowrap">
                        {u.created_at ? format(new Date(u.created_at), "dd/MM/yyyy", { locale: ptBR }) : "—"}
                      </td>
                      <td className="py-2 pr-3 text-xs text-muted-foreground whitespace-nowrap">
                        {u.last_sign_in_at ? format(new Date(u.last_sign_in_at), "dd/MM/yyyy HH:mm", { locale: ptBR }) : u.source === "auth" ? "nunca" : "—"}
                      </td>
                      <td className="py-2 pr-3 text-xs">
                        {u.last_ip && <div className="font-mono">{u.last_ip}</div>}
                        {u.linked_customer_id && (
                          <Link to={`/admin/clientes?customer=${u.linked_customer_id}`} className="text-primary hover:underline inline-flex items-center gap-1">
                            ver ficha <ExternalLink className="h-3 w-3" />
                          </Link>
                        )}
                      </td>
                      <td className="py-2 pr-3 text-right whitespace-nowrap">
                        {u.source !== "customer" && !u.linked_customer_id && !u.roles.includes("admin") && (
                          <Button size="sm" variant="outline" className="mr-1" onClick={() => handleMigrateToCustomer(u)}>
                            <Link2 className="h-3 w-3 mr-1" /> → Cliente
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => openUser(u)}>Abrir</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between flex-wrap gap-2 pt-2">
              <div className="flex items-center gap-2">
                <p className="text-xs text-muted-foreground">
                  {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} de {total}
                </p>
                <select value={pageSize}
                  onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                  className="border rounded-md bg-background px-2 py-1 text-xs">
                  {PAGE_SIZE_OPTIONS.map((n) => <option key={n} value={n}>{n}/pág</option>)}
                </select>
              </div>
              <div className="flex items-center gap-1">
                <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(1)}>«</Button>
                <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>‹</Button>
                <span className="px-2 text-xs">Pág. {page} de {totalPages}</span>
                <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>›</Button>
                <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(totalPages)}>»</Button>
              </div>
            </div>
          </>
        )}
      </Card>

      {/* ============ Drawer ============ */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && closeUser()}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <UserIcon className="h-5 w-5" /> {selected.full_name || "(sem nome)"}
                </SheetTitle>
                <SheetDescription className="break-all flex items-center gap-2">
                  {selected.email || selected.whatsapp || "—"}
                  <Button size="sm" variant="ghost" className="h-6 px-1"
                    onClick={() => {
                      const link = `${window.location.origin}/admin/usuarios?user=${encodeURIComponent(selected.user_id)}`;
                      navigator.clipboard.writeText(link);
                      toast.success("Link copiado.");
                    }}>
                    <Copy className="h-3 w-3" />
                  </Button>
                </SheetDescription>
              </SheetHeader>

              <Tabs value={drawerTab} onValueChange={(v) => setDrawerTab(v as any)} className="mt-4">
                <TabsList>
                  <TabsTrigger value="perfil">Perfil</TabsTrigger>
                  <TabsTrigger value="auditoria">Auditoria</TabsTrigger>
                </TabsList>

                <TabsContent value="perfil" className="mt-4 space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <Badge variant="outline" className="text-[10px]">origem: {selected.source}</Badge>
                    <div className="flex gap-2 flex-wrap">
                      {selected.whatsapp && (
                        <Button size="sm" variant="outline" asChild>
                          <a
                            href={buildWhatsappUrl(
                              `Olá ${selected.full_name?.split(" ")[0] || ""}! Aqui é do Empório Lele Cute. Como podemos te ajudar?`
                            )}
                            target="_blank" rel="noopener noreferrer"
                          >
                            <MessageCircle className="h-3 w-3 mr-1" /> WhatsApp
                          </a>
                        </Button>
                      )}
                      {selected.source !== "customer" && !selected.linked_customer_id && !selected.roles.includes("admin") && (
                        <Button size="sm" variant="outline" onClick={() => handleMigrateToCustomer(selected)}>
                          <Link2 className="h-3 w-3 mr-1" /> Migrar para cliente
                        </Button>
                      )}
                    </div>
                  </div>


                  {selected.source === "auth" ? (
                    <div className="space-y-1">
                      <Label className="text-xs">Nome completo</Label>
                      <div className="flex gap-2">
                        <Input
                          value={editingName !== "" ? editingName : (selected.full_name || "")}
                          onChange={(e) => setEditingName(e.target.value)}
                        />
                        <Button size="sm"
                          disabled={updateName.isPending || !editingName.trim() || editingName.trim() === (selected.full_name || "")}
                          onClick={() => updateName.mutate(
                            { user_id: selected.user_id, full_name: editingName.trim() },
                            { onSuccess: () => setEditingName("") },
                          )}>Salvar</Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Contato sem login. Para gerenciar dados completos, use o{" "}
                      <Link to="/admin/clientes" className="text-primary underline">CRM</Link>.
                    </p>
                  )}

                  <div className="grid gap-2 text-sm pt-2">
                    {selected.email && <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" />{selected.email}</div>}
                    {selected.whatsapp && <div>WhatsApp: <strong>{selected.whatsapp}</strong></div>}
                    {selected.last_ip && <div>IP: <span className="font-mono">{selected.last_ip}</span></div>}
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="h-4 w-4" /> {format(new Date(selected.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </div>
                    {selected.source === "auth" && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <LogIn className="h-4 w-4" /> Último login: {selected.last_sign_in_at
                          ? format(new Date(selected.last_sign_in_at), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "nunca"}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2 pt-2">
                    <h3 className="text-xs uppercase text-muted-foreground font-medium">Papéis</h3>
                    <div className="flex gap-2 flex-wrap">
                      {selected.roles.includes("admin") ? (
                        <Badge variant="default" className="gap-1 px-3 py-1.5">
                          <ShieldCheck className="h-3 w-3" /> Admin (permanente)
                        </Badge>
                      ) : (
                        <Button size="sm" disabled={selected.source !== "auth"}
                          variant="default"
                          onClick={() => toggleRole(selected, "admin")}>
                          <UserPlus className="h-3 w-3 mr-1" />Tornar admin
                        </Button>
                      )}
                      {!selected.roles.includes("admin") && (
                        <Button size="sm" disabled={selected.source !== "auth"}
                          variant={selected.roles.includes("editor") ? "outline" : "secondary"}
                          onClick={() => toggleRole(selected, "editor")}>
                          {selected.roles.includes("editor") ? "Remover editor" : "Tornar editor"}
                        </Button>
                      )}
                      {selected.roles.includes("admin") && currentAuthUser?.id === selected.user_id.replace(/^auth:/, "") && (
                        <Button size="sm" variant="outline" asChild>
                          <a href="/" target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-3 w-3 mr-1" />Ver loja como cliente
                          </a>
                        </Button>
                      )}
                    </div>
                    {selected.roles.includes("admin") && (
                      <p className="text-xs text-muted-foreground">O papel de admin é permanente e não pode ser removido. Use "Ver loja como cliente" para visualizar o site com a experiência de cliente sem perder seus privilégios.</p>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="auditoria" className="mt-4 space-y-4">
                  <ProfileNameAuditPanel userId={selected.user_id} />
                  <UserAuditPanel email={selected.email} statusBadge={statusBadge} />
                </TabsContent>
              </Tabs>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* ============ Dialog: Novo usuário ============ */}
      <CreateUserDialog open={createOpen} onClose={() => setCreateOpen(false)}
        onCreated={() => { setCreateOpen(false); qc.invalidateQueries({ queryKey: ["users-pag"] }); }} />
    </div>
  );
};

// ============== Auditoria por usuário (com filtros + CSV) ==============
const UserAuditPanel = ({ email, statusBadge }: { email: string | null; statusBadge: (s: string) => JSX.Element }) => {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [status, setStatus] = useState("all");

  const q = useQuery({
    queryKey: ["user-audit", email, from, to, status],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("list_user_audit", {
        _email: email,
        _from: from ? new Date(from).toISOString() : null,
        _to: to ? new Date(to + "T23:59:59").toISOString() : null,
        _status: status,
        _limit: 500, _offset: 0,
      });
      if (error) throw error;
      return { rows: ((data as any)?.rows || []) as AuditRow[], total: Number((data as any)?.total || 0) };
    },
    enabled: !!email,
  });

  const exportCSV = () => {
    const list = q.data?.rows || [];
    if (!list.length) return toast.info("Nada para exportar.");
    const header = ["Data/hora", "Por", "Papel", "Status", "Mensagem"];
    const body = list.map((r) => [
      format(new Date(r.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR }),
      r.promoted_by_email || "",
      r.role,
      r.status,
      r.message || "",
    ]);
    downloadCSV(`auditoria-${(email || "user").replace(/[^a-z0-9]/gi, "_")}-${new Date().toISOString().slice(0,10)}.csv`, [header, ...body]);
  };

  if (!email) return <p className="text-sm text-muted-foreground">Usuário sem e-mail — sem histórico de auditoria.</p>;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <div>
          <Label className="text-xs">De</Label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Até</Label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Tipo</Label>
          <select value={status} onChange={(e) => setStatus(e.target.value)}
            className="border rounded-md bg-background px-2 py-2 text-sm w-full">
            <option value="all">Todos</option>
            <option value="success">Sucesso</option>
            <option value="error">Erro</option>
            <option value="requested">Solicitado</option>
            <option value="revoked">Revogado</option>
            <option value="rejected">Reprovado</option>
            <option value="noop">Já era admin</option>
          </select>
        </div>
        <div className="flex items-end">
          <Button size="sm" variant="outline" className="w-full" onClick={exportCSV} disabled={!q.data?.rows?.length}>
            <Download className="h-4 w-4 mr-2" /> CSV
          </Button>
        </div>
      </div>

      {q.isLoading ? <p className="text-sm text-muted-foreground">Carregando…</p>
      : !q.data?.rows?.length ? <p className="text-sm text-muted-foreground">Sem eventos com esses filtros.</p>
      : (
        <div className="border rounded-md max-h-[60vh] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground border-b bg-muted/30 sticky top-0">
              <tr>
                <th className="py-2 px-2">Data</th><th className="py-2 px-2">Papel</th>
                <th className="py-2 px-2">Status</th><th className="py-2 px-2">Por</th>
              </tr>
            </thead>
            <tbody>
              {q.data.rows.map((r) => (
                <tr key={r.id} className="border-b last:border-0 align-top">
                  <td className="py-2 px-2 text-xs text-muted-foreground whitespace-nowrap">
                    {format(new Date(r.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </td>
                  <td className="py-2 px-2"><Badge variant="secondary" className="text-xs">{r.role}</Badge></td>
                  <td className="py-2 px-2">{statusBadge(r.status)}</td>
                  <td className="py-2 px-2 text-xs text-muted-foreground break-all">
                    {r.promoted_by_email || "—"}
                    {r.message && <div className="italic">{r.message}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// ============== Histórico de mudanças de nome (admin) ==============
const ProfileNameAuditPanel = ({ userId }: { userId: string }) => {
  const authId = userId.replace(/^auth:/, "");
  const isAuth = userId.startsWith("auth:");
  const q = useQuery({
    queryKey: ["profile-name-audit", authId],
    enabled: isAuth,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("profile_change_audit")
        .select("id, field, old_value, new_value, changed_by_email, created_at")
        .eq("user_id", authId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data || []) as any[];
    },
  });
  if (!isAuth) return null;
  return (
    <div className="border rounded-md p-3 bg-muted/20">
      <div className="text-xs uppercase text-muted-foreground font-medium flex items-center gap-1 mb-2">
        <FileEdit className="h-3 w-3" /> Mudanças de nome
      </div>
      {q.isLoading ? <p className="text-xs text-muted-foreground">Carregando…</p>
        : !q.data?.length ? <p className="text-xs text-muted-foreground">Nenhuma alteração registrada.</p>
        : (
          <ul className="space-y-1 text-xs">
            {q.data.map((r: any) => (
              <li key={r.id} className="flex flex-wrap gap-2 items-baseline">
                <span className="text-muted-foreground whitespace-nowrap">
                  {format(new Date(r.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                </span>
                <span>“{r.old_value || "—"}” → <strong>“{r.new_value || "—"}”</strong></span>
                <span className="text-muted-foreground italic">por {r.changed_by_email || "?"}</span>
              </li>
            ))}
          </ul>
        )}
    </div>
  );
};


const CreateUserDialog = ({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) => {
  const [form, setForm] = useState({ email: "", full_name: "", whatsapp: "", password: "", roles: [] as string[], send_invite: false });
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!form.email) return toast.error("Informe o e-mail.");
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-create-user", { body: form });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(form.send_invite ? "Convite enviado." : "Usuário criado.");
      setForm({ email: "", full_name: "", whatsapp: "", password: "", roles: [], send_invite: false });
      onCreated();
    } catch (e: any) {
      toast.error(e.message || "Falha ao criar usuário");
    } finally {
      setLoading(false);
    }
  };

  const toggleRole = (r: string) => setForm((f) => ({ ...f, roles: f.roles.includes(r) ? f.roles.filter((x) => x !== r) : [...f.roles, r] }));

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo usuário</DialogTitle>
          <DialogDescription>Cria conta autenticada (com senha) ou envia convite por e-mail.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>E-mail *</Label>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Nome</Label>
              <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </div>
            <div>
              <Label>WhatsApp</Label>
              <Input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.send_invite}
              onChange={(e) => setForm({ ...form, send_invite: e.target.checked })} />
            Enviar convite por e-mail (sem senha imediata)
          </label>
          {!form.send_invite && (
            <div>
              <Label>Senha (mín. 8 caracteres)</Label>
              <Input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              <Button type="button" size="sm" variant="ghost" className="mt-1"
                onClick={() => setForm({ ...form, password: Math.random().toString(36).slice(2) + "Aa1!" })}>
                Gerar senha
              </Button>
            </div>
          )}
          <div>
            <Label>Papéis iniciais</Label>
            <div className="flex gap-2 mt-1">
              {["admin","editor"].map((r) => (
                <Button key={r} type="button" size="sm"
                  variant={form.roles.includes(r) ? "default" : "outline"}
                  onClick={() => toggleRole(r)}>{r}</Button>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={loading}>{loading ? "Criando…" : "Criar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AdminUsers;
