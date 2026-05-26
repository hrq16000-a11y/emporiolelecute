/**
 * Executive Navigation — pure structural definition.
 * Progressive disclosure, additive, read-only.
 * No runtime mutations. Reversible.
 */

export type NavGroupId =
  | "core"
  | "content"
  | "discovery"
  | "executive"
  | "intelligence"
  | "system"
  | "site"
  | "settings"
  | "seo-advanced"
  | "labs";

export interface NavLeaf {
  label: string;
  path: string;
  icon: string;
  weight?: number;
}

export interface NavGroup {
  id: NavGroupId;
  label: string;
  defaultOpen: boolean;
  collapsible: boolean;
  hiddenByDefault?: boolean;
  items: NavLeaf[];
}

export const EXECUTIVE_NAV: NavGroup[] = [
  {
    id: "core",
    label: "Core",
    defaultOpen: true,
    collapsible: false,
    items: [
      { label: "Dashboard", path: "/admin", icon: "LayoutDashboard" },
      { label: "Pedidos", path: "/admin/pedidos", icon: "ShoppingCart" },
      { label: "Clientes", path: "/admin/clientes", icon: "Users" },
      { label: "Banner LGPD", path: "/admin/lgpd/banner", icon: "Cookie" },
      { label: "Produtos", path: "/admin/produtos", icon: "Package" },
      { label: "Reviews", path: "/admin/reviews", icon: "Star" },
      { label: "Blog", path: "/admin/blog", icon: "BookOpen" },
    ],
  },
  {
    id: "content",
    label: "Content",
    defaultOpen: true,
    collapsible: true,
    items: [
      { label: "Content Health", path: "/admin/content-health", icon: "Activity" },
      { label: "Editorial", path: "/admin/editorial-execution", icon: "Sparkles" },
      { label: "Content Gaps", path: "/admin/content-gaps", icon: "Sparkles" },
      { label: "Image Health", path: "/admin/image-health", icon: "Image" },
      { label: "Blog Health", path: "/admin/blog/health", icon: "Activity" },
      { label: "Product Health", path: "/admin/produtos/health", icon: "ShieldCheck" },
    ],
  },
  {
    id: "discovery",
    label: "Discovery",
    defaultOpen: true,
    collapsible: true,
    items: [
      { label: "Discovery Engine", path: "/admin/discovery", icon: "Sparkles" },
      { label: "Opportunities", path: "/admin/opportunities", icon: "Sparkles" },
      { label: "Themes", path: "/admin/themes", icon: "Sparkles" },
      { label: "Combination Pages", path: "/admin/combination-pages", icon: "ArrowRightLeft" },
      { label: "Authority", path: "/admin/authority", icon: "TrendingUp" },
    ],
  },
  {
    id: "executive",
    label: "SEO Executive (avançado)",
    defaultOpen: false,
    collapsible: true,
    hiddenByDefault: true,
    items: [
      { label: "Executive Mode", path: "/admin/executive-mode", icon: "Crown" },
      { label: "Executive Home", path: "/admin/seo-executive-home", icon: "Crown" },
      { label: "SEO OS", path: "/admin/seo-os", icon: "Rocket" },
      { label: "War Room", path: "/admin/seo-war-room", icon: "Rocket" },
      { label: "Control Tower", path: "/admin/seo-control-tower", icon: "Rocket" },
      { label: "Execution Orchestrator", path: "/admin/seo-execution-orchestrator", icon: "Rocket" },
      { label: "Operational Reality", path: "/admin/seo-operational-reality", icon: "Activity" },
      { label: "Operational Consolidation", path: "/admin/seo-operational-consolidation", icon: "Search" },
    ],
  },
  {
    id: "intelligence",
    label: "Intelligence (avançado)",
    defaultOpen: false,
    collapsible: true,
    hiddenByDefault: true,
    items: [
      { label: "Knowledge Graph", path: "/admin/knowledge-graph", icon: "Network" },
      { label: "Unified Nexus", path: "/admin/seo-unified-nexus", icon: "Hexagon" },
      { label: "Strategic Nexus", path: "/admin/seo-nexus-convergence", icon: "Orbit" },
      { label: "Stability Fabric", path: "/admin/seo-stability-fabric", icon: "Layers3" },
      { label: "Integrity Grid", path: "/admin/seo-integrity-grid", icon: "ShieldAlert" },
      { label: "Coherence Matrix", path: "/admin/seo-coherence-matrix", icon: "Boxes" },
      { label: "Consciousness", path: "/admin/seo-consciousness", icon: "Rocket" },
      { label: "Governance Matrix", path: "/admin/seo-governance-matrix", icon: "ShieldCheck" },
    ],
  },
  {
    id: "system",
    label: "System (avançado)",
    defaultOpen: false,
    collapsible: true,
    hiddenByDefault: true,
    items: [
      { label: "Final Governance", path: "/admin/seo-final-governance", icon: "ShieldCheck" },
      { label: "System Audit", path: "/admin/seo-system-audit", icon: "Search" },
      { label: "Consolidation", path: "/admin/seo-consolidation", icon: "Boxes" },
      { label: "Kernel", path: "/admin/seo-kernel", icon: "Cpu" },
      { label: "Unified Intelligence", path: "/admin/seo-unified-intelligence", icon: "Orbit" },
      { label: "Operating Fabric", path: "/admin/seo-operating-fabric", icon: "Network" },
      { label: "Cognitive Orchestration", path: "/admin/seo-cognitive-orchestration", icon: "Brain" },
      { label: "Nervous System", path: "/admin/seo-nervous-system", icon: "Activity" },
    ],
  },
  {
    id: "site",
    label: "Site",
    defaultOpen: false,
    collapsible: true,
    items: [
      { label: "Hero Slides", path: "/admin/hero-slides", icon: "Image" },
      { label: "Depoimentos", path: "/admin/depoimentos", icon: "MessageSquare" },
      { label: "Seções da Home", path: "/admin/secoes-home", icon: "Layers3" },
      { label: "Seções da PDP", path: "/admin/pdp-sections", icon: "LayoutGrid" },
      { label: "Blocos Homepage", path: "/admin/blocos", icon: "Home" },
      { label: "Feed Instagram", path: "/admin/feed-instagram", icon: "Instagram" },
      { label: "Landings SEO", path: "/admin/landings", icon: "MapPin" },
      { label: "Páginas", path: "/admin/paginas", icon: "Home" },
      { label: "Menus", path: "/admin/menus", icon: "Menu" },
      { label: "FAQs", path: "/admin/faqs", icon: "HelpCircle" },
      { label: "Categorias", path: "/admin/categorias", icon: "Tags" },
      { label: "Ocasiões", path: "/admin/ocasioes", icon: "Calendar" },
      { label: "Tags", path: "/admin/tags", icon: "Tags" },
      { label: "Taxonomias", path: "/admin/taxonomias", icon: "Sparkles" },
      { label: "Cupons", path: "/admin/cupons", icon: "Tag" },
      { label: "Coleções", path: "/admin/colecoes", icon: "Boxes" },
      { label: "Kits editoriais", path: "/admin/kits", icon: "Package" },
    ],
  },
  {
    id: "settings",
    label: "Settings",
    defaultOpen: false,
    collapsible: true,
    items: [
      { label: "Redirects", path: "/admin/redirects", icon: "ArrowRightLeft" },
      { label: "Robots.txt", path: "/admin/robots", icon: "Bot" },
      { label: "Analytics & Ads", path: "/admin/tracking", icon: "BarChart3" },
      { label: "CTA & Conversão", path: "/admin/conversao", icon: "MessageSquare" },
      { label: "Gestão de Fretes", path: "/admin/fretes", icon: "Truck" },
      { label: "Busca · Cockpit", path: "/admin/busca", icon: "Search" },
      { label: "Configurações", path: "/admin/configuracoes", icon: "Settings" },
      { label: "Merchant Feed", path: "/admin/merchant-feed", icon: "Rss" },
      { label: "SEO & Sitemap", path: "/admin/seo", icon: "Search" },
      { label: "Sitemap → Google", path: "/admin/sitemap-status", icon: "Activity" },
      { label: "SEO Dashboard", path: "/admin/seo-dashboard", icon: "BarChart3" },
      { label: "Telemetria", path: "/admin/telemetria", icon: "Activity" },
      { label: "Cron", path: "/admin/cron", icon: "Clock" },
      { label: "Usuários", path: "/admin/usuarios", icon: "ShieldCheck" },
      { label: "Solicitações", path: "/admin/usuarios/solicitacoes", icon: "ShieldCheck" },
      { label: "Auditoria", path: "/admin/auditoria", icon: "BarChart3" },
      { label: "Backup & Migração", path: "/admin/backup", icon: "Boxes" },
    ],
  },
  {
    id: "seo-advanced",
    label: "SEO Avançado",
    defaultOpen: false,
    collapsible: true,
    hiddenByDefault: true,
    items: [
      { label: "SEO Command", path: "/admin/seo-command", icon: "BarChart3" },
      { label: "SEO Evolution", path: "/admin/seo-evolution", icon: "TrendingUp" },
      { label: "SEO Operations", path: "/admin/seo-operations", icon: "BarChart3" },
      { label: "Link Health", path: "/admin/link-health", icon: "Activity" },
      { label: "Cloudflare Worker", path: "/admin/cloudflare-worker", icon: "Bot" },
      { label: "SEO System Audit", path: "/admin/seo-system-audit", icon: "Search" },
      { label: "SEO Diagnóstico", path: "/admin/diagnostico", icon: "BarChart3" },
      { label: "SEO Consolidation", path: "/admin/seo-consolidation", icon: "Boxes" },
    ],
  },
  {
    id: "labs",
    label: "Labs (Experimental)",
    defaultOpen: false,
    collapsible: true,
    hiddenByDefault: true,
    items: [
      { label: "Meta Reasoning", path: "/admin/seo-meta-reasoning", icon: "Brain" },
      { label: "Strategic Reality", path: "/admin/seo-strategic-reality", icon: "Compass" },
      { label: "Strategic Continuum", path: "/admin/seo-strategic-continuum", icon: "Infinity" },
      { label: "Civilization", path: "/admin/seo-civilization", icon: "Landmark" },
      { label: "Singularity", path: "/admin/seo-singularity", icon: "Rocket" },
      { label: "Consciousness Fabric", path: "/admin/seo-consciousness-fabric", icon: "Eye" },
      { label: "Meta Governance", path: "/admin/seo-meta-governance", icon: "ShieldCheck" },
      { label: "Executive Grid", path: "/admin/seo-executive-grid", icon: "BrainCircuit" },
      { label: "Executive Core", path: "/admin/seo-executive-core", icon: "Crown" },
      { label: "Autonomy", path: "/admin/seo-autonomy", icon: "Rocket" },
      { label: "Simulation Lab", path: "/admin/seo-simulation-lab", icon: "Rocket" },
      { label: "Strategic Simulation", path: "/admin/seo-strategic-simulation", icon: "Rocket" },
    ],
  },
];

export function totalNavItems(groups: NavGroup[] = EXECUTIVE_NAV): number {
  return groups.reduce((s, g) => s + g.items.length, 0);
}

export function visibleNavItems(groups: NavGroup[] = EXECUTIVE_NAV): number {
  return groups
    .filter((g) => !g.hiddenByDefault)
    .reduce((s, g) => s + g.items.length, 0);
}

export function calculateMenuEntropyScore(groups: NavGroup[] = EXECUTIVE_NAV): number {
  const total = totalNavItems(groups);
  if (total === 0) return 0;
  const groupCount = groups.length;
  const avg = total / groupCount;
  const variance =
    groups.reduce((s, g) => s + Math.pow(g.items.length - avg, 2), 0) / groupCount;
  const sd = Math.sqrt(variance);
  return Math.min(100, Math.round((sd / Math.max(avg, 1)) * 100));
}

export function calculateNavigationCompressionScore(
  groups: NavGroup[] = EXECUTIVE_NAV,
): number {
  const total = totalNavItems(groups);
  const visible = visibleNavItems(groups);
  if (total === 0) return 100;
  return Math.round((visible / total) * 100);
}

export function detectNavigationSprawl(groups: NavGroup[] = EXECUTIVE_NAV): string[] {
  return groups.filter((g) => g.items.length > 12).map((g) => g.id);
}
