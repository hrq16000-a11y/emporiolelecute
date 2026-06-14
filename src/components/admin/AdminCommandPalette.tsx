import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Compass,
  Package,
  Users,
  Boxes,
  Sparkles,
  Home,
  Eye,
  Loader2,
  ArrowRight,
  Receipt,
} from "lucide-react";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
} from "@/components/ui/command";
import { supabase } from "@/integrations/supabase/client";
import { useDebounce } from "@/hooks/useDebounce";
import { useKits } from "@/hooks/useKits";
import { useCollections } from "@/hooks/useCollections";
import { EXECUTIVE_NAV, type NavLeaf } from "@/lib/executiveNavigation";
import {
  HOME_SECTION_DESTINATIONS,
  buildSectionDestinationPath,
} from "@/lib/homeSectionsDestinations";

/**
 * Command Palette administrativa global (Fase 1).
 *
 * Totalmente aditiva e reversível: reutiliza a infraestrutura existente
 * (cmdk, EXECUTIVE_NAV, RPC `search_products`, hooks de kits/coleções e o
 * mapa de destinos de seções da Home). Não altera schema, rotas, providers,
 * permissões nem comportamento das páginas.
 *
 * Atalho global: Cmd/Ctrl + K (abre/fecha). Cmd/Ctrl + B permanece intacto.
 */

interface NavHit extends NavLeaf {
  group: string;
}

const normalize = (s: string) =>
  (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

// Fonte única de navegação — mesmo flatten usado no AdminSearchBar.
const FLAT_NAV: NavHit[] = EXECUTIVE_NAV.flatMap((g) =>
  g.items.map((leaf) => ({ ...leaf, group: g.label }))
);

interface ProductHit {
  id: string;
  slug: string;
  name: string;
  price: number;
  is_active: boolean;
}

interface OrderHit {
  id: string;
  order_code: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  status: string;
  total: number;
}

// Rótulos PT-BR alinhados ao AdminOrders (não altera a fonte de verdade lá).
const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: "Pendente",
  confirmed: "Confirmado",
  processing: "Em produção",
  shipped: "Enviado",
  delivered: "Entregue",
  cancelled: "Cancelado",
};

const orderStatusLabel = (status: string) =>
  ORDER_STATUS_LABELS[status] || status || "—";

const formatPrice = (value: number) =>
  `R$ ${Number(value || 0).toFixed(2).replace(".", ",")}`;

const AdminCommandPalette = () => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 300);
  const term = debouncedQuery.trim();
  const hasTerm = term.length >= 2;

  // Atalho global Cmd/Ctrl + K (não conflita com Cmd/Ctrl + B do sidebar).
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  // Limpa o termo ao fechar para um próximo uso sempre limpo.
  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const runAction = (path: string) => {
    setOpen(false);
    setQuery("");
    navigate(path);
  };

  // Navegação (client-side, em memória).
  const navResults = useMemo<NavHit[]>(() => {
    if (!hasTerm) return [];
    const t = normalize(term);
    return FLAT_NAV.map((hit) => {
      const hay = normalize(`${hit.label} ${hit.group} ${hit.path}`);
      const idx = hay.indexOf(t);
      if (idx === -1) return null;
      const labelMatch = normalize(hit.label).includes(t) ? 0 : 1;
      return { hit, score: labelMatch * 100 + idx };
    })
      .filter((x): x is { hit: NavHit; score: number } => x !== null)
      .sort((a, b) => a.score - b.score)
      .slice(0, 6)
      .map((x) => x.hit);
  }, [term, hasTerm]);

  // Produtos — busca server-side via RPC existente `search_products`.
  const { data: productResults = [], isFetching: productsLoading } = useQuery({
    queryKey: ["admin-cmdk-products", term],
    enabled: open && hasTerm,
    staleTime: 30_000,
    queryFn: async (): Promise<ProductHit[]> => {
      const { data, error } = await supabase.rpc("search_products" as never, {
        _q: term,
        _limit: 8,
      } as never);
      if (error) return [];
      const payload = (data ?? {}) as { ids?: string[] };
      const ids = Array.isArray(payload.ids) ? payload.ids.slice(0, 8) : [];
      if (ids.length === 0) return [];
      const { data: rows, error: e2 } = await supabase
        .from("products")
        .select("id, slug, name, price, is_active")
        .in("id", ids);
      if (e2 || !rows) return [];
      const order = new Map(ids.map((id, i) => [id, i]));
      return [...(rows as ProductHit[])].sort(
        (a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)
      );
    },
  });

  // Pedidos — busca leve server-side por código, nome, email e telefone.
  // Seleção mínima, limit fixo e ranking client-side por prioridade.
  const { data: orderResults = [], isFetching: ordersLoading } = useQuery({
    queryKey: ["admin-cmdk-orders", term],
    enabled: open && hasTerm,
    staleTime: 30_000,
    queryFn: async (): Promise<OrderHit[]> => {
      // Sanitiza para uso seguro dentro do filtro `.or()` do PostgREST.
      const safe = term.replace(/[,()%]/g, " ").trim();
      if (safe.length < 2) return [];
      const pattern = `%${safe}%`;
      const { data, error } = await supabase
        .from("orders")
        .select(
          "id, order_code, customer_name, customer_email, customer_phone, status, total"
        )
        .or(
          [
            `order_code.ilike.${pattern}`,
            `customer_name.ilike.${pattern}`,
            `customer_email.ilike.${pattern}`,
            `customer_phone.ilike.${pattern}`,
          ].join(",")
        )
        .limit(8);
      if (error || !data) return [];

      const t = normalize(safe);
      const rank = (o: OrderHit) => {
        const code = normalize(o.order_code);
        const name = normalize(o.customer_name);
        const email = normalize(o.customer_email);
        const phone = normalize(o.customer_phone || "");
        if (code === t) return 0; // código exato
        if (code.startsWith(t)) return 1; // código começa com
        if (name.startsWith(t)) return 2; // nome começa com
        if (email.includes(t)) return 3; // email
        if (phone.includes(t)) return 4; // telefone
        return 5; // demais ocorrências (ex.: nome no meio)
      };

      return [...(data as OrderHit[])]
        .sort((a, b) => rank(a) - rank(b))
        .slice(0, 8);
    },
  });


  // Kits / Coleções — hooks cacheados, filtragem leve por nome.
  const { data: kits = [] } = useKits({ onlyActive: false });
  const { data: collections = [] } = useCollections({ onlyActive: false });

  const kitResults = useMemo(() => {
    if (!hasTerm) return [];
    const t = normalize(term);
    return kits.filter((k) => normalize(k.name).includes(t)).slice(0, 6);
  }, [kits, term, hasTerm]);

  const collectionResults = useMemo(() => {
    if (!hasTerm) return [];
    const t = normalize(term);
    return collections.filter((c) => normalize(c.name).includes(t)).slice(0, 6);
  }, [collections, term, hasTerm]);

  // Seções da Home — apenas as que possuem destino navegável.
  const homeSectionResults = useMemo(() => {
    if (!hasTerm) return [];
    const t = normalize(term);
    return Object.entries(HOME_SECTION_DESTINATIONS)
      .filter(([, dest]) => dest.route)
      .filter(([component, dest]) =>
        normalize(`${dest.label} ${component}`).includes(t)
      )
      .map(([component, dest]) => ({
        component,
        label: dest.label,
        path: buildSectionDestinationPath(component),
      }))
      .filter((s): s is { component: string; label: string; path: string } => !!s.path)
      .slice(0, 6);
  }, [term, hasTerm]);

  return (
    <CommandDialog open={open} onOpenChange={setOpen} commandProps={{ shouldFilter: false }}>
      <CommandInput
        placeholder="Buscar páginas, produtos, clientes, kits, coleções..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        {hasTerm && (
          <CommandEmpty>
            {productsLoading ? (
              <span className="flex items-center justify-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Buscando...
              </span>
            ) : (
              `Nenhum resultado para "${term}".`
            )}
          </CommandEmpty>
        )}

        {!hasTerm && (
          <div className="px-4 py-6 text-center text-sm text-muted-foreground">
            Digite ao menos 2 caracteres para buscar.
          </div>
        )}

        {navResults.length > 0 && (
          <CommandGroup heading="Navegação">
            {navResults.map((hit) => (
              <CommandItem
                key={`nav-${hit.path}`}
                value={`nav-${hit.path}-${hit.label}`}
                onSelect={() => runAction(hit.path)}
              >
                <Compass className="mr-2 h-4 w-4 text-muted-foreground" />
                <span className="flex-1 truncate">{hit.label}</span>
                <CommandShortcut className="truncate">{hit.group}</CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {productResults.length > 0 && (
          <CommandGroup heading="Produtos">
            {productResults.map((p) => (
              <CommandItem
                key={`prod-${p.id}`}
                value={`prod-${p.id}-${p.name}`}
                onSelect={() => runAction(`/admin/produtos/${p.slug || p.id}`)}
              >
                <Package className="mr-2 h-4 w-4 text-muted-foreground" />
                <span className="flex-1 truncate">{p.name}</span>
                {!p.is_active && (
                  <span className="mr-2 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    inativo
                  </span>
                )}
                <CommandShortcut>{formatPrice(p.price)}</CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {hasTerm && (
          <CommandGroup heading="Clientes">
            <CommandItem
              value={`cliente-busca-${term}`}
              onSelect={() =>
                runAction(
                  `/admin/clientes?tab=customers&q=${encodeURIComponent(term)}`
                )
              }
            >
              <Users className="mr-2 h-4 w-4 text-muted-foreground" />
              <span className="flex-1 truncate">
                Buscar clientes por “{term}”
              </span>
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
            </CommandItem>
          </CommandGroup>
        )}

        {hasTerm && (
          <CommandGroup heading="Visitantes">
            <CommandItem
              value={`visitante-busca-${term}`}
              onSelect={() =>
                runAction(
                  `/admin/clientes?tab=visitors&q=${encodeURIComponent(term)}`
                )
              }
            >
              <Eye className="mr-2 h-4 w-4 text-muted-foreground" />
              <span className="flex-1 truncate">
                Buscar visitantes por “{term}”
              </span>
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
            </CommandItem>
          </CommandGroup>
        )}

        {kitResults.length > 0 && (
          <CommandGroup heading="Kits">
            {kitResults.map((k) => (
              <CommandItem
                key={`kit-${k.id}`}
                value={`kit-${k.id}-${k.name}`}
                onSelect={() => runAction(`/admin/kits/${k.id}`)}
              >
                <Boxes className="mr-2 h-4 w-4 text-muted-foreground" />
                <span className="flex-1 truncate">{k.name}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {collectionResults.length > 0 && (
          <CommandGroup heading="Coleções">
            {collectionResults.map((c) => (
              <CommandItem
                key={`col-${c.id}`}
                value={`col-${c.id}-${c.name}`}
                onSelect={() => runAction(`/admin/colecoes/${c.id}`)}
              >
                <Sparkles className="mr-2 h-4 w-4 text-muted-foreground" />
                <span className="flex-1 truncate">{c.name}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {homeSectionResults.length > 0 && (
          <CommandGroup heading="Seções da Home">
            {homeSectionResults.map((s) => (
              <CommandItem
                key={`home-${s.component}`}
                value={`home-${s.component}-${s.label}`}
                onSelect={() => runAction(s.path)}
              >
                <Home className="mr-2 h-4 w-4 text-muted-foreground" />
                <span className="flex-1 truncate">{s.label}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
};

export default AdminCommandPalette;
