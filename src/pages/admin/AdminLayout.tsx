import logoImg from "@/assets/logo.webp";
import { useEffect, useState } from 'react';
import { useNavigate, Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  LayoutDashboard, Package, Tags, Calendar, LogOut, Menu, X, Home, Sparkles,
  ShoppingCart, Users, Settings, Search, HelpCircle, Rss, Instagram, MapPin,
  Image, MessageSquare, Tag, ArrowRightLeft, BarChart3, ShieldCheck, Bot,
  Activity, Clock, Star, BookOpen, TrendingUp, Network, Rocket, BrainCircuit,
  Brain, Landmark, Cpu, Orbit, Eye, Compass, Crown, Infinity as InfinityIcon,
  Hexagon, Layers3, ShieldAlert, Boxes, ChevronDown, Cookie, Truck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { EXECUTIVE_NAV, type NavGroup, type NavLeaf } from '@/lib/executiveNavigation';
import { useAdminPageTracking } from '@/hooks/useAdminPageTracking';
import { trackAdminEvent } from '@/lib/adminUsage';
import AdminSearchBar from '@/components/admin/AdminSearchBar';
import DraftNavigationGuard from '@/components/admin/DraftNavigationGuard';

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard, Package, Tags, Calendar, Home, Sparkles, ShoppingCart, Users,
  Settings, Search, HelpCircle, Rss, Instagram, MapPin, Image, MessageSquare,
  Tag, ArrowRightLeft, BarChart3, ShieldCheck, Bot, Activity, Clock, Star,
  BookOpen, TrendingUp, Network, Rocket, BrainCircuit, Brain, Landmark, Cpu,
  Orbit, Eye, Compass, Crown, Infinity: InfinityIcon, Hexagon, Layers3,
  ShieldAlert, Boxes, Menu, Cookie,
};

function NavItem({ leaf, active, onClick }: { leaf: NavLeaf; active: boolean; onClick: () => void }) {
  const Icon = ICONS[leaf.icon] ?? Sparkles;
  return (
    <Link
      to={leaf.path}
      onClick={() => {
        trackAdminEvent('nav_click', leaf.label || leaf.path);
        onClick();
      }}
      className={cn(
        "flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors text-sm",
        active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      <Icon className="w-4 h-4 shrink-0" />
      <span className="truncate">{leaf.label}</span>
    </Link>
  );
}

function NavGroupSection({ group, pathname, onItemClick, forceOpen }: { group: NavGroup; pathname: string; onItemClick: () => void; forceOpen?: boolean }) {
  const containsActive = group.items.some((i) => pathname === i.path);
  const [open, setOpen] = useState<boolean>(group.defaultOpen || containsActive);

  useEffect(() => {
    if (forceOpen) setOpen(true);
  }, [forceOpen]);

  if (!group.collapsible) {
    return (
      <div className="space-y-0.5">
        <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/70">
          {group.label}
        </div>
        {group.items.map((leaf) => (
          <NavItem key={leaf.path} leaf={leaf} active={pathname === leaf.path} onClick={onItemClick} />
        ))}
      </div>
    );
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="w-full flex items-center justify-between px-3 py-1.5 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/70 hover:text-foreground transition-colors">
        <span className="flex items-center gap-1.5">
          {group.label}
          {group.hiddenByDefault && (
            <span className="text-[9px] normal-case font-normal text-muted-foreground/50">(advanced)</span>
          )}
        </span>
        <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", open && "rotate-180")} />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-0.5 mt-0.5">
        {group.items.map((leaf) => (
          <NavItem key={leaf.path} leaf={leaf} active={pathname === leaf.path} onClick={onItemClick} />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

const AdminLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAdmin, loading, signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [advanced, setAdvanced] = useState<boolean>(() => {
    try { return localStorage.getItem('admin_advanced_mode') === '1'; } catch { return false; }
  });
  // Preserve scroll position across the toggle so the operator does not lose context.
  const toggleAdvanced = () => {
    const el = document.getElementById('admin-nav-scroller');
    const prevTop = el?.scrollTop ?? 0;
    setAdvanced((v) => {
      const next = !v;
      try { localStorage.setItem('admin_advanced_mode', next ? '1' : '0'); } catch { /* noop */ }
      requestAnimationFrame(() => {
        const el2 = document.getElementById('admin-nav-scroller');
        if (el2) el2.scrollTop = prevTop;
      });
      return next;
    });
  };
  useAdminPageTracking();

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      navigate('/admin/login');
    }
  }, [user, isAdmin, loading, navigate]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/admin/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/10">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
            <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 text-primary" />
          </div>
          <p className="text-muted-foreground font-medium">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user || !isAdmin) return null;

  const closeMobile = () => setSidebarOpen(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-muted/30 via-background to-accent/5">
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-card/80 backdrop-blur-xl border-b border-border/50 z-50 flex items-center justify-between px-4 shadow-sm">
        <button onClick={() => setSidebarOpen(true)} className="p-2.5 hover:bg-primary/10 rounded-xl transition-colors">
          <Menu className="w-5 h-5 text-foreground" />
        </button>
        <Link to="/admin" className="flex items-center gap-2">
          <span className="w-10 h-10 rounded-full bg-white shadow ring-1 ring-primary/20 flex items-center justify-center overflow-hidden">
            <img src={logoImg} alt="LeleCute" className="w-full h-full object-contain p-0.5" />
          </span>
          <span className="font-display text-lg text-foreground">Admin</span>
        </Link>
        <div className="w-10" />
      </header>

      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 bg-foreground/40 backdrop-blur-sm z-50" onClick={closeMobile} />
      )}

      <aside className={cn(
        "fixed top-0 left-0 h-full w-64 bg-card/95 backdrop-blur-xl border-r border-border/50 z-50 transition-transform duration-300 shadow-xl lg:shadow-none flex flex-col",
        "lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex items-center justify-between p-4 border-b border-border/50 shrink-0">
          <Link to="/admin" className="flex items-center gap-2.5 group">
            <div className="w-11 h-11 rounded-full bg-white shadow ring-2 ring-primary/20 group-hover:ring-primary/40 transition-all flex items-center justify-center overflow-hidden shrink-0">
              <img src={logoImg} alt="LeleCute" className="w-full h-full object-contain p-1" />
            </div>
            <div>
              <span className="font-display text-base text-foreground block leading-tight">LeleCute</span>
              <span className="text-[10px] text-muted-foreground">Painel Admin</span>
            </div>
          </Link>
          <button onClick={closeMobile} className="lg:hidden p-2 hover:bg-muted rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="shrink-0 px-2.5 pt-2.5 pb-1">
          <AdminSearchBar onResultSelect={closeMobile} />
        </div>

        <div className="shrink-0 px-2.5 pt-2 pb-1">
          <button
            type="button"
            onClick={toggleAdvanced}
            className={cn(
              "w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors border",
              advanced
                ? "bg-primary/10 text-primary border-primary/30 hover:bg-primary/15"
                : "bg-muted/40 text-muted-foreground border-border/60 hover:bg-muted"
            )}
            aria-pressed={advanced}
            title="Expande todos os grupos e revela módulos avançados"
          >
            <span className="flex items-center gap-2">
              <Layers3 className="w-3.5 h-3.5" />
              Modo avançado
            </span>
            <span className={cn(
              "text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded",
              advanced ? "bg-primary text-primary-foreground" : "bg-muted-foreground/20 text-muted-foreground"
            )}>
              {advanced ? "on" : "off"}
            </span>
          </button>
        </div>

        <nav id="admin-nav-scroller" className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-2.5 space-y-2 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent [scrollbar-gutter:stable]">
          {EXECUTIVE_NAV
            .filter((g) => advanced || !g.hiddenByDefault)
            .map((group) => (
              <NavGroupSection
                key={group.id}
                group={group}
                pathname={location.pathname}
                onItemClick={closeMobile}
                forceOpen={advanced}
              />
            ))}
        </nav>

        <div className="shrink-0 p-3 border-t border-border/50 space-y-1.5 bg-card/80 backdrop-blur-sm">
          <div className="flex items-center gap-1.5">
            <Link to="/" className="flex-1 flex items-center gap-2.5 px-3 py-2 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-all text-sm">
              <Home className="w-4 h-4" />
              <span>Ver site</span>
            </Link>
            <Link
              to="/admin/fretes"
              title="Gestão de Fretes"
              aria-label="Ir para Gestão de Fretes"
              onClick={() => trackAdminEvent('nav_click', 'shortcut_shipping')}
              className="p-2 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-all"
            >
              <Truck className="w-4 h-4" />
            </Link>
          </div>
          <Button
            variant="ghost"
            className="w-full justify-start gap-2.5 text-destructive hover:text-destructive hover:bg-destructive/10 rounded-lg py-2 h-auto text-sm"
            onClick={handleSignOut}
          >
            <LogOut className="w-4 h-4" />
            <span>Sair</span>
          </Button>
        </div>
      </aside>

      <main className="lg:ml-64 pt-16 lg:pt-0 min-h-screen min-w-0 overflow-x-hidden">
        <Outlet />
      </main>

      {/* Guarda global: avisa sobre rascunhos não salvos antes de sair */}
      <DraftNavigationGuard />
    </div>
  );
};

export default AdminLayout;
