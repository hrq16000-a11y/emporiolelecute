// Helpers compartilhados de visitante (id local + promoção a lead).
import { supabase } from "@/integrations/supabase/client";

const STORAGE_KEY = "elc_visitor_id";

export function getVisitorId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(STORAGE_KEY);
}

// Marca o visitante atual como lead. Idempotente e silencioso em caso de erro.
export async function markLead(trigger: string): Promise<void> {
  const visitorId = getVisitorId();
  if (!visitorId) return;
  try {
    await (supabase as any).rpc("mark_visitor_as_lead", {
      _visitor_id: visitorId,
      _trigger: trigger,
    });
  } catch {
    // silencioso — não pode bloquear UX
  }
}
