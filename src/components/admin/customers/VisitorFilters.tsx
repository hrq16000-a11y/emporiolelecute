// Filtros avançados para a aba de Visitantes — data, faixa horária, dispositivo.
// Estado controlado externamente (vive na URL) para persistir entre navegações.
import { useMemo } from "react";
import { Calendar as CalendarIcon, Smartphone, Monitor, Tablet, Bot, X, Globe } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

export type DatePreset = "all" | "today" | "yesterday" | "7d" | "30d" | "custom";
export type DeviceFilter = "all" | "mobile" | "desktop" | "tablet" | "bot";

export interface VisitorFilterState {
  datePreset: DatePreset;
  dateFrom: string | null; // ISO yyyy-mm-dd
  dateTo: string | null;
  hourFrom: number; // 0-23
  hourTo: number;   // 0-23
  device: DeviceFilter;
  os: string; // "all" | nome
  country: string; // "all" | nome
  region: string;  // "all" | nome (estado/região)
  city: string;    // "all" | nome
}

export const defaultFilters: VisitorFilterState = {
  datePreset: "all",
  dateFrom: null,
  dateTo: null,
  hourFrom: 0,
  hourTo: 23,
  device: "all",
  os: "all",
  country: "all",
  region: "all",
  city: "all",
};

interface Props {
  value: VisitorFilterState;
  onChange: (next: VisitorFilterState) => void;
  osOptions: string[];
  countryOptions?: string[];
  regionOptions?: string[];
  cityOptions?: string[];
}

const DEVICE_ICONS = {
  mobile: Smartphone,
  desktop: Monitor,
  tablet: Tablet,
  bot: Bot,
} as const;

export function VisitorFilters({ value, onChange, osOptions, countryOptions = [], regionOptions = [], cityOptions = [] }: Props) {
  const activeCount = useMemo(() => {
    let n = 0;
    if (value.datePreset !== "all") n++;
    if (value.device !== "all") n++;
    if (value.os !== "all") n++;
    if (value.country !== "all") n++;
    if (value.region !== "all") n++;
    if (value.city !== "all") n++;
    if (value.hourFrom !== 0 || value.hourTo !== 23) n++;
    return n;
  }, [value]);

  const dateLabel = useMemo(() => {
    switch (value.datePreset) {
      case "today": return "Hoje";
      case "yesterday": return "Ontem";
      case "7d": return "Últimos 7 dias";
      case "30d": return "Últimos 30 dias";
      case "custom":
        if (value.dateFrom && value.dateTo)
          return `${format(new Date(value.dateFrom), "dd/MM")} – ${format(new Date(value.dateTo), "dd/MM")}`;
        return "Personalizado";
      default: return "Qualquer data";
    }
  }, [value]);

  const reset = () => onChange(defaultFilters);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Data */}
      <Select value={value.datePreset} onValueChange={(v) => onChange({ ...value, datePreset: v as DatePreset })}>
        <SelectTrigger className="w-auto min-w-[160px] h-9">
          <CalendarIcon className="w-4 h-4 mr-1.5" />
          <SelectValue>{dateLabel}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Qualquer data</SelectItem>
          <SelectItem value="today">Hoje</SelectItem>
          <SelectItem value="yesterday">Ontem</SelectItem>
          <SelectItem value="7d">Últimos 7 dias</SelectItem>
          <SelectItem value="30d">Últimos 30 dias</SelectItem>
          <SelectItem value="custom">Personalizado…</SelectItem>
        </SelectContent>
      </Select>

      {value.datePreset === "custom" && (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-9">
              {value.dateFrom && value.dateTo
                ? `${format(new Date(value.dateFrom), "dd/MM/yy", { locale: ptBR })} → ${format(new Date(value.dateTo), "dd/MM/yy", { locale: ptBR })}`
                : "Selecionar intervalo"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 z-50" align="start">
            <Calendar
              mode="range"
              selected={{
                from: value.dateFrom ? new Date(value.dateFrom) : undefined,
                to: value.dateTo ? new Date(value.dateTo) : undefined,
              }}
              onSelect={(range) =>
                onChange({
                  ...value,
                  dateFrom: range?.from ? format(range.from, "yyyy-MM-dd") : null,
                  dateTo: range?.to ? format(range.to, "yyyy-MM-dd") : null,
                })
              }
              className={cn("p-3 pointer-events-auto")}
              locale={ptBR}
            />
          </PopoverContent>
        </Popover>
      )}

      {/* Faixa horária */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-9">
            ⏰ {String(value.hourFrom).padStart(2, "0")}h – {String(value.hourTo).padStart(2, "0")}h
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 z-50 space-y-3" align="start">
          <div className="text-xs font-medium text-muted-foreground">Faixa de horário do dia</div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] text-muted-foreground">De</label>
              <Select value={String(value.hourFrom)} onValueChange={(v) => onChange({ ...value, hourFrom: Number(v) })}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-64">
                  {Array.from({ length: 24 }, (_, i) => (
                    <SelectItem key={i} value={String(i)}>{String(i).padStart(2, "0")}:00</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground">Até</label>
              <Select value={String(value.hourTo)} onValueChange={(v) => onChange({ ...value, hourTo: Number(v) })}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-64">
                  {Array.from({ length: 24 }, (_, i) => (
                    <SelectItem key={i} value={String(i)}>{String(i).padStart(2, "0")}:59</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Dispositivo */}
      <Select value={value.device} onValueChange={(v) => onChange({ ...value, device: v as DeviceFilter })}>
        <SelectTrigger className="w-auto min-w-[130px] h-9">
          <SelectValue placeholder="Dispositivo" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos dispositivos</SelectItem>
          <SelectItem value="mobile">📱 Mobile</SelectItem>
          <SelectItem value="desktop">🖥️ Desktop</SelectItem>
          <SelectItem value="tablet">Tablet</SelectItem>
          <SelectItem value="bot">🤖 Bot</SelectItem>
        </SelectContent>
      </Select>

      {/* OS */}
      {osOptions.length > 0 && (
        <Select value={value.os} onValueChange={(v) => onChange({ ...value, os: v })}>
          <SelectTrigger className="w-auto min-w-[130px] h-9">
            <SelectValue placeholder="Sistema" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos sistemas</SelectItem>
            {osOptions.map((os) => (
              <SelectItem key={os} value={os}>{os}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* País */}
      {countryOptions.length > 0 && (
        <Select value={value.country} onValueChange={(v) => onChange({ ...value, country: v })}>
          <SelectTrigger className="w-auto min-w-[130px] h-9">
            <Globe className="w-4 h-4 mr-1.5" />
            <SelectValue placeholder="País" />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            <SelectItem value="all">Todos países</SelectItem>
            {countryOptions.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Estado/Região */}
      {regionOptions.length > 0 && (
        <Select value={value.region} onValueChange={(v) => onChange({ ...value, region: v })}>
          <SelectTrigger className="w-auto min-w-[130px] h-9">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            <SelectItem value="all">Todos estados</SelectItem>
            {regionOptions.map((r) => (
              <SelectItem key={r} value={r}>{r}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Cidade */}
      {cityOptions.length > 0 && (
        <Select value={value.city} onValueChange={(v) => onChange({ ...value, city: v })}>
          <SelectTrigger className="w-auto min-w-[140px] h-9">
            <SelectValue placeholder="Cidade" />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            <SelectItem value="all">Todas cidades</SelectItem>
            {cityOptions.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {activeCount > 0 && (
        <Button variant="ghost" size="sm" onClick={reset} className="h-9 text-muted-foreground">
          <X className="w-3.5 h-3.5 mr-1" />
          Limpar
          <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">{activeCount}</Badge>
        </Button>
      )}
    </div>
  );
}

// ====== Aplicação dos filtros ======
export function applyVisitorFilters<T extends {
  last_seen_at: string;
  device_type: string | null;
  os_name: string | null;
  ip_country?: string | null;
  ip_region?: string | null;
  ip_city?: string | null;
}>(rows: T[], f: VisitorFilterState): T[] {
  const now = new Date();
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

  return rows.filter((r) => {
    const d = new Date(r.last_seen_at);
    if (from && d < from) return false;
    if (to && d > to) return false;
    if (f.hourFrom !== 0 || f.hourTo !== 23) {
      const h = d.getHours();
      if (h < f.hourFrom || h > f.hourTo) return false;
    }
    if (f.device !== "all" && r.device_type !== f.device) return false;
    if (f.os !== "all" && r.os_name !== f.os) return false;
    return true;
  });
}
