// /admin/usuarios — Gestão de Usuários e Permissões Internas
// Fase 3: removido suporte a "visitor" e "order" (essas origens vão para /admin/clientes).
// Restam apenas duas categorias: Administradores/Editores (auth) e Clientes Cadastrados (CRM).
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useContactInfo } from "@/hooks/useContactInfo";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  ShieldCheck, AlertCircle, CheckCircle2, Download, ShieldOff,
  Users, UserPlus, ExternalLink, RefreshCw, ArrowUpDown, ArrowUp, ArrowDown,
  Mail, Calendar, LogIn, User as UserIcon, Link2, Copy, MessageCircle,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAdminWorkspaceStore } from "@/stores/adminWorkspaceStore";

interface UserRow {
  source: "auth" | "customer";
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

const ROUTE_KEY = "/admin/usuarios";

const AdminUsers = () => {
  const qc = useQueryClient();
  const { user: currentAuthUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const ws = useAdminWorkspaceStore();
  const wsState = ws.getRoute(ROUTE_KEY);

  // Aba (staff = Administradores/Editores | customers = Clientes Cadastrados)
  const tab = (searchParams.get("tab") as "staff" | "customers") || (wsState.tab as any) || "staff";
  const setTab = (v: "staff" | "customers") => {
    const next = new URLSearchParams(searchParams);
    if (v === "staff") next.delete("tab"); else next.set("tab", v);
    setSearchParams(next, { replace: true });
    ws.patchRoute(ROUTE_KEY, { tab: v });
    setPage(1);
  };

  // ====== Filters / paging state ======
  const initialUrl = searchParams;
  const [search, setSearch] = useState(initialUrl.get("q") || wsState.search || "");
  const [roleFilter, setRoleFilter] = useState(initialUrl.get("role") || "all");
  const [whatsappFilter, setWhatsappFilter] = useState(initialUrl.get("wa") || "");
  const [sortKey, setSortKey] = useState<SortKey>((initialUrl.get("sk") as SortKey) || "created_at");
  const [sortDir, setSortDir] = useState<SortDir>((initialUrl.get("sd") as SortDir) || "desc");
  const [page, setPage] = useState(Number(initialUrl.get("pg")) || 1);
  const [pageSize, setPageSize] = useState(Number(initialUrl.get("ps")) || 25);

  const [selected, setSelected] = useState<UserRow | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState<"perfil" | "auditoria">("perfil");
  const { buildWhatsappUrl } = useContactInfo();

  const sourceFilter = tab === "staff" ? "auth" : "customer";

  // Sincroniza filtros com URL e store
  const syncRef = useRef(false);
  useEffect(() => {
    if (!syncRef.current) { syncRef.current = true; return; }
    const next = new URLSearchParams(searchParams);
    const setOrDel = (k: string, v: string, defVal?: string) => {
      if (!v || v === defVal) next.delete(k); else next.set(k, v);
    };
    setOrDel("q", search);
    setOrDel("role", roleFilter, "all");
    setOrDel("wa", whatsappFilter);
    setOrDel("sk", sortKey, "created_at");
    setOrDel("sd", sortDir, "desc");
    setOrDel("pg", page > 1 ? String(page) : "");
    setOrDel("ps", pageSize !== 25 ? String(pageSize) : "");
    setSearchParams(next, { replace: true });
    ws.patchRoute(ROUTE_KEY, { search });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, roleFilter, whatsappFilter, sortKey, sortDir, page, pageSize]);

  // Contadores apenas auth/customer/admin/editor
  const countsQ = useQuery({
    queryKey: ["users-source-counts"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("users_source_counts");
      if (error) throw error;
      return data as Record<string, number>;
    },
  });

  const usersQ = useQuery({
    queryKey: ["users-pag", search, roleFilter, sourceFilter, whatsappFilter, sortKey, sortDir, page, pageSize],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("list_all_users_paginated", {
        _search: search || null,
        _role: roleFilter,
        _source: sourceFilter,
        _whatsapp: whatsappFilter || null,
        _ip: null,
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

  // Deep link ?user=<id>
  useEffect(() => {
    const uid = searchParams.get("user");
    if (!uid) { if (selected) setSelected(null); return; }
    if (selected?.user_id === uid) return;
    const found = rows.find((r) => r.user_id === uid);
    if (found) { setSelected(found); return; }
  }, [searchParams, rows]); // eslint-disable-line react-hooks/exhaustive-deps

  const openUser = (u: UserRow) => {
    setSelected(u);
    setDrawerTab("perfil");
    const next = new URLSearchParams(searchParams);
    next.set("user", u.user_id);
    setSearchParams(next, { replace: true });
    ws.patchRoute(ROUTE_KEY, { drawer: { kind: "user", id: u.user_id } });
  };
  const closeUser = () => {
    setSelected(null);
    const next = new URLSearchParams(searchParams);
    next.delete("user");
    setSearchParams(next, { replace: true });
    ws.patchRoute(ROUTE_KEY, { drawer: null });
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

  // CSV
  const [exporting, setExporting] = useState(false);
  const exportAllCSV = async () => {
    if (!total) return toast.info("Nada para exportar.");
    setExporting(true);
    const all: UserRow[] = [];
    const batch = 1000;
    try {
      for (let off = 0; off < total; off += batch) {
        const { data, error } = await (supabase as any).rpc("list_all_users_paginated", {
          _search: search || null, _role: roleFilter, _source: sourceFilter,
          _whatsapp: whatsappFilter || null, _ip: null,
          _sort_key: sortKey, _sort_dir: sortDir, _limit: batch, _offset: off,
        });
        if (error) throw error;
        all.push(...(((data as any)?.rows || []) as UserRow[]));
      }
      const header = ["Origem","Nome","E-mail","WhatsApp","Papéis","Cadastro","Último login","E-mail confirmado","Cliente CRM"];
      const body = all.map((u) => [
        u.source, u.full_name || "", u.email || "", u.whatsapp || "",
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
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display text-foreground flex items-center gap-2">
            <ShieldCheck className="h-7 w-7" /> Gestão de Usuários e Permissões Internas
          </h1>
          <p className="text-muted-foreground">
            Administradores, editores e clientes cadastrados com acesso à loja.{" "}
            <Link to="/admin/clientes" className="underline">Ver visitantes e leads no CRM</Link>.
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setCreateOpen(true)}>
            <UserPlus className="h-4 w-4 mr-2" /> Novo usuário
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="staff">
            Administradores e Editores ({(countsQ.data?.auth ?? 0)})
          </TabsTrigger>
          <TabsTrigger value="customers">
            Clientes Cadastrados ({(countsQ.data?.customer ?? 0)})
          </TabsTrigger>
        </TabsList>

        <Card className="p-5 space-y-3 mt-4">
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

          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
            <Input placeholder="Buscar nome/e-mail…" value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="md:col-span-2" />
            <Input placeholder="WhatsApp/telefone" value={whatsappFilter}
              onChange={(e) => { setWhatsappFilter(e.target.value); setPage(1); }} />
            {tab === "staff" && (
              <select value={roleFilter}
                onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
                className="border rounded-md bg-background px-3 py-2 text-sm">
                <option value="all">Todos os papéis</option>
                <option value="admin">Admin</option>
                <option value="editor">Editor</option>
                <option value="none">Sem papel</option>
              </select>
            )}
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
                      {tab === "staff" && <th className="py-2 pr-3 cursor-pointer" onClick={() => handleSort("role")}>Papéis {sortIcon("role")}</th>}
                      <th className="py-2 pr-3 cursor-pointer" onClick={() => handleSort("created_at")}>Cadastro {sortIcon("created_at")}</th>
                      {tab === "staff" && <th className="py-2 pr-3 cursor-pointer" onClick={() => handleSort("last_sign_in_at")}>Último login {sortIcon("last_sign_in_at")}</th>}
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
                        {tab === "staff" && (
                          <td className="py-2 pr-3">
                            <div className="flex flex-wrap gap-1">
                              {u.roles.length === 0 ? <span className="text-xs text-muted-foreground">—</span>
                              : u.roles.map((r) => <Badge key={r} variant={r === "admin" ? "default" : "secondary"} className="text-xs">{r}</Badge>)}
                            </div>
                          </td>
                        )}
                        <td className="py-2 pr-3 text-xs text-muted-foreground whitespace-nowrap">
                          {u.created_at ? format(new Date(u.created_at), "dd/MM/yyyy", { locale: ptBR }) : "—"}
                        </td>
                        {tab === "staff" && (
                          <td className="py-2 pr-3 text-xs text-muted-foreground whitespace-nowrap">
                            {u.last_sign_in_at ? format(new Date(u.last_sign_in_at), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "nunca"}
                          </td>
                        )}
                        <td className="py-2 pr-3 text-right whitespace-nowrap">
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
      </Tabs>

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
                    <Badge variant="outline" className="text-[10px]">
                      {selected.source === "auth" ? "Administrador/Editor" : "Cliente cadastrado"}
                    </Badge>
                    {selected.whatsapp && (
                      <Button size="sm" variant="outline" asChild>
                        <a
                          href={buildWhatsappUrl(
                            `Olá ${selected.full_name?.split(" ")[0] || ""}! Aqui é do Empório Lele Cute.`
                          )}
                          target="_blank" rel="noopener noreferrer"
                        >
                          <MessageCircle className="h-3 w-3 mr-1" /> WhatsApp
                        </a>
                      </Button>
                    )}
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
                      Cliente cadastrado. Para editar dados completos, use o{" "}
                      <Link to={`/admin/clientes?drawer=customer&id=${selected.linked_customer_id || selected.user_id}`} className="text-primary underline">CRM</Link>.
                    </p>
                  )}

                  <div className="grid gap-2 text-sm pt-2">
                    {selected.email && <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" />{selected.email}</div>}
                    {selected.whatsapp && <div>WhatsApp: <strong>{selected.whatsapp}</strong></div>}
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

                  {selected.source === "auth" && (
                    <div className="space-y-2 pt-2">
                      <h3 className="text-xs uppercase text-muted-foreground font-medium">Papéis</h3>
                      <div className="flex gap-2 flex-wrap">
                        {selected.roles.includes("admin") ? (
                          <Badge variant="default" className="gap-1 px-3 py-1.5">
                            <ShieldCheck className="h-3 w-3" /> Admin (permanente)
                          </Badge>
                        ) : (
                          <Button size="sm" variant="default" onClick={() => toggleRole(selected, "admin")}>
                            <UserPlus className="h-3 w-3 mr-1" />Tornar admin
                          </Button>
                        )}
                        {!selected.roles.includes("admin") && (
                          <Button size="sm"
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
                        <p className="text-xs text-muted-foreground">O papel de admin é permanente e não pode ser removido.</p>
                      )}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="auditoria" className="mt-4 space-y-4">
                  <UserAuditPanel email={selected.email} statusBadge={statusBadge} />
                </TabsContent>
              </Tabs>
            </>
          )}
        </SheetContent>
      </Sheet>

      <CreateUserDialog open={createOpen} onClose={() => setCreateOpen(false)}
        onCreated={() => { setCreateOpen(false); qc.invalidateQueries({ queryKey: ["users-pag"] }); }} />
    </div>
  );
};

// ============== Auditoria por usuário ==============
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

  if (!email) return <p className="text-sm text-muted-foreground">Usuário sem e-mail — sem histórico de auditoria.</p>;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        <div><Label className="text-xs">De</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div><Label className="text-xs">Até</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
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
          </select>
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
                  <td className="py-2 px-2 text-xs">{r.role}</td>
                  <td className="py-2 px-2">{statusBadge(r.status)}</td>
                  <td className="py-2 px-2 text-xs break-all">{r.promoted_by_email || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// ============== Dialog: Criar usuário ==============
const CreateUserDialog = ({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) => {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [sendInvite, setSendInvite] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!email.trim()) return toast.error("Informe o e-mail.");
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-create-user", {
        body: { email: email.trim(), full_name: fullName.trim() || null, whatsapp: whatsapp.trim() || null, send_invite: sendInvite },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(sendInvite ? "Convite enviado." : "Usuário criado.");
      setEmail(""); setFullName(""); setWhatsapp("");
      onCreated();
    } catch (e: any) {
      toast.error(e.message || "Falha ao criar usuário.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo usuário</DialogTitle>
          <DialogDescription>Crie um usuário interno (admin/editor) e envie convite por e-mail.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div><Label>E-mail *</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div><Label>Nome</Label><Input value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
          <div><Label>WhatsApp</Label><Input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} /></div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={sendInvite} onChange={(e) => setSendInvite(e.target.checked)} />
            Enviar convite por e-mail
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={submitting}>{submitting ? "Criando…" : "Criar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AdminUsers;
