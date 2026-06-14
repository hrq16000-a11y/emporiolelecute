import { useState, useEffect } from "react";
import { useRobotsConfig, useUpdateRobotsConfig, buildRobotsTxt, type RobotsConfig } from "@/hooks/useRobotsConfig";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Bot, Save, Copy, ExternalLink } from "lucide-react";
import StickySaveBar from "@/components/admin/StickySaveBar";

const FUNC_URL = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/robots-txt`;

export default function AdminRobots() {
  const { data, isLoading } = useRobotsConfig();
  const update = useUpdateRobotsConfig();
  const { toast } = useToast();
  const [form, setForm] = useState<RobotsConfig | null>(null);

  useEffect(() => { if (data && !form) setForm(data); }, [data, form]);

  if (isLoading || !form) return <p className="text-muted-foreground">Carregando...</p>;

  const setF = (patch: Partial<RobotsConfig>) => setForm({ ...form, ...patch });
  const preview = buildRobotsTxt(form);

  const save = async () => {
    try {
      await update.mutateAsync(form);
      toast({ title: "robots.txt atualizado" });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const copy = () => {
    navigator.clipboard.writeText(preview);
    toast({ title: "Copiado!" });
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display flex items-center gap-2"><Bot className="h-7 w-7" /> Robots.txt</h1>
          <p className="text-muted-foreground">Controle a indexação por buscadores.</p>
        </div>
        <Button onClick={save} disabled={update.isPending}><Save className="h-4 w-4 mr-2" /> Salvar</Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Indexação global</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Switch checked={form.allow_indexing} onCheckedChange={(v) => setF({ allow_indexing: v })} />
            <span>{form.allow_indexing ? "Permitir indexação" : "Bloquear todo o site (Disallow: /)"}</span>
          </div>
          <div>
            <Label>URL do sitemap</Label>
            <Input value={form.sitemap_url} onChange={(e) => setF({ sitemap_url: e.target.value })} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Bloqueios</CardTitle>
          <CardDescription>Uma rota por linha. Aceita curingas como <code>/admin/*</code>.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Caminhos bloqueados (Disallow)</Label>
            <Textarea
              rows={4}
              value={form.disallow_paths.join("\n")}
              onChange={(e) => setF({ disallow_paths: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })}
            />
          </div>
          <div>
            <Label>Slugs de categorias bloqueadas</Label>
            <Textarea
              rows={2}
              value={form.blocked_category_slugs.join("\n")}
              onChange={(e) => setF({ blocked_category_slugs: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })}
              placeholder="categoria-fora-de-linha"
            />
          </div>
          <div>
            <Label>Diretivas customizadas (avançado)</Label>
            <Textarea
              rows={3}
              value={form.custom_directives}
              onChange={(e) => setF({ custom_directives: e.target.value })}
              placeholder="User-agent: Googlebot-Image&#10;Disallow: /private-images/"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Preview</CardTitle>
          <CardDescription>
            Conteúdo dinâmico exposto em <a className="underline" href={FUNC_URL} target="_blank" rel="noreferrer">{FUNC_URL} <ExternalLink className="inline h-3 w-3" /></a>.
            Para servir como /robots.txt no domínio, copie o conteúdo abaixo para <code>public/robots.txt</code> ou aponte um redirect/proxy do CDN.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="bg-muted p-4 rounded text-xs overflow-x-auto">{preview}</pre>
          <Button variant="outline" size="sm" className="mt-3" onClick={copy}><Copy className="h-3 w-3 mr-1" /> Copiar</Button>
        </CardContent>
      </Card>
    </div>
  );
}
