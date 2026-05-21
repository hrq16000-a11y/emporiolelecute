// Card responsivo para visitante — usado em viewports mobile.
import { Eye, Smartphone, Monitor, Tablet, Bot, MapPin, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface VisitorCardProps {
  visitor: {
    visitor_id: string;
    ip: string | null;
    ip_city: string | null;
    ip_region: string | null;
    ip_country: string | null;
    device_type: string | null;
    device_brand: string | null;
    device_model: string | null;
    os_name: string | null;
    os_version: string | null;
    browser_name: string | null;
    consent_status: string;
    total_pageviews: number;
    total_time_seconds: number;
    last_seen_at: string;
    utm_source: string | null;
  };
  onView: () => void;
}

const formatDateTime = (d: string) => new Date(d).toLocaleString("pt-BR");
const formatDuration = (sec: number) => {
  if (!sec) return "0s";
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m`;
  return `${Math.floor(sec / 3600)}h${Math.floor((sec % 3600) / 60)}m`;
};

const DeviceIcon = ({ t }: { t: string | null }) => {
  const cls = "w-3.5 h-3.5";
  if (t === "mobile") return <Smartphone className={cls} />;
  if (t === "tablet") return <Tablet className={cls} />;
  if (t === "bot") return <Bot className={cls} />;
  return <Monitor className={cls} />;
};

export function VisitorCard({ visitor: v, onView }: VisitorCardProps) {
  const location = [v.ip_city, v.ip_region, v.ip_country].filter(Boolean).join(", ");
  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="font-mono text-xs text-muted-foreground truncate">
            {v.visitor_id.slice(0, 12)}…
          </div>
          <div className="flex items-center gap-1.5 mt-1 text-xs font-medium">
            <Clock className="w-3 h-3 text-muted-foreground shrink-0" />
            <span className="truncate">{formatDateTime(v.last_seen_at)}</span>
          </div>
        </div>
        <Button size="sm" variant="ghost" onClick={onView} className="shrink-0 h-8 w-8 p-0">
          <Eye className="w-4 h-4" />
        </Button>
      </div>

      {/* Badges */}
      <div className="flex flex-wrap gap-1.5">
        {v.ip && (
          <Badge variant="outline" className="text-[10px] font-mono">
            {v.ip}
          </Badge>
        )}
        <Badge variant={v.consent_status === "accepted" ? "default" : "secondary"} className="text-[10px]">
          {v.consent_status}
        </Badge>
        {v.utm_source && (
          <Badge variant="outline" className="text-[10px]">
            {v.utm_source}
          </Badge>
        )}
      </div>

      {/* Location */}
      {location && (
        <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span className="truncate">{location}</span>
        </div>
      )}

      {/* Device */}
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <DeviceIcon t={v.device_type} />
        <span className="truncate">
          {[v.device_brand, v.device_model || v.device_type, "·", v.os_name, v.os_version, "·", v.browser_name]
            .filter(Boolean).join(" ")}
        </span>
      </div>

      {/* Engagement */}
      <div className="flex justify-between text-xs pt-2 border-t border-border">
        <span><strong>{v.total_pageviews}</strong> páginas</span>
        <span className="text-muted-foreground">{formatDuration(v.total_time_seconds)} no site</span>
      </div>
    </div>
  );
}
