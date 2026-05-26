// Drawer unificado para Visitante / Cliente / Usuário.
// Usa as RPCs get_unified_profile + get_unified_timeline para herdar todo
// o histórico de telemetria do visitante mesmo quando o registro é aberto
// pela tela de Usuários (auth.users) ou Clientes (CRM).
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  MessageCircle, Mail, Phone, Globe, MapPin, Smartphone, Monitor,
  Tablet, Bot, Clock, Activity, Tag, Eye,
} from "lucide-react";

export type ProfileKind = "visitor" | "customer" | "user";

interface Props {
  kind: ProfileKind | null;
  id: string | null;
  open: boolean;
  onClose: () => void;
}

// ============ Helpers ============
const FALLBACK = "Não detectado";
const fb = (v: unknown, alt: string = FALLBACK) =>
  v === null || v === undefined || v === "" ? alt : String(v);

const fmtDateTime = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleString("pt-BR") : FALLBACK;

const fmtDuration = (sec: number | null | undefined) => {
  const s = Number(sec || 0);
  if (!s) return "0s";
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
};

const digitsOnly = (s: string | null | undefined) =>
  (s || "").replace(/\D/g, "");

const DeviceIcon = ({ t }: { t: string | null | undefined }) => {
  const cls = "w-4 h-4";
  if (t === "mobile") return <Smartphone className={cls} />;
  if (t === "tablet") return <Tablet className={cls} />;
  if (t === "bot") return <Bot className={cls} />;
  return <Monitor className={cls} />;
};

// ============ Types (shape do RPC) ============
interface UnifiedProfile {
  kind: string;
  id: string;
  visitor_ids: string[];
  identity: {
    name: string | null;
    email: string | null;
    whatsapp: string | null;
    phone: string | null;
    customer_id: string | null;
    is_bot: boolean | null;
    bot_name: string | null;
    lead_status: string | null;
    lead_trigger: string | null;
    lead_promoted_at: string | null;
    tags: string[] | null;
    status: string | null;
  };
  infra: {
    ip: string | null; ip_country: string | null; ip_region: string | null;
    ip_city: string | null; ip_isp: string | null; ip_asn: string | null;
    timezone: string | null; device_type: string | null;
    device_brand: string | null; device_model: string | null;
    os_name: string | null; os_version: string | null;
    browser_name: string | null; browser_version: string | null;
    language: string | null; screen_w: number | null; screen_h: number | null;
    lat: number | null; lon: number | null; gps_accuracy: number | null;
  };
  commerce: {
    first_referrer: string | null; first_landing_path: string | null;
    utm_source: string | null; utm_medium: string | null;
    utm_campaign: string | null; utm_term: string | null; utm_content: string | null;
    source: string | null; notes: string | null;
  };
  aggregates: {
    total_pageviews: number; total_sessions: number;
    total_time_seconds: number;
    first_seen_at: string | null; last_seen_at: string | null;
  };
}

interface TimelineRow {
  id: string; visitor_id: string; session_id: string | null;
  path: string; title: string | null; referrer: string | null;
  step_index: number | null; from_path: string | null; cta_id: string | null;
  event_type: string | null; time_on_page_seconds: number;
  scroll_depth_pct: number | null; viewed_at: string;
}

// ============ UI atômicos ============
const Info = ({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) => (
  <div>
    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
    <div className={`text-sm ${mono ? "font-mono break-all" : ""}`}>{value ?? FALLBACK}</div>
  </div>
);

const SectionTitle = ({ icon: Icon, children }: { icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) => (
  <h4 className="font-semibold text-sm flex items-center gap-2 text-foreground mt-2 mb-3">
    <Icon className="w-4 h-4 text-primary" /> {children}
  </h4>
);

// ============ Componente principal ============
export function UnifiedProfileDrawer({ kind, id, open, onClose }: Props) {
  const enabled = !!(open && kind && id);

  const profileQ = useQuery({
    queryKey: ["unified-profile", kind, id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_unified_profile", {
        _kind: kind!, _id: id!,
      });
      if (error) throw error;
      return data as unknown as UnifiedProfile;
    },
    enabled,
  });

  const visitorIds = profileQ.data?.visitor_ids || [];

  const timelineQ = useQuery({
    queryKey: ["unified-timeline", visitorIds],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_unified_timeline", {
        _visitor_ids: visitorIds, _limit: 500,
      });
      if (error) throw error;
      return (data as unknown as TimelineRow[]) || [];
    },
    enabled: enabled && visitorIds.length > 0,
  });

  const p = profileQ.data;
  const wa = digitsOnly(p?.identity.whatsapp);
  const isBot = !!p?.identity.is_bot;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 flex-wrap">
            <Globe className="w-5 h-5 text-primary" />
            <span className="capitalize">{kind === "user" ? "Usuário" : kind === "customer" ? "Cliente" : "Visitante"}</span>
            <span className="text-muted-foreground text-sm font-normal">
              {p?.identity.name || (id ? id.slice(0, 12) + "…" : "")}
            </span>
            {isBot && <Badge variant="secondary" className="ml-1">BOT{p?.identity.bot_name ? ` · ${p.identity.bot_name}` : ""}</Badge>}
            {p?.identity.lead_status === "lead" && <Badge variant="default">LEAD</Badge>}
            {p?.identity.customer_id && <Badge variant="outline">CLIENTE</Badge>}
          </SheetTitle>
          <SheetDescription>
            Ficha unificada — herda telemetria de {visitorIds.length} visitor_id{visitorIds.length === 1 ? "" : "s"} vinculado{visitorIds.length === 1 ? "" : "s"}.
          </SheetDescription>
        </SheetHeader>

        {profileQ.isLoading && (
          <div className="space-y-3 mt-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        )}
        {profileQ.error && (
          <div className="mt-4 text-sm text-destructive">
            Erro ao carregar perfil: {(profileQ.error as Error).message}
          </div>
        )}

        {p && (
          <div className="space-y-5 mt-4 text-sm">
            {/* ============ Contato ============ */}
            <section className="rounded-lg border border-border p-3 bg-muted/30">
              <SectionTitle icon={MessageCircle}>Contato</SectionTitle>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Info label="Nome" value={fb(p.identity.name)} />
                <Info label="Status" value={fb(p.identity.status || p.identity.lead_status, "visitante")} />
                <Info label="WhatsApp" value={
                  wa ? (
                    <a href={`https://wa.me/${wa.startsWith("55") ? wa : `55${wa}`}`} target="_blank" rel="noreferrer"
                       className="text-primary hover:underline inline-flex items-center gap-1">
                      <MessageCircle className="w-3 h-3" /> {p.identity.whatsapp}
                    </a>
                  ) : FALLBACK
                } />
                <Info label="E-mail" value={
                  p.identity.email ? (
                    <a href={`mailto:${p.identity.email}`} className="text-primary hover:underline inline-flex items-center gap-1">
                      <Mail className="w-3 h-3" /> {p.identity.email}
                    </a>
                  ) : FALLBACK
                } />
                <Info label="Telefone" value={
                  p.identity.phone ? (
                    <a href={`tel:${digitsOnly(p.identity.phone)}`} className="text-primary hover:underline inline-flex items-center gap-1">
                      <Phone className="w-3 h-3" /> {p.identity.phone}
                    </a>
                  ) : FALLBACK
                } />
                <Info label="Gatilho de lead" value={fb(p.identity.lead_trigger)} />
              </div>
              {p.identity.tags && p.identity.tags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {p.identity.tags.map((t) => (
                    <Badge key={t} variant="secondary" className="text-[10px]"><Tag className="w-3 h-3 mr-1" />{t}</Badge>
                  ))}
                </div>
              )}
            </section>

            {/* ============ Infraestrutura ============ */}
            <section className="rounded-lg border border-border p-3">
              <SectionTitle icon={Monitor}>Infraestrutura</SectionTitle>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Info label="IP" value={fb(p.infra.ip)} mono />
                <Info label="ISP" value={fb(p.infra.ip_isp)} />
                <Info label="País" value={fb(p.infra.ip_country)} />
                <Info label="Estado/Região" value={fb(p.infra.ip_region)} />
                <Info label="Cidade" value={fb(p.infra.ip_city)} />
                <Info label="Fuso horário" value={fb(p.infra.timezone)} />
                <Info label="Dispositivo" value={
                  <span className="inline-flex items-center gap-1.5">
                    <DeviceIcon t={p.infra.device_type} />
                    {[p.infra.device_brand, p.infra.device_model || p.infra.device_type].filter(Boolean).join(" ") || FALLBACK}
                  </span>
                } />
                <Info label="Sistema" value={fb([p.infra.os_name, p.infra.os_version].filter(Boolean).join(" "))} />
                <Info label="Navegador" value={fb([p.infra.browser_name, p.infra.browser_version].filter(Boolean).join(" "))} />
                <Info label="Idioma" value={fb(p.infra.language)} />
                <Info label="Tela" value={p.infra.screen_w ? `${p.infra.screen_w}×${p.infra.screen_h}` : FALLBACK} />
                <Info label="Coordenadas (lat, lon)" value={
                  p.infra.lat != null && p.infra.lon != null
                    ? <span className="font-mono text-xs">{Number(p.infra.lat).toFixed(4)}, {Number(p.infra.lon).toFixed(4)}</span>
                    : FALLBACK
                } />
              </div>
              {p.infra.lat != null && p.infra.lon != null && (
                <Button asChild size="sm" variant="outline" className="mt-3">
                  <a href={`https://www.google.com/maps?q=${p.infra.lat},${p.infra.lon}`} target="_blank" rel="noreferrer">
                    <MapPin className="w-3 h-3 mr-1" /> Abrir no Maps
                  </a>
                </Button>
              )}
            </section>

            {/* ============ Origem comercial ============ */}
            <section className="rounded-lg border border-border p-3">
              <SectionTitle icon={Activity}>Origem comercial</SectionTitle>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Info label="Referrer" value={fb(p.commerce.first_referrer)} />
                <Info label="Landing inicial" value={fb(p.commerce.first_landing_path)} mono />
                <Info label="UTM source" value={fb(p.commerce.utm_source)} />
                <Info label="UTM medium" value={fb(p.commerce.utm_medium)} />
                <Info label="UTM campaign" value={fb(p.commerce.utm_campaign)} />
                <Info label="UTM term" value={fb(p.commerce.utm_term)} />
                <Info label="UTM content" value={fb(p.commerce.utm_content)} />
                <Info label="Fonte (CRM)" value={fb(p.commerce.source)} />
              </div>
              {p.commerce.notes && (
                <div className="mt-3 text-xs text-muted-foreground whitespace-pre-wrap border-l-2 border-primary/40 pl-3">
                  {p.commerce.notes}
                </div>
              )}
            </section>

            {/* ============ Agregados ============ */}
            <section className="rounded-lg border border-border p-3 bg-muted/30">
              <SectionTitle icon={Clock}>Engajamento acumulado</SectionTitle>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Info label="Pageviews" value={String(p.aggregates.total_pageviews)} />
                <Info label="Sessões" value={String(p.aggregates.total_sessions)} />
                <Info label="Tempo total" value={fmtDuration(p.aggregates.total_time_seconds)} />
                <Info label="Última visita" value={fmtDateTime(p.aggregates.last_seen_at)} />
              </div>
            </section>

            {/* ============ Timeline atômica ============ */}
            <section className="rounded-lg border border-border p-3">
              <SectionTitle icon={Eye}>
                Linha do tempo de navegação ({timelineQ.data?.length ?? 0})
              </SectionTitle>
              <div className="max-h-[480px] overflow-y-auto">
                {timelineQ.isLoading && <div className="text-muted-foreground text-sm">Carregando…</div>}
                {!timelineQ.isLoading && (timelineQ.data?.length ?? 0) === 0 && (
                  <div className="text-muted-foreground text-sm">Sem páginas registradas para os visitor_ids vinculados.</div>
                )}
                <ol className="relative border-l-2 border-primary/30 ml-2 space-y-4">
                  {(timelineQ.data || []).map((pv, idx) => (
                    <li key={pv.id} className="ml-4 relative">
                      <span className="absolute -left-[1.4rem] flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-[10px] font-bold ring-4 ring-background">
                        {pv.step_index ?? idx + 1}
                      </span>
                      <div className="text-xs">
                        <div className="font-mono break-all text-foreground">{pv.path}</div>
                        {pv.title && <div className="text-muted-foreground">{pv.title}</div>}
                        <div className="text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-1">
                          <span>⏱ {fmtDuration(pv.time_on_page_seconds)}</span>
                          {pv.scroll_depth_pct != null && <span>scroll {pv.scroll_depth_pct}%</span>}
                          {pv.cta_id && <Badge variant="outline" className="text-[10px]">CTA: {pv.cta_id}</Badge>}
                          {pv.event_type && pv.event_type !== "pageview" && (
                            <Badge variant="secondary" className="text-[10px]">{pv.event_type}</Badge>
                          )}
                          {visitorIds.length > 1 && (
                            <Badge variant="outline" className="text-[10px] font-mono">
                              vid:{pv.visitor_id.slice(0, 6)}
                            </Badge>
                          )}
                          <span className="ml-auto">{fmtDateTime(pv.viewed_at)}</span>
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            </section>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
