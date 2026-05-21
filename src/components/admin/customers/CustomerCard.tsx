// Card responsivo para cliente — usado em viewports mobile.
import { Edit, Trash2, ShieldCheck, Mail, Phone, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface CustomerCardProps {
  customer: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    whatsapp: string | null;
    city: string | null;
    state: string | null;
    status: string;
    tags: string[] | null;
    total_orders: number;
    total_spent: number;
    visit_count: number;
  };
  onEdit: () => void;
  onDelete: () => void;
  onInvite?: () => void;
}

const formatCurrency = (v: number) => `R$ ${(v ?? 0).toFixed(2).replace(".", ",")}`;

export function CustomerCard({ customer: c, onEdit, onDelete, onInvite }: CustomerCardProps) {
  const location = [c.city, c.state].filter(Boolean).join(" / ");
  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="font-semibold truncate">{c.name}</div>
          <Badge variant={c.status === "active" ? "default" : "secondary"} className="text-[10px] mt-1">
            {c.status}
          </Badge>
        </div>
        <div className="flex gap-0.5 shrink-0">
          {c.email && onInvite && (
            <Button size="sm" variant="ghost" onClick={onInvite} className="h-8 w-8 p-0" title="Convidar como usuário">
              <ShieldCheck className="w-4 h-4" />
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={onEdit} className="h-8 w-8 p-0">
            <Edit className="w-4 h-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={onDelete} className="h-8 w-8 p-0">
            <Trash2 className="w-4 h-4 text-destructive" />
          </Button>
        </div>
      </div>

      <div className="space-y-1 text-xs">
        {c.whatsapp && (
          <div className="flex items-center gap-1.5"><Phone className="w-3 h-3 text-muted-foreground" />{c.whatsapp}</div>
        )}
        {c.email && (
          <div className="flex items-center gap-1.5 truncate"><Mail className="w-3 h-3 text-muted-foreground shrink-0" /><span className="truncate">{c.email}</span></div>
        )}
        {location && (
          <div className="flex items-center gap-1.5"><MapPin className="w-3 h-3 text-muted-foreground" />{location}</div>
        )}
      </div>

      {c.tags && c.tags.length > 0 && (
        <div className="flex gap-1 flex-wrap">
          {c.tags.map((t) => <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>)}
        </div>
      )}

      <div className="flex justify-between text-xs pt-2 border-t border-border">
        <span><strong>{c.total_orders}</strong> pedidos · {formatCurrency(c.total_spent)}</span>
        <span className="text-muted-foreground">{c.visit_count} visitas</span>
      </div>
    </div>
  );
}
