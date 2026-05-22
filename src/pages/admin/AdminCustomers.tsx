import { useState, useEffect, useMemo } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Users, UserPlus, Search, Calendar, Edit, Trash2,
  Eye, Globe, Smartphone, Monitor, Tablet, Bot, ShieldCheck,
  ChevronLeft, ChevronRight, X, ArrowUpDown,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { VisitorFilters, applyVisitorFilters, defaultFilters, type VisitorFilterState, type DatePreset, type DeviceFilter } from "@/components/admin/customers/VisitorFilters";
import { VisitorCard } from "@/components/admin/customers/VisitorCard";
import { CustomerCard } from "@/components/admin/customers/CustomerCard";

// ============ Ordenação (Visitantes) ============
type VisitorSort = "last_seen" | "time" | "pageviews";
const SORT_COLUMN: Record<VisitorSort, string> = {
  last_seen: "last_seen_at",
  time: "total_time_seconds",
  pageviews: "total_pageviews",
};
const SORT_LABEL: Record<VisitorSort, string> = {
  last_seen: "Últimos vistos",
  time: "Maior tempo no site",
  pageviews: "Mais pageviews",
};


// ============ Types ============
interface CustomerRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  city: string | null;
  state: string | null;
  source: string | null;
  status: string;
  tags: string[] | null;
  notes: string | null;
  total_orders: number;
  total_spent: number;
  last_order_at: string | null;
  visit_count: number;
  last_seen_at: string | null;
  created_at: string;
}

interface VisitorRow {
  visitor_id: string;
  first_seen_at: string;
  last_seen_at: string;
  ip: string | null;
  ip_country: string | null;
  ip_city: string | null;
  ip_region: string | null;
  ip_isp: string | null;
  device_type: string | null;
  os_name: string | null;
  os_version: string | null;
  browser_name: string | null;
  device_brand: string | null;
  device_model: string | null;
  screen_w: number | null;
  screen_h: number | null;
  language: string | null;
  timezone: string | null;
  ip_timezone: string | null;
  first_referrer: string | null;
  utm_source: string | null;
  utm_campaign: string | null;
  total_pageviews: number;
  total_time_seconds: number;
  consent_status: string;
  customer_id: string | null;
  whatsapp_phone: string | null;
  gps_lat: number | null;
  gps_lon: number | null;
  ip_lat: number | null;
  ip_lon: number | null;
}

interface PageviewRow {
  id: string;
  path: string;
  title: string | null;
  product_id: string | null;
  time_on_page_seconds: number;
  scroll_depth_pct: number | null;
  viewed_at: string;
  referrer: string | null;
}

const emptyForm = {
  name: "", email: "", phone: "", whatsapp: "",
  city: "", state: "", source: "", status: "active",
  notes: "", tags: "",
};

const formatDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";
const formatDateTime = (d: string | null) =>
  d ? new Date(d).toLocaleString("pt-BR") : "—";
const formatCurrency = (v: number) => `R$ ${(v ?? 0).toFixed(2).replace(".", ",")}`;
const formatDuration = (sec: number) => {
  if (!sec) return "0s";
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ${sec % 60}s`;
  return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`;
};

const DeviceIcon = ({ t }: { t: string | null }) => {
  if (t === "mobile") return <Smartphone className="w-4 h-4" />;
  if (t === "tablet") return <Tablet className="w-4 h-4" />;
  if (t === "bot") return <Bot className="w-4 h-4" />;
  return <Monitor className="w-4 h-4" />;
};

// ============ URL state helpers ============
const PAGE_SIZES = [10, 25, 50] as const;
type PageSize = (typeof PAGE_SIZES)[number];

// ============ Component ============
const AdminCustomers = () => {
  const qc = useQueryClient();
  const isMobile = useIsMobile();
  const [searchParams, setSearchParams] = useSearchParams();

  // ============ Persistência URL ============
  const tab = (searchParams.get("tab") as "customers" | "visitors") || "customers";
  const search = searchParams.get("q") || "";
  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const perPage: PageSize = (PAGE_SIZES.includes(Number(searchParams.get("per")) as PageSize)
    ? (Number(searchParams.get("per")) as PageSize)
    : 25);

  const visitorFilters: VisitorFilterState = useMemo(() => ({
    datePreset: (searchParams.get("dp") as DatePreset) || defaultFilters.datePreset,
    dateFrom: searchParams.get("df"),
    dateTo: searchParams.get("dt"),
    hourFrom: Number(searchParams.get("hf") ?? defaultFilters.hourFrom),
    hourTo: Number(searchParams.get("ht") ?? defaultFilters.hourTo),
    device: (searchParams.get("dev") as DeviceFilter) || defaultFilters.device,
    os: searchParams.get("os") || defaultFilters.os,
  }), [searchParams]);

  const sort: VisitorSort = (["last_seen", "time", "pageviews"].includes(searchParams.get("sort") || "")
    ? (searchParams.get("sort") as VisitorSort)
    : "last_seen");

  const patchParams = (patch: Record<string, string | number | null>) => {
    const next = new URLSearchParams(searchParams);
    for (const [k, v] of Object.entries(patch)) {
      if (v == null || v === "") next.delete(k);
      else next.set(k, String(v));
    }
    setSearchParams(next, { replace: true });
  };

  const setTab = (v: "customers" | "visitors") => patchParams({ tab: v === "customers" ? null : v, page: null });
  const setSearch = (v: string) => patchParams({ q: v || null, page: null });
  const setPage = (n: number) => patchParams({ page: n <= 1 ? null : n });
  const setPerPage = (n: PageSize) => patchParams({ per: n === 25 ? null : n, page: null });
  const setSort = (s: VisitorSort) => patchParams({ sort: s === "last_seen" ? null : s, page: null });
  const setVisitorFilters = (f: VisitorFilterState) => patchParams({
    dp: f.datePreset === "all" ? null : f.datePreset,
    df: f.dateFrom,
    dt: f.dateTo,
    hf: f.hourFrom === 0 ? null : f.hourFrom,
    ht: f.hourTo === 23 ? null : f.hourTo,
    dev: f.device === "all" ? null : f.device,
    os: f.os === "all" ? null : f.os,
    page: null,
  });


  // ============ Estado UI (não persiste) ============
  const [editing, setEditing] = useState<CustomerRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<CustomerRow | null>(null);
  const [viewVisitor, setViewVisitor] = useState<VisitorRow | null>(null);
  const [form, setForm] = useState(emptyForm);

  // ====== Queries ======
  const customersQ = useQuery({
    queryKey: ["admin-customers-v2"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_overview")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as CustomerRow[];
    },
  });

  // Faixa horária é o único filtro que não dá pra empurrar pro PostgREST de forma simples;
  // quando estiver ativo, caímos no modo "janela + filtro local" pra manter consistência.
  const hourFilterActive = visitorFilters.hourFrom !== 0 || visitorFilters.hourTo !== 23;
  const sortColumn = SORT_COLUMN[sort];

  // Range de datas derivado do preset (server-side).
  const dateRange = useMemo(() => {
    const now = new Date();
    const f = visitorFilters;
    let from: Date | null = null;
    let to: Date | null = null;
    if (f.datePreset === "today") {
      from = new Date(now); from.setHours(0, 0, 0, 0);
      to = new Date(now); to.setHours(23, 59, 59, 999);
    } else if (f.datePreset === "yesterday") {
      from = new Date(now); from.setDate(from.getDate() - 1); from.setHours(0, 0, 0, 0);
      to = new Date(from); to.setHours(23, 59, 59, 999);
    } else if (f.datePreset === "7d") {
      from = new Date(now); from.setDate(from.getDate() - 7);
    } else if (f.datePreset === "30d") {
      from = new Date(now); from.setDate(from.getDate() - 30);
    } else if (f.datePreset === "custom" && f.dateFrom && f.dateTo) {
      from = new Date(f.dateFrom + "T00:00:00");
      to = new Date(f.dateTo + "T23:59:59");
    }
    return { from, to };
  }, [visitorFilters]);

  const visitorsQ = useQuery({
    queryKey: ["admin-visitors", { search, page, perPage, sort, hourFilterActive, visitorFilters }],
    queryFn: async () => {
      let q = supabase
        .from("visitors")
        .select("*", { count: "exact" })
        .order(sortColumn, { ascending: false, nullsFirst: false });

      if (dateRange.from) q = q.gte("last_seen_at", dateRange.from.toISOString());
      if (dateRange.to) q = q.lte("last_seen_at", dateRange.to.toISOString());
      if (visitorFilters.device !== "all") q = q.eq("device_type", visitorFilters.device);
      if (visitorFilters.os !== "all") q = q.eq("os_name", visitorFilters.os);
      if (search) {
        const term = `%${search}%`;
        q = q.or(
          `visitor_id.ilike.${term},ip_city.ilike.${term},ip_country.ilike.${term},device_model.ilike.${term},os_name.ilike.${term}`
        );
      }

      if (!hourFilterActive) {
        const from = (page - 1) * perPage;
        q = q.range(from, from + perPage - 1);
      } else {
        // janela maior pra filtrar localmente sem perder muitos registros
        q = q.limit(1000);
      }

      const { data, error, count } = await q;
      if (error) throw error;
      return { rows: (data || []) as VisitorRow[], totalCount: count ?? (data?.length || 0) };
    },
    enabled: tab === "visitors",
    placeholderData: (prev) => prev,
  });

  // Lista distinta de OS pra alimentar o filtro (sem depender da página atual).
  const osOptionsQ = useQuery({
    queryKey: ["admin-visitors-os-options"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("visitors")
        .select("os_name")
        .not("os_name", "is", null)
        .limit(1000);
      if (error) throw error;
      const set = new Set<string>();
      (data || []).forEach((v: { os_name: string | null }) => v.os_name && set.add(v.os_name));
      return Array.from(set).sort();
    },
    enabled: tab === "visitors",
    staleTime: 5 * 60 * 1000,
  });


  const pageviewsQ = useQuery({
    queryKey: ["visitor-pageviews", viewVisitor?.visitor_id],
    queryFn: async () => {
      if (!viewVisitor) return [];
      const { data, error } = await supabase
        .from("visitor_pageviews")
        .select("*")
        .eq("visitor_id", viewVisitor.visitor_id)
        .order("viewed_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data || []) as PageviewRow[];
    },
    enabled: !!viewVisitor,
  });

  // ====== Mutations ======
  const saveMut = useMutation({
    mutationFn: async (input: { id?: string }) => {
      const wa = form.whatsapp.trim();
      let name = form.name.trim();
      if (!name && !wa) throw new Error("Informe ao menos o WhatsApp ou o Nome do cliente");
      if (!name && wa) {
        const digits = wa.replace(/\D/g, "").slice(-4);
        name = digits ? `Contato ${digits}` : "Contato sem nome";
      }
      const payload = {
        name,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        whatsapp: wa || null,
        city: form.city.trim() || null,
        state: form.state.trim() || null,
        source: form.source.trim() || null,
        status: form.status,
        notes: form.notes.trim() || null,
        tags: form.tags ? form.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
      };
      if (input.id) {
        const { error } = await supabase.from("customers").update(payload).eq("id", input.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("customers").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: "Cliente salvo" });
      qc.invalidateQueries({ queryKey: ["admin-customers-v2"] });
      setEditing(null); setCreating(false); setForm(emptyForm);
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("customers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Cliente removido" });
      qc.invalidateQueries({ queryKey: ["admin-customers-v2"] });
      setConfirmDelete(null);
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  // ====== UI helpers ======
  const openCreate = () => { setForm(emptyForm); setCreating(true); };
  const openEdit = (c: CustomerRow) => {
    setForm({
      name: c.name || "", email: c.email || "", phone: c.phone || "",
      whatsapp: c.whatsapp || "", city: c.city || "", state: c.state || "",
      source: c.source || "", status: c.status || "active", notes: c.notes || "",
      tags: c.tags?.join(", ") || "",
    });
    setEditing(c);
  };

  // Deep-link: abre ficha quando vem /admin/clientes?customer=<id>
  useEffect(() => {
    const id = searchParams.get("customer");
    if (!id || !customersQ.data || editing) return;
    const c = customersQ.data.find((x) => x.id === id);
    if (c) {
      openEdit(c);
      const next = new URLSearchParams(searchParams);
      next.delete("customer");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, customersQ.data]); // eslint-disable-line react-hooks/exhaustive-deps

  // ====== Derived data ======
  const filteredCustomers = useMemo(() => {
    const s = search.toLowerCase();
    return (customersQ.data || []).filter((c) => !s ||
      c.name?.toLowerCase().includes(s) ||
      c.email?.toLowerCase().includes(s) ||
      c.phone?.includes(s) ||
      c.whatsapp?.includes(s) ||
      c.city?.toLowerCase().includes(s));
  }, [customersQ.data, search]);

  const osOptions = useMemo(() => {
    const set = new Set<string>();
    (visitorsQ.data || []).forEach((v) => v.os_name && set.add(v.os_name));
    return Array.from(set).sort();
  }, [visitorsQ.data]);

  const filteredVisitors = useMemo(() => {
    const s = search.toLowerCase();
    const base = (visitorsQ.data || []).filter((v) => !s ||
      v.visitor_id.toLowerCase().includes(s) ||
      v.ip?.toLowerCase().includes(s) ||
      v.ip_city?.toLowerCase().includes(s) ||
      v.ip_country?.toLowerCase().includes(s) ||
      v.device_model?.toLowerCase().includes(s) ||
      v.os_name?.toLowerCase().includes(s));
    return applyVisitorFilters(base, visitorFilters);
  }, [visitorsQ.data, search, visitorFilters]);

  // ====== Pagination ======
  const activeList = tab === "customers" ? filteredCustomers : filteredVisitors;
  const totalPages = Math.max(1, Math.ceil(activeList.length / perPage));
  const safePage = Math.min(page, totalPages);
  const startIdx = (safePage - 1) * perPage;
  const pagedCustomers = filteredCustomers.slice(startIdx, startIdx + perPage);
  const pagedVisitors = filteredVisitors.slice(startIdx, startIdx + perPage);

  const handleInvite = async (c: CustomerRow) => {
    if (!c.email) return;
    if (!confirm(`Enviar convite de login para ${c.email}?`)) return;
    try {
      const { data, error } = await supabase.functions.invoke("admin-create-user", {
        body: { email: c.email, full_name: c.name, whatsapp: c.whatsapp, send_invite: true },
      });
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      toast({ title: "Convite enviado", description: c.email });
    } catch (e) {
      toast({ title: "Erro", description: (e as Error).message, variant: "destructive" });
    }
  };

  // ============ Render ============
  return (
    <div className="p-4 lg:p-8 overflow-x-hidden">
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl lg:text-3xl font-display text-foreground flex items-center gap-3">
            <Users className="h-7 w-7 lg:h-8 lg:w-8 text-primary" />
            Clientes & Visitantes
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            <strong>Visitante</strong>: anônimo (IP/dispositivo). <strong>Cliente</strong>: criado no pedido de orçamento. <strong>Usuário</strong>: login interno.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" asChild size="sm">
            <Link to="/admin/usuarios">
              <ShieldCheck className="w-4 h-4 mr-2" /> Usuários
            </Link>
          </Button>
          {tab === "customers" && (
            <Button onClick={openCreate} size="sm">
              <UserPlus className="w-4 h-4 mr-2" /> Novo cliente
            </Button>
          )}
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as "customers" | "visitors")} className="mb-4">
        <TabsList>
          <TabsTrigger value="customers">
            Clientes ({customersQ.data?.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="visitors">
            Visitantes ({visitorsQ.data?.length ?? "—"})
          </TabsTrigger>
        </TabsList>

        <div className="relative my-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={tab === "customers" ? "Buscar nome, email, telefone, cidade…" : "Buscar IP, cidade, dispositivo…"}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 pr-10"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Limpar"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {tab === "visitors" && (
          <div className="mb-4 p-3 bg-muted/30 rounded-lg border border-border">
            <VisitorFilters value={visitorFilters} onChange={setVisitorFilters} osOptions={osOptions} />
          </div>
        )}

        {/* ============ CUSTOMERS ============ */}
        <TabsContent value="customers">
          {customersQ.isLoading ? (
            <div className="py-16 text-center text-muted-foreground">Carregando…</div>
          ) : filteredCustomers.length === 0 ? (
            <EmptyState icon={Users} text="Nenhum cliente cadastrado." />
          ) : isMobile ? (
            <div className="grid grid-cols-1 gap-3">
              {pagedCustomers.map((c) => (
                <CustomerCard
                  key={c.id} customer={c}
                  onEdit={() => openEdit(c)}
                  onDelete={() => setConfirmDelete(c)}
                  onInvite={c.email ? () => handleInvite(c) : undefined}
                />
              ))}
            </div>
          ) : (
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 border-b border-border">
                    <tr>
                      <th className="text-left p-3 font-medium">Cliente</th>
                      <th className="text-left p-3 font-medium">Contato</th>
                      <th className="text-left p-3 font-medium">Localização</th>
                      <th className="text-left p-3 font-medium">Pedidos</th>
                      <th className="text-left p-3 font-medium">Visitas</th>
                      <th className="text-left p-3 font-medium">Status</th>
                      <th className="text-right p-3 font-medium">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedCustomers.map((c) => (
                      <tr key={c.id} className="border-b border-border/50 hover:bg-muted/30">
                        <td className="p-3">
                          <p className="font-medium">{c.name}</p>
                          {c.tags && c.tags.length > 0 && (
                            <div className="flex gap-1 mt-1 flex-wrap">
                              {c.tags.map((t) => <Badge key={t} variant="outline" className="text-xs">{t}</Badge>)}
                            </div>
                          )}
                        </td>
                        <td className="p-3">
                          {c.email && <div className="text-xs">{c.email}</div>}
                          {c.phone && <div className="text-xs text-muted-foreground">{c.phone}</div>}
                        </td>
                        <td className="p-3 text-xs">
                          {[c.city, c.state].filter(Boolean).join(" / ") || "—"}
                        </td>
                        <td className="p-3">
                          <div>{c.total_orders}</div>
                          <div className="text-xs text-muted-foreground">{formatCurrency(c.total_spent)}</div>
                        </td>
                        <td className="p-3">
                          <div>{c.visit_count}</div>
                          {c.last_seen_at && <div className="text-xs text-muted-foreground">{formatDate(c.last_seen_at)}</div>}
                        </td>
                        <td className="p-3">
                          <Badge variant={c.status === "active" ? "default" : "secondary"}>{c.status}</Badge>
                        </td>
                        <td className="p-3 text-right whitespace-nowrap">
                          {c.email && (
                            <Button variant="ghost" size="sm" title="Migrar para usuário" onClick={() => handleInvite(c)}>
                              <ShieldCheck className="w-4 h-4" />
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" onClick={() => openEdit(c)}><Edit className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(c)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {filteredCustomers.length > 0 && (
            <Pagination
              page={safePage} totalPages={totalPages} perPage={perPage}
              total={filteredCustomers.length}
              onPage={setPage} onPerPage={setPerPage}
            />
          )}
        </TabsContent>

        {/* ============ VISITORS ============ */}
        <TabsContent value="visitors">
          {visitorsQ.isLoading ? (
            <div className="py-16 text-center text-muted-foreground">Carregando…</div>
          ) : filteredVisitors.length === 0 ? (
            <EmptyState icon={Globe} text="Nenhum visitante encontrado com os filtros atuais." />
          ) : isMobile ? (
            <div className="grid grid-cols-1 gap-3">
              {pagedVisitors.map((v) => (
                <VisitorCard key={v.visitor_id} visitor={v} onView={() => setViewVisitor(v)} />
              ))}
            </div>
          ) : (
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 border-b border-border">
                    <tr>
                      <th className="text-left p-3 font-medium">Visitante</th>
                      <th className="text-left p-3 font-medium">Localização (IP)</th>
                      <th className="text-left p-3 font-medium">Dispositivo</th>
                      <th className="text-left p-3 font-medium">Origem</th>
                      <th className="text-left p-3 font-medium">Engajamento</th>
                      <th className="text-left p-3 font-medium">Última visita</th>
                      <th className="text-right p-3 font-medium">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedVisitors.map((v) => (
                      <tr key={v.visitor_id} className="border-b border-border/50 hover:bg-muted/30">
                        <td className="p-3">
                          <div className="font-mono text-xs">{v.visitor_id.slice(0, 8)}…</div>
                          <div className="text-xs text-muted-foreground">{v.ip || "sem IP"}</div>
                          <Badge variant={v.consent_status === "accepted" ? "default" : "secondary"} className="text-[10px] mt-1">
                            {v.consent_status}
                          </Badge>
                        </td>
                        <td className="p-3 text-xs">
                          {v.ip_city && <div>{v.ip_city}, {v.ip_region}</div>}
                          <div className="text-muted-foreground">{v.ip_country || "—"}</div>
                          {v.ip_isp && <div className="text-muted-foreground text-[10px]">{v.ip_isp}</div>}
                        </td>
                        <td className="p-3 text-xs">
                          <div className="flex items-center gap-1">
                            <DeviceIcon t={v.device_type} />
                            <span>{v.device_brand || ""} {v.device_model || v.device_type || "—"}</span>
                          </div>
                          <div className="text-muted-foreground">
                            {v.os_name} {v.os_version} · {v.browser_name}
                          </div>
                        </td>
                        <td className="p-3 text-xs">
                          {v.utm_source && <Badge variant="outline" className="text-[10px]">{v.utm_source}</Badge>}
                          {v.first_referrer && (
                            <div className="text-muted-foreground truncate max-w-[140px]" title={v.first_referrer}>
                              {(() => { try { return new URL(v.first_referrer).hostname; } catch { return v.first_referrer; } })()}
                            </div>
                          )}
                        </td>
                        <td className="p-3 text-xs">
                          <div>{v.total_pageviews} páginas</div>
                          <div className="text-muted-foreground">{formatDuration(v.total_time_seconds)}</div>
                        </td>
                        <td className="p-3 text-xs">{formatDateTime(v.last_seen_at)}</td>
                        <td className="p-3 text-right">
                          <Button variant="ghost" size="sm" onClick={() => setViewVisitor(v)}>
                            <Eye className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {filteredVisitors.length > 0 && (
            <Pagination
              page={safePage} totalPages={totalPages} perPage={perPage}
              total={filteredVisitors.length}
              onPage={setPage} onPerPage={setPerPage}
            />
          )}
        </TabsContent>
      </Tabs>

      {/* ============ Create / Edit Dialog ============ */}
      <Dialog open={!!editing || creating} onOpenChange={(o) => { if (!o) { setEditing(null); setCreating(false); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar cliente" : "Novo cliente"}</DialogTitle>
            <DialogDescription>Cadastro manual — usado para clientes vindos por WhatsApp, indicação, etc.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-2">
            <div className="sm:col-span-2">
              <Label>WhatsApp <span className="text-primary">*</span></Label>
              <Input
                value={form.whatsapp}
                onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
                placeholder="(41) 99999-9999"
                autoFocus={!editing}
              />
              <p className="text-[11px] text-muted-foreground mt-1">Identificador principal do cliente.</p>
            </div>
            <div className="sm:col-span-2">
              <Label>Nome <span className="text-muted-foreground text-xs">(opcional)</span></Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div>
              <Label>Origem</Label>
              <Input value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} placeholder="Instagram, indicação…" />
            </div>
            <div>
              <Label>Cidade</Label>
              <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            </div>
            <div>
              <Label>Estado</Label>
              <Input maxLength={2} value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value.toUpperCase() })} />
            </div>
            <div>
              <Label>Status</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="active">Ativo</option>
                <option value="lead">Lead</option>
                <option value="inactive">Inativo</option>
                <option value="vip">VIP</option>
              </select>
            </div>
            <div>
              <Label>Tags (vírgula)</Label>
              <Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="aniversariante, atacado" />
            </div>
            <div className="sm:col-span-2">
              <Label>Notas</Label>
              <Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditing(null); setCreating(false); }}>Cancelar</Button>
            <Button onClick={() => saveMut.mutate({ id: editing?.id })} disabled={saveMut.isPending}>
              {saveMut.isPending ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============ Delete Confirm ============ */}
      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O cliente <strong>{confirmDelete?.name}</strong> será removido.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmDelete && deleteMut.mutate(confirmDelete.id)}>Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ============ Visitor Detail ============ */}
      <Dialog open={!!viewVisitor} onOpenChange={(o) => !o && setViewVisitor(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-primary" />
              Visitante {viewVisitor?.visitor_id.slice(0, 8)}…
            </DialogTitle>
          </DialogHeader>
          {viewVisitor && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Info label="IP" value={viewVisitor.ip} />
                <Info label="Consentimento" value={viewVisitor.consent_status} />
                <Info label="País" value={viewVisitor.ip_country} />
                <Info label="Cidade" value={[viewVisitor.ip_city, viewVisitor.ip_region].filter(Boolean).join(", ")} />
                <Info label="Provedor (ISP)" value={viewVisitor.ip_isp} />
                <Info label="Fuso horário" value={viewVisitor.timezone || viewVisitor.ip_timezone} />
                <Info label="Dispositivo" value={`${viewVisitor.device_brand || ""} ${viewVisitor.device_model || viewVisitor.device_type || ""}`.trim()} />
                <Info label="Sistema" value={`${viewVisitor.os_name || ""} ${viewVisitor.os_version || ""}`} />
                <Info label="Navegador" value={viewVisitor.browser_name} />
                <Info label="Tela" value={viewVisitor.screen_w ? `${viewVisitor.screen_w}×${viewVisitor.screen_h}` : null} />
                <Info label="Idioma" value={viewVisitor.language} />
                <Info label="WhatsApp" value={viewVisitor.whatsapp_phone} />
                <Info label="Origem (referrer)" value={viewVisitor.first_referrer} />
                <Info label="UTM" value={[viewVisitor.utm_source, viewVisitor.utm_campaign].filter(Boolean).join(" / ")} />
                <Info label="Total páginas" value={String(viewVisitor.total_pageviews)} />
                <Info label="Tempo total" value={formatDuration(viewVisitor.total_time_seconds)} />
                <Info label="GPS" value={viewVisitor.gps_lat ? `${viewVisitor.gps_lat}, ${viewVisitor.gps_lon}` : null} />
                <Info label="Geo (IP)" value={viewVisitor.ip_lat ? `${viewVisitor.ip_lat}, ${viewVisitor.ip_lon}` : null} />
              </div>

              <div>
                <h4 className="font-semibold mb-2 flex items-center gap-2"><Calendar className="w-4 h-4" /> Histórico de navegação ({pageviewsQ.data?.length ?? 0})</h4>
                <div className="border border-border rounded-lg max-h-72 overflow-y-auto">
                  {pageviewsQ.isLoading && <div className="p-3 text-muted-foreground">Carregando…</div>}
                  {pageviewsQ.data?.length === 0 && <div className="p-3 text-muted-foreground">Sem páginas registradas.</div>}
                  {pageviewsQ.data?.map((pv) => (
                    <div key={pv.id} className="p-2 border-b border-border/50 text-xs last:border-0">
                      <div className="flex justify-between gap-2">
                        <span className="font-mono truncate flex-1">{pv.path}</span>
                        <span className="text-muted-foreground shrink-0">{formatDateTime(pv.viewed_at)}</span>
                      </div>
                      <div className="text-muted-foreground">
                        {pv.title && <>{pv.title} · </>}
                        ⏱ {formatDuration(pv.time_on_page_seconds)}
                        {pv.scroll_depth_pct !== null && <> · scroll {pv.scroll_depth_pct}%</>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

const EmptyState = ({ icon: Icon, text }: { icon: typeof Users; text: string }) => (
  <div className="text-center py-16 bg-card rounded-xl border border-border">
    <Icon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
    <p className="text-muted-foreground">{text}</p>
  </div>
);

const Pagination = ({
  page, totalPages, perPage, total, onPage, onPerPage,
}: {
  page: number; totalPages: number; perPage: PageSize; total: number;
  onPage: (n: number) => void; onPerPage: (n: PageSize) => void;
}) => (
  <div className="flex flex-wrap items-center justify-between gap-3 mt-4 px-1">
    <div className="text-xs text-muted-foreground">
      {total === 0 ? "0 registros" : `${(page - 1) * perPage + 1}–${Math.min(page * perPage, total)} de ${total}`}
    </div>
    <div className="flex items-center gap-2">
      <Select value={String(perPage)} onValueChange={(v) => onPerPage(Number(v) as PageSize)}>
        <SelectTrigger className="w-auto h-8 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          {PAGE_SIZES.map((n) => <SelectItem key={n} value={String(n)}>{n} / pág</SelectItem>)}
        </SelectContent>
      </Select>
      <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => onPage(page - 1)} className="h-8">
        <ChevronLeft className="w-4 h-4" />
      </Button>
      <span className="text-xs tabular-nums">{page} / {totalPages}</span>
      <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => onPage(page + 1)} className="h-8">
        <ChevronRight className="w-4 h-4" />
      </Button>
    </div>
  </div>
);

const Info = ({ label, value }: { label: string; value: string | null | undefined }) => (
  <div className="p-2 bg-muted/40 rounded">
    <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
    <div className="text-sm break-words" title={value || ""}>{value || "—"}</div>
  </div>
);

export default AdminCustomers;
