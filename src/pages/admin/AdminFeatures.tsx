import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Loader2, MessageCircle, Power } from "lucide-react";
import { useFeatureFlags, useUpdateFeatureFlags, FeatureFlags } from "@/hooks/useFeatureFlags";
import { toast } from "sonner";

interface FeatureItem {
  key: keyof FeatureFlags;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const FEATURES: FeatureItem[] = [
  {
    key: "chatbot_enabled",
    title: "Chatbot (LeleCute IA)",
    description:
      "Assistente virtual flutuante no canto inferior direito (home, listagem e PDP). Quando desligado, o botão e o painel não são renderizados.",
    icon: MessageCircle,
  },
];

export default function AdminFeatures() {
  const { data: flags, isLoading } = useFeatureFlags();
  const update = useUpdateFeatureFlags();

  const toggle = async (key: keyof FeatureFlags, value: boolean) => {
    if (!flags) return;
    try {
      await update.mutateAsync({ ...flags, [key]: value });
      toast.success(value ? "Recurso ativado" : "Recurso desativado");
    } catch (e: any) {
      toast.error("Erro ao atualizar recurso", { description: e?.message });
    }
  };

  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Power className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-semibold">Recursos do site</h1>
          <p className="text-sm text-muted-foreground">
            Ative ou desative funcionalidades do site sem precisar publicar código.
          </p>
        </div>
      </div>

      {isLoading || !flags ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-4">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            const checked = Boolean(flags[f.key]);
            return (
              <Card key={f.key}>
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <Icon className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <CardTitle className="text-base sm:text-lg">{f.title}</CardTitle>
                        <CardDescription className="mt-1">{f.description}</CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Label htmlFor={`flag-${f.key}`} className="text-sm text-muted-foreground">
                        {checked ? "Ativo" : "Inativo"}
                      </Label>
                      <Switch
                        id={`flag-${f.key}`}
                        checked={checked}
                        disabled={update.isPending}
                        onCheckedChange={(v) => toggle(f.key, v)}
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0" />
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
