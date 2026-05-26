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
import { useAdminWorkspaceStore } from "@/stores/adminWorkspaceStore";
import { UnifiedProfileDrawer } from "@/components/admin/UnifiedProfileDrawer";

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
  is_bot?: boolean | null;
  bot_name?: string | null;
  lead_status?: string | null;
  lead_promoted_at?: string | null;
  lead_trigger?: string | null;
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
  step_index?: number | null;
  from_path?: string | null;
  cta_id?: string | null;
  event_type?: string | null;
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
const ROUTE_KEY = "/admin/clientes";
type TabKey = "customers" | "visitors" | "leads";

const AdminCustomers = () => {
  const qc = useQueryClient();
  const isMobile = useIsMobile();
  const [searchParams, setSearchParams] = useSearchParams();
  const ws = useAdminWorkspaceStore();

  // ============ Persistência URL + store ============
  const tabParam = searchParams.get("tab") as TabKey | null;
  const tab: TabKey = (tabParam === "visitors" || tabParam === "leads" || tabParam === "customers")
    ? tabParam : "customers";
  const showBots = searchParams.get("bots") === "1";
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
    country: searchParams.get("country") || defaultFilters.country,
    region: searchParams.get("region") || defaultFilters.region,
    city: searchParams.get("city") || defaultFilters.city,
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

  const setTab = (v: TabKey) => {
    // Não limpa filtros globais (data, dispositivo, localização) ao trocar de aba — Zustand + URL preservam.
    patchParams({ tab: v === "customers" ? null : v, page: null, bots: null });
    ws.patchRoute(ROUTE_KEY, { tab: v });
  };
  const setShowBots = (v: boolean) => patchParams({ bots: v ? "1" : null, page: null });
  const setSearch = (v: string) => { patchParams({ q: v || null, page: null }); ws.patchRoute(ROUTE_KEY, { search: v }); };
  const setPage = (n: number) => patchParams({ page: n <= 1 ? null : n });
  const setPerPage = (n: PageSize) => patchParams({ per: n === 25 ? null : n, page: null });
  const setSort = (s: VisitorSort) => patchParams({ sort: s === "last_seen" ? null : s, page: null });
  const setVisitorFilters = (f: VisitorFilterState) => {
    patchParams({
      dp: f.datePreset === "all" ? null : f.datePreset,
      df: f.dateFrom, dt: f.dateTo,
      hf: f.hourFrom === 0 ? null : f.hourFrom,
      ht: f.hourTo === 23 ? null : f.hourTo,
      dev: f.device === "all" ? null : f.device,
      os: f.os === "all" ? null : f.os,
      country: f.country === "all" ? null : f.country,
      region: f.region === "all" ? null : f.region,
      city: f.city === "all" ? null : f.city,
      page: null,
    });
    // Persiste snapshot dos filtros globais no workspace store para sobreviver troca de rotas.
    ws.patchRoute(ROUTE_KEY, { filters: f } as unknown as Record<string, unknown>);
  };


  // Drawer via URL (?drawer=visitor&id=UUID ou ?drawer=customer&id=UUID)
  const drawerKind = searchParams.get("drawer");
  const drawerId = searchParams.get("id");
  const openDrawer = (kind: "visitor" | "customer", id: string) => {
    patchParams({ drawer: kind, id });
    ws.patchRoute(ROUTE_KEY, { drawer: { kind, id } });
  };
  const closeDrawer = () => {
    patchParams({ drawer: null, id: null });
    ws.patchRoute(ROUTE_KEY, { drawer: null });
  };

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
    queryKey: ["admin-visitors", { tab, showBots, search, page, perPage, sort, hourFilterActive, visitorFilters }],
    queryFn: async () => {
      let q = supabase
        .from("visitors")
        .select("*", { count: "exact" })
        .order(sortColumn, { ascending: false, nullsFirst: false });

      // Segmentação por aba: visitors humanos / leads (humanos promovidos) / tráfego de bots
      if (tab === "leads") {
        q = q.eq("is_bot", false).eq("lead_status", "lead");
      } else if (tab === "visitors") {
        if (showBots) q = q.eq("is_bot", true);
        else q = q.eq("is_bot", false);
      }

      if (dateRange.from) q = q.gte("last_seen_at", dateRange.from.toISOString());
      if (dateRange.to) q = q.lte("last_seen_at", dateRange.to.toISOString());
      if (visitorFilters.device !== "all") q = q.eq("device_type", visitorFilters.device);
      if (visitorFilters.os !== "all") q = q.eq("os_name", visitorFilters.os);
      if (visitorFilters.country !== "all") q = q.eq("ip_country", visitorFilters.country);
      if (visitorFilters.region !== "all") q = q.eq("ip_region", visitorFilters.region);
      if (visitorFilters.city !== "all") q = q.eq("ip_city", visitorFilters.city);
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
        q = q.limit(1000);
      }

      const { data, error, count } = await q;
      if (error) throw error;
      return { rows: (data || []) as VisitorRow[], totalCount: count ?? (data?.length || 0) };
    },
    enabled: tab === "visitors" || tab === "leads",
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
    enabled: (tab === "visitors" || tab === "leads"),
    staleTime: 5 * 60 * 1000,
  });

  // Opções distintas de país / região / cidade — alimenta os filtros globais de localização.
  const locationOptionsQ = useQuery({
    queryKey: ["admin-visitors-location-options"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("visitors")
        .select("ip_country, ip_region, ip_city")
        .limit(2000);
      if (error) throw error;
      const countries = new Set<string>();
      const regions = new Set<string>();
      const cities = new Set<string>();
      (data || []).forEach((r: { ip_country: string | null; ip_region: string | null; ip_city: string | null }) => {
        if (r.ip_country) countries.add(r.ip_country);
        if (r.ip_region) regions.add(r.ip_region);
        if (r.ip_city) cities.add(r.ip_city);
      });
      return {
        countries: Array.from(countries).sort(),
        regions: Array.from(regions).sort(),
        cities: Array.from(cities).sort(),
      };
    },
    staleTime: 5 * 60 * 1000,
  });


  // Timeline foi movida para o UnifiedProfileDrawer (RPC get_unified_timeline).

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

  // Deep-link via ?drawer=customer&id=<id> ou legado ?customer=<id>
  useEffect(() => {
    const legacy = searchParams.get("customer");
    const wantsCustomer = drawerKind === "customer" ? drawerId : legacy;
    if (wantsCustomer && customersQ.data && !editing) {
      const c = customersQ.data.find((x) => x.id === wantsCustomer);
      if (c) openEdit(c);
      if (legacy) {
        const next = new URLSearchParams(searchParams);
        next.delete("customer");
        next.set("drawer", "customer");
        next.set("id", wantsCustomer);
        setSearchParams(next, { replace: true });
      }
    }
    // Deep-link visitante: reabre drawer automaticamente após navegação
    if (drawerKind === "visitor" && drawerId && !viewVisitor) {
      const v = (visitorsQ.data?.rows || []).find((x) => x.visitor_id === drawerId);
      if (v) setViewVisitor(v);
      else {
        // Busca pontual quando não está na página atual
        supabase.from("visitors").select("*").eq("visitor_id", drawerId).maybeSingle()
          .then(({ data }) => { if (data) setViewVisitor(data as VisitorRow); });
      }
    }
    if (!drawerKind && viewVisitor) setViewVisitor(null);
  }, [searchParams, customersQ.data, visitorsQ.data, drawerKind, drawerId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ====== Derived data ======
  const filteredCustomers = useMemo(() => {
    const s = search.toLowerCase();
    return (customersQ.data || []).filter((c) => {
      if (s && !(
        c.name?.toLowerCase().includes(s) ||
        c.email?.toLowerCase().includes(s) ||
        c.phone?.includes(s) ||
        c.whatsapp?.includes(s) ||
        c.city?.toLowerCase().includes(s)
      )) return false;
      // Filtros globais de localização — aplicados também ao CRM.
      if (visitorFilters.region !== "all" && c.state !== visitorFilters.region) return false;
      if (visitorFilters.city !== "all" && c.city !== visitorFilters.city) return false;
      return true;
    });
  }, [customersQ.data, search, visitorFilters.region, visitorFilters.city]);

  const osOptions = osOptionsQ.data || [];
  const locationOptions = locationOptionsQ.data || { countries: [], regions: [], cities: [] };


  // Filtragem local apenas para faixa horária (e re-aplicação completa fallback).
  const visitorRowsRaw = visitorsQ.data?.rows || [];
  const totalCountRaw = visitorsQ.data?.totalCount || 0;

  const filteredVisitors = useMemo(() => {
    if (!hourFilterActive) return visitorRowsRaw;
    return applyVisitorFilters(visitorRowsRaw, visitorFilters);
  }, [visitorRowsRaw, hourFilterActive, visitorFilters]);

  // ====== Pagination ======
  const totalCustomers = filteredCustomers.length;
  const totalVisitors = hourFilterActive ? filteredVisitors.length : totalCountRaw;
  const totalForActive = tab === "customers" ? totalCustomers : totalVisitors;
  const totalPages = Math.max(1, Math.ceil(totalForActive / perPage));
  const safePage = Math.min(page, totalPages);
  const startIdx = (safePage - 1) * perPage;
  const pagedCustomers = filteredCustomers.slice(startIdx, startIdx + perPage);
  // Quando paginação é server-side, rows já vêm paginadas; se hour filter, fatiamos local.
  const pagedVisitors = hourFilterActive
    ? filteredVisitors.slice(startIdx, startIdx + perPage)
    : filteredVisitors;


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
            Clientes, Visitantes e Leads
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            <strong>Cliente (CRM)</strong>: cadastro completo. <strong>Visitante Humano</strong>: anônimo navegando. <strong>Lead</strong>: visitante que demonstrou interesse (clicou em WhatsApp, carrinho ou enviou orçamento).
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

      {/* ============ Barra Global de Filtros (acima das abas) ============ */}
      {/* Filtros globais (data, horário, dispositivo, sistema, país/estado/cidade) — aplicam-se a todas as abas
          e persistem ao trocar entre Clientes / Visitantes / Leads via URL + Zustand workspace. */}
      <div className="mb-4 p-3 bg-muted/30 rounded-lg border border-border">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2 font-medium">
          Filtros globais
        </div>
        <VisitorFilters
          value={visitorFilters}
          onChange={setVisitorFilters}
          osOptions={osOptions}
          countryOptions={locationOptions.countries}
          regionOptions={locationOptions.regions}
          cityOptions={locationOptions.cities}
        />
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)} className="mb-4">
        <TabsList>
          <TabsTrigger value="customers">
            Clientes (CRM) ({customersQ.data?.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="visitors">
            Visitantes Humanos {tab === "visitors" ? `(${totalVisitors})` : ""}
          </TabsTrigger>
          <TabsTrigger value="leads">
            Leads / Potenciais Clientes {tab === "leads" ? `(${totalVisitors})` : ""}
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
          <div className="mb-3 flex items-center justify-between gap-2 px-1">
            <label className="inline-flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={showBots}
                onChange={(e) => setShowBots(e.target.checked)}
                className="h-3.5 w-3.5"
              />
              <Bot className="h-3.5 w-3.5" />
              Ver tráfego de bots {showBots && "(ativo)"}
            </label>
          </div>
        )}

        {(tab === "visitors" || tab === "leads") && (
          <div className="mb-4 p-3 bg-muted/30 rounded-lg border border-border">
            <div className="flex items-center gap-2">
              <ArrowUpDown className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Ordenar por:</span>
              <Select value={sort} onValueChange={(v) => setSort(v as VisitorSort)}>
                <SelectTrigger className="h-8 w-auto min-w-[180px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(SORT_LABEL) as VisitorSort[]).map((k) => (
                    <SelectItem key={k} value={k}>{SORT_LABEL[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {hourFilterActive && (
                <span className="text-[11px] text-muted-foreground ml-auto">
                  Filtro de hora ativo — janela de até 1.000 registros.
                </span>
              )}
            </div>
          </div>
        )}


        {/* ============ CUSTOMERS ============ */}
        <TabsContent value="customers">
          {customersQ.isLoading ? (
            isMobile ? <MobileCardsSkeleton /> : <div className="py-16 text-center text-muted-foreground">Carregando…</div>

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
          {!customersQ.isLoading && filteredCustomers.length > 0 && (
            <Pagination
              page={safePage} totalPages={totalPages} perPage={perPage}
              total={totalCustomers}

              onPage={setPage} onPerPage={setPerPage}
            />
          )}
        </TabsContent>

        {/* ============ VISITORS ============ */}
        {/* Conteúdo de visitantes E leads compartilha a mesma estrutura, diferindo apenas pela query (lead_status). */}
        {(["visitors", "leads"] as const).map((kind) => (
          <TabsContent key={kind} value={kind}>
            {visitorsQ.isLoading ? (
              isMobile ? <MobileCardsSkeleton /> : <div className="py-16 text-center text-muted-foreground">Carregando…</div>
            ) : filteredVisitors.length === 0 ? (
              <EmptyState icon={Globe} text={kind === "leads"
                ? "Nenhum lead identificado ainda. Leads aparecem quando um visitante clica em WhatsApp, carrinho ou envia orçamento."
                : (showBots ? "Nenhum bot detectado com esses filtros." : "Nenhum visitante humano com os filtros atuais.")} />
            ) : isMobile ? (
              <div className="grid grid-cols-1 gap-3">
                {pagedVisitors.map((v) => (
                  <VisitorCard key={v.visitor_id} visitor={v} onView={() => openDrawer("visitor", v.visitor_id)} />
                ))}
              </div>
            ) : (
              <div className="bg-card rounded-xl border border-border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 border-b border-border">
                      <tr>
                        <th className="text-left p-3 font-medium">{kind === "leads" ? "Lead" : (showBots ? "Bot" : "Visitante")}</th>
                        <th className="text-left p-3 font-medium">Localização (IP)</th>
                        <th className="text-left p-3 font-medium">Dispositivo</th>
                        <th className="text-left p-3 font-medium">Origem</th>
                        <th className="text-left p-3 font-medium">Engajamento</th>
                        {kind === "leads" && <th className="text-left p-3 font-medium">Gatilho</th>}
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
                            {v.is_bot && v.bot_name && (
                              <Badge variant="outline" className="text-[10px] mt-1">{v.bot_name}</Badge>
                            )}
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
                                {(() => { try { return new URL(v.first_referrer!).hostname; } catch { return v.first_referrer; } })()}
                              </div>
                            )}
                          </td>
                          <td className="p-3 text-xs">
                            <div>{v.total_pageviews} páginas</div>
                            <div className="text-muted-foreground">{formatDuration(v.total_time_seconds)}</div>
                          </td>
                          {kind === "leads" && (
                            <td className="p-3 text-xs">
                              {v.lead_trigger
                                ? <Badge variant="default" className="text-[10px]">{v.lead_trigger}</Badge>
                                : <span className="text-muted-foreground">—</span>}
                              {v.lead_promoted_at && (
                                <div className="text-muted-foreground text-[10px] mt-1">{formatDateTime(v.lead_promoted_at)}</div>
                              )}
                            </td>
                          )}
                          <td className="p-3 text-xs">{formatDateTime(v.last_seen_at)}</td>
                          <td className="p-3 text-right">
                            <Button variant="ghost" size="sm" onClick={() => openDrawer("visitor", v.visitor_id)}>
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
            {!visitorsQ.isLoading && filteredVisitors.length > 0 && (
              <Pagination
                page={safePage} totalPages={totalPages} perPage={perPage}
                total={totalVisitors}
                onPage={setPage} onPerPage={setPerPage}
              />
            )}
          </TabsContent>
        ))}
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
      <Dialog open={!!viewVisitor} onOpenChange={(o) => { if (!o) { setViewVisitor(null); closeDrawer(); } }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-primary" />
              {viewVisitor?.is_bot ? "Bot" : "Visitante"} {viewVisitor?.visitor_id.slice(0, 8)}…
              {viewVisitor?.lead_status === "lead" && (
                <Badge variant="default" className="ml-2 text-[10px]">LEAD</Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          {viewVisitor && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Info label="IP" value={viewVisitor.ip} />
                <Info label="Status" value={viewVisitor.lead_status || "visitor"} />
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
                <Info label="Gatilho de lead" value={viewVisitor.lead_trigger} />
                <Info label="Virou lead em" value={viewVisitor.lead_promoted_at ? formatDateTime(viewVisitor.lead_promoted_at) : null} />
              </div>

              {/* ============ Timeline (Stepper Vertical) ============ */}
              <div>
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <Calendar className="w-4 h-4" /> Linha do tempo de navegação ({pageviewsQ.data?.length ?? 0})
                </h4>
                <div className="border border-border rounded-lg max-h-[420px] overflow-y-auto p-4">
                  {pageviewsQ.isLoading && <div className="text-muted-foreground">Carregando…</div>}
                  {pageviewsQ.data?.length === 0 && <div className="text-muted-foreground">Sem páginas registradas.</div>}
                  <ol className="relative border-l-2 border-primary/30 ml-2 space-y-4">
                    {pageviewsQ.data?.map((pv, idx) => (
                      <li key={pv.id} className="ml-4 relative">
                        <span className="absolute -left-[1.4rem] flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-[10px] font-bold ring-4 ring-background">
                          {pv.step_index ?? idx + 1}
                        </span>
                        <div className="text-xs">
                          <div className="font-mono break-all text-foreground">{pv.path}</div>
                          {pv.title && <div className="text-muted-foreground">{pv.title}</div>}
                          <div className="text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-1">
                            <span>⏱ {formatDuration(pv.time_on_page_seconds)}</span>
                            {pv.scroll_depth_pct !== null && pv.scroll_depth_pct !== undefined && <span>scroll {pv.scroll_depth_pct}%</span>}
                            {pv.cta_id && <Badge variant="outline" className="text-[10px]">CTA: {pv.cta_id}</Badge>}
                            {pv.event_type && pv.event_type !== "pageview" && (
                              <Badge variant="secondary" className="text-[10px]">{pv.event_type}</Badge>
                            )}
                            <span className="ml-auto">{formatDateTime(pv.viewed_at)}</span>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            </div>
          )}

        </DialogContent>
      </Dialog>
    </div>
  );
};

const MobileCardsSkeleton = () => (
  <div className="grid grid-cols-1 gap-3" aria-busy="true" aria-label="Carregando">
    {Array.from({ length: 4 }).map((_, i) => (
      <div key={i} className="p-4 rounded-xl border border-border bg-card space-y-3">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-4/5" />
      </div>
    ))}
  </div>
);

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
