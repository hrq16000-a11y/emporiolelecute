import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Mail, Plus, X, Save, Loader2, Users } from "lucide-react";

interface AlertConfig {
  emails: string[];
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const MediaAlertEmailsCard = () => {
  const queryClient = useQueryClient();
  const [emails, setEmails] = useState<string[]>([]);
  const [draft, setDraft] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "media-alert-config"],
    queryFn: async (): Promise<AlertConfig> => {
      const { data, error } = await supabase
        .from("store_settings")
        .select("value")
        .eq("key", "media_alert_config")
        .maybeSingle();
      if (error) throw error;
      const value = (data?.value ?? {}) as Partial<AlertConfig>;
      return { emails: Array.isArray(value.emails) ? value.emails : [] };
    },
  });

  useEffect(() => {
    if (data) setEmails(data.emails);
  }, [data]);

  const save = useMutation({
    mutationFn: async (next: string[]) => {
      const { error } = await supabase
        .from("store_settings")
        .upsert({ key: "media_alert_config", value: { emails: next } }, { onConflict: "key" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "media-alert-config"] });
      toast.success("E-mails de alerta salvos.");
    },
    onError: () => toast.error("Falha ao salvar os e-mails de alerta."),
  });

  const addEmail = () => {
    const e = draft.trim().toLowerCase();
    if (!EMAIL_RE.test(e)) {
      toast.error("E-mail inválido.");
      return;
    }
    if (emails.includes(e)) {
      toast.info("E-mail já adicionado.");
      return;
    }
    setEmails((prev) => [...prev, e]);
    setDraft("");
  };

  const removeEmail = (e: string) => setEmails((prev) => prev.filter((x) => x !== e));

  const dirty = JSON.stringify(emails) !== JSON.stringify(data?.emails ?? []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Mail className="h-4 w-4 text-primary" />
          Destinatários dos alertas de imagem
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Configure quem recebe o alerta por e-mail quando a auditoria encontrar imagens ausentes.
          Se a lista ficar vazia, o alerta é enviado para todos os administradores.
        </p>

        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : (
          <>
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                type="email"
                inputMode="email"
                placeholder="email@exemplo.com"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addEmail();
                  }
                }}
              />
              <Button type="button" variant="outline" onClick={addEmail} className="shrink-0">
                <Plus className="h-4 w-4" /> Adicionar
              </Button>
            </div>

            {emails.length === 0 ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground rounded-lg border border-dashed p-3">
                <Users className="h-4 w-4" />
                Nenhum e-mail configurado — os alertas vão para todos os administradores.
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {emails.map((e) => (
                  <Badge key={e} variant="secondary" className="gap-1.5 pl-2.5 pr-1 py-1">
                    {e}
                    <button
                      type="button"
                      onClick={() => removeEmail(e)}
                      className="rounded-full hover:bg-muted-foreground/20 p-0.5"
                      aria-label={`Remover ${e}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}

            <div className="flex justify-end">
              <Button onClick={() => save.mutate(emails)} disabled={!dirty || save.isPending}>
                {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Salvar destinatários
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default MediaAlertEmailsCard;
