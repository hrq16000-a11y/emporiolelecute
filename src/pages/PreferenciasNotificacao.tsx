import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { useSearchParams } from "react-router-dom";
import { Bell, BellOff, Mail, Loader2, ShieldCheck } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  NotificationState,
  disablePush,
  enablePush,
  getPreferences,
  pushSupported,
  savePreferences,
} from "@/lib/webPush";

const ERROR_LABEL: Record<string, string> = {
  order_not_found: "Não encontramos um pedido com esse código e e-mail. Confira os dados.",
  invalid_email: "E-mail inválido.",
  invalid_order_code: "Código de pedido inválido.",
  permission_denied: "Você bloqueou as notificações no navegador. Libere nas configurações do site.",
  push_unsupported: "Seu navegador não suporta notificações push. Vamos usar e-mail.",
  vapid_missing: "Push indisponível no momento. Continuamos avisando por e-mail.",
};

const PreferenciasNotificacao = () => {
  const [params] = useSearchParams();
  const { toast } = useToast();

  const [email, setEmail] = useState("");
  const [orderCode, setOrderCode] = useState((params.get("code") || "").toUpperCase());
  const [state, setState] = useState<NotificationState | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  const describe = (error: unknown) => {
    const key = String((error as Error)?.message || error);
    return ERROR_LABEL[key] || "Não foi possível concluir agora. Tente novamente em instantes.";
  };

  const load = async () => {
    setLoading(true);
    try {
      const result = await getPreferences(email.trim(), orderCode.trim().toUpperCase());
      setState(result);
    } catch (error) {
      setState(null);
      toast({ title: "Não foi possível carregar", description: describe(error), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const update = async (values: { email_enabled: boolean; push_enabled: boolean }) => {
    setBusy(true);
    try {
      const result = await savePreferences(email.trim(), orderCode.trim().toUpperCase(), values);
      setState(result);
      toast({ title: "Preferências salvas" });
    } catch (error) {
      toast({ title: "Erro ao salvar", description: describe(error), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const togglePush = async (next: boolean) => {
    if (!state) return;
    setBusy(true);
    try {
      const result = next
        ? await enablePush(email.trim(), orderCode.trim().toUpperCase())
        : await disablePush(email.trim(), orderCode.trim().toUpperCase());
      setState(result);
      toast({
        title: next ? "Notificações push ativadas" : "Notificações push desativadas",
        description: next
          ? "Você receberá um aviso no aparelho a cada mudança de status."
          : "Continuamos avisando por e-mail, se estiver ativo.",
      });
    } catch (error) {
      // Fallback automático: garante e-mail ligado quando push falha.
      if (next) {
        await savePreferences(email.trim(), orderCode.trim().toUpperCase(), {
          email_enabled: true,
          push_enabled: false,
        })
          .then(setState)
          .catch(() => undefined);
      }
      toast({ title: "Push indisponível", description: describe(error), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const canSubmit = email.trim().length > 4 && orderCode.trim().length >= 4;

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Preferências de notificação | Empório LeleCute</title>
        <meta
          name="description"
          content="Escolha como quer ser avisado sobre o status do seu pedido: notificações push no celular, e-mail ou ambos. Altere ou cancele quando quiser."
        />
        <meta name="robots" content="noindex,follow" />
      </Helmet>

      <Header />

      <main className="container mx-auto px-4 py-10 md:py-16 max-w-2xl">
        <h1 className="font-display text-3xl md:text-4xl text-foreground mb-2">Preferências de notificação</h1>
        <p className="text-muted-foreground mb-8">
          Informe o e-mail e o código do pedido para escolher como receber os avisos de status.
        </p>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Identifique seu pedido</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="np-email">E-mail do pedido</Label>
                <Input
                  id="np-email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="voce@email.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="np-code">Código do pedido</Label>
                <Input
                  id="np-code"
                  placeholder="LC123456"
                  value={orderCode}
                  onChange={(event) => setOrderCode(event.target.value.toUpperCase())}
                />
              </div>
            </div>
            <Button onClick={load} disabled={!canSubmit || loading} className="w-full md:w-auto min-h-11">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              Carregar preferências
            </Button>
          </CardContent>
        </Card>

        {loading && (
          <Card>
            <CardContent className="p-6 space-y-4">
              <Skeleton className="h-6 w-1/3" />
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </CardContent>
          </Card>
        )}

        {!loading && state && (
          <Card className="animate-fade-in">
            <CardHeader>
              <CardTitle className="text-lg">Como quer ser avisado?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex gap-3">
                  <Mail className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium text-foreground">E-mail</p>
                    <p className="text-sm text-muted-foreground">
                      Aviso a cada mudança de status no e-mail do pedido.
                    </p>
                  </div>
                </div>
                <Switch
                  checked={state.email_enabled}
                  disabled={busy}
                  aria-label="Receber por e-mail"
                  onCheckedChange={(checked) =>
                    update({ email_enabled: checked, push_enabled: state.push_enabled })
                  }
                />
              </div>

              <div className="flex items-start justify-between gap-4">
                <div className="flex gap-3">
                  {state.push_enabled ? (
                    <Bell className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                  ) : (
                    <BellOff className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                  )}
                  <div>
                    <p className="font-medium text-foreground">Notificações push</p>
                    <p className="text-sm text-muted-foreground">
                      {pushSupported()
                        ? `Aviso direto no aparelho. ${state.devices} dispositivo(s) ativo(s).`
                        : "Seu navegador não suporta push — usaremos e-mail."}
                    </p>
                  </div>
                </div>
                <Switch
                  checked={state.push_enabled}
                  disabled={busy || !pushSupported()}
                  aria-label="Receber notificações push"
                  onCheckedChange={togglePush}
                />
              </div>

              {!state.email_enabled && !state.push_enabled && (
                <p className="text-sm text-destructive">
                  Todos os avisos estão desativados. Você ainda pode acompanhar em “Rastrear pedido”.
                </p>
              )}

              <Button
                variant="outline"
                className="w-full min-h-11"
                disabled={busy}
                onClick={() => update({ email_enabled: false, push_enabled: false })}
              >
                Cancelar todas as notificações
              </Button>
            </CardContent>
          </Card>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default PreferenciasNotificacao;
