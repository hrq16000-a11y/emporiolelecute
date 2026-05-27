import { useState } from "react";
import {
  useAdminOccasionLandings,
  useUpsertOccasionLanding,
  useDeleteOccasionLanding,
  type OccasionLanding,
} from "@/hooks/useOccasionLandings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Eye, EyeOff, ExternalLink, MapPin, Image as ImageIcon, Trash } from "lucide-react";
import SingleImageUpload from "@/components/admin/SingleImageUpload";
import ImageUploader from "@/components/admin/ImageUploader";

type FormState = {
  id?: string;
  route_slug: string;
  occasion_slug: string;
  h1: string;
  hero_badge: string;
  hero_subtitle: string;
  theme_accent: string;
  seo_title: string;
  seo_description: string;
  seo_copy: string;
  whatsapp_message: string;
  faqs_json: string;
  gallery_json: string;
  testimonials_json: string;
  social_proof_stats_json: string;
  related_route_slugs_csv: string;
  gallery: string[]; // admin uploader trabalha apenas com URLs simples
  og_image_url: string;
  og_image_alt: string;
  position: number;
  is_published: boolean;
};

const blank: FormState = {
  route_slug: "",
  occasion_slug: "",
  h1: "",
  hero_badge: "",
  hero_subtitle: "",
  theme_accent: "from-pink-100 to-rose-100",
  seo_title: "",
  seo_description: "",
  seo_copy: "",
  whatsapp_message: "",
  faqs_json: "[]",
  gallery_json: "[]",
  testimonials_json: "[]",
  social_proof_stats_json: "[]",
  related_route_slugs_csv: "",
  gallery: [],
  og_image_url: "",
  og_image_alt: "",
  position: 0,
  is_published: false,
};

const toForm = (l: OccasionLanding): FormState => ({
  id: l.id,
  route_slug: l.route_slug,
  occasion_slug: l.occasion_slug,
  h1: l.h1,
  hero_badge: l.hero_badge,
  hero_subtitle: l.hero_subtitle,
  theme_accent: l.theme_accent,
  seo_title: l.seo_title,
  seo_description: l.seo_description,
  seo_copy: l.seo_copy,
  whatsapp_message: l.whatsapp_message,
  faqs_json: JSON.stringify(l.faqs, null, 2),
  gallery_json: JSON.stringify(l.gallery, null, 2),
  testimonials_json: JSON.stringify(l.testimonials, null, 2),
  social_proof_stats_json: JSON.stringify(l.social_proof_stats, null, 2),
  related_route_slugs_csv: l.related_route_slugs.join(", "),
  gallery: Array.isArray(l.gallery)
    ? l.gallery.map((g) => (typeof g === "string" ? g : g.src)).filter(Boolean)
    : [],
  og_image_url: l.og_image_url ?? "",
  og_image_alt: l.og_image_alt ?? "",
  position: l.position,
  is_published: l.is_published,
});

const parseJson = <T,>(s: string, fallback: T): T => {
  try { return JSON.parse(s) as T; } catch { return fallback; }
};

const AdminOccasionLandings = () => {
  const { data: landings, isLoading } = useAdminOccasionLandings();
  const upsert = useUpsertOccasionLanding();
  const remove = useDeleteOccasionLanding();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(blank);
  const [confirmDelete, setConfirmDelete] = useState<OccasionLanding | null>(null);

  const openNew = () => { setForm(blank); setOpen(true); };
  const openEdit = (l: OccasionLanding) => { setForm(toForm(l)); setOpen(true); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await upsert.mutateAsync({
      id: form.id,
      route_slug: form.route_slug.trim(),
      occasion_slug: form.occasion_slug.trim(),
      h1: form.h1,
      hero_badge: form.hero_badge,
      hero_subtitle: form.hero_subtitle,
      theme_accent: form.theme_accent,
      seo_title: form.seo_title,
      seo_description: form.seo_description,
      seo_copy: form.seo_copy,
      whatsapp_message: form.whatsapp_message,
      faqs: parseJson(form.faqs_json, []),
      gallery: form.gallery,
      testimonials: parseJson(form.testimonials_json, []),
      social_proof_stats: parseJson(form.social_proof_stats_json, []),
      related_route_slugs: form.related_route_slugs_csv
        .split(",").map((s) => s.trim()).filter(Boolean),
      og_image_url: form.og_image_url || null,
      og_image_alt: form.og_image_alt || null,
      position: Number(form.position) || 0,
      is_published: form.is_published,
    } as any);
    setOpen(false);
  };

  const togglePublish = (l: OccasionLanding) =>
    upsert.mutate({ id: l.id, route_slug: l.route_slug, is_published: !l.is_published } as any);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground flex items-center gap-3">
            <MapPin className="w-8 h-8 text-primary" />
            Landings de Ocasiões
          </h1>
          <p className="text-muted-foreground mt-1">
            Páginas SEO dinâmicas (/lembrancinhas-&lt;slug&gt;). Edite copy, FAQs e prova social.
          </p>
        </div>
        <Button onClick={openNew} className="gap-2">
          <Plus className="w-4 h-4" /> Nova Landing
        </Button>
      </div>

      {/* Fase 3.3 — aviso de descontinuação */}
      <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-700 p-4 text-sm">
        <p className="font-semibold text-amber-800 dark:text-amber-200">⚠️ Módulo DEPRECATED</p>
        <p className="text-amber-700 dark:text-amber-300 mt-1">
          As landings <code>/lembrancinhas-*</code> foram consolidadas em <code>/ocasiao/:slug</code> e respondem
          via redirect 301. Edite agora o conteúdo SEO diretamente em{" "}
          <a href="/admin/taxonomias" className="underline font-medium">Taxonomias → Ocasiões</a>.
          Esta tela é mantida apenas como backup reversível.
        </p>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Carregando…</p>
      ) : !landings || landings.length === 0 ? (
        <Card><CardContent className="p-12 text-center text-muted-foreground">
          Nenhuma landing cadastrada ainda.
        </CardContent></Card>
      ) : (
        <div className="grid gap-4">
          {landings.map((l) => (
            <Card key={l.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div className="flex-1">
                  <CardTitle className="text-lg flex items-center gap-2">
                    {l.h1}
                    {l.is_published ? (
                      <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-green-500/10 text-green-700">Publicada</span>
                    ) : (
                      <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Rascunho</span>
                    )}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    /lembrancinhas-{l.route_slug} · ocasião: {l.occasion_slug} · {l.faqs.length} FAQs
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <a href={`/lembrancinhas-${l.route_slug}`} target="_blank" rel="noopener noreferrer"
                     className="p-2 rounded-lg text-muted-foreground hover:bg-muted" title="Abrir página pública">
                    <ExternalLink className="w-4 h-4" />
                  </a>
                  <a href={`/lembrancinhas-${l.route_slug}?preview=true`} target="_blank" rel="noopener noreferrer"
                     className="p-2 rounded-lg text-amber-600 hover:bg-amber-500/10" title="Pré-visualizar (inclui rascunhos)">
                    👁️
                  </a>
                  <button onClick={() => togglePublish(l)}
                    className="p-2 rounded-lg text-muted-foreground hover:bg-muted"
                    title={l.is_published ? "Despublicar" : "Publicar"}>
                    {l.is_published ? <Eye className="w-4 h-4 text-green-600" /> : <EyeOff className="w-4 h-4" />}
                  </button>
                  <button onClick={() => openEdit(l)} className="p-2 rounded-lg text-primary hover:bg-primary/10">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => setConfirmDelete(l)} className="p-2 rounded-lg text-destructive hover:bg-destructive/10">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar landing" : "Nova landing"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Route slug (URL)</Label>
                <Input value={form.route_slug} required
                  onChange={(e) => setForm({ ...form, route_slug: e.target.value })}
                  placeholder="cha-de-bebe" />
              </div>
              <div>
                <Label>Occasion slug (filtro produtos)</Label>
                <Input value={form.occasion_slug} required
                  onChange={(e) => setForm({ ...form, occasion_slug: e.target.value })}
                  placeholder="cha-bebe" />
              </div>
            </div>
            <div>
              <Label>H1</Label>
              <Input value={form.h1} required onChange={(e) => setForm({ ...form, h1: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Hero badge</Label>
                <Input value={form.hero_badge} required onChange={(e) => setForm({ ...form, hero_badge: e.target.value })} />
              </div>
              <div>
                <Label>Theme accent (Tailwind)</Label>
                <Input value={form.theme_accent} onChange={(e) => setForm({ ...form, theme_accent: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Hero subtitle</Label>
              <Textarea value={form.hero_subtitle} required rows={2}
                onChange={(e) => setForm({ ...form, hero_subtitle: e.target.value })} />
            </div>
            <div>
              <Label>SEO title (≤60)</Label>
              <Input value={form.seo_title} required maxLength={70}
                onChange={(e) => setForm({ ...form, seo_title: e.target.value })} />
            </div>
            <div>
              <Label>SEO description (≤160)</Label>
              <Textarea value={form.seo_description} required rows={2}
                onChange={(e) => setForm({ ...form, seo_description: e.target.value })} />
            </div>
            <div>
              <Label>SEO copy (parágrafo longo)</Label>
              <Textarea value={form.seo_copy} required rows={5}
                onChange={(e) => setForm({ ...form, seo_copy: e.target.value })} />
            </div>
            <div>
              <Label>Mensagem WhatsApp</Label>
              <Textarea value={form.whatsapp_message} required rows={2}
                onChange={(e) => setForm({ ...form, whatsapp_message: e.target.value })} />
            </div>
            <div>
              <Label>FAQs (JSON: [&#123;question, answer&#125;])</Label>
              <Textarea value={form.faqs_json} rows={6} className="font-mono text-xs"
                onChange={(e) => setForm({ ...form, faqs_json: e.target.value })} />
            </div>
            <div className="space-y-2 border rounded-lg p-4 bg-muted/30">
              <Label className="flex items-center gap-2 text-base"><ImageIcon className="w-4 h-4"/>Galeria de imagens</Label>
              <p className="text-xs text-muted-foreground">Faça upload das fotos que serão mostradas na landing. A primeira aparece em destaque.</p>
              <ImageUploader
                images={form.gallery}
                onImagesChange={(imgs) => setForm({ ...form, gallery: imgs })}
                maxImages={12}
              />
            </div>

            <div className="space-y-3 border rounded-lg p-4 bg-muted/30">
              <Label className="flex items-center gap-2 text-base"><ImageIcon className="w-4 h-4"/>Open Graph (compartilhamento social)</Label>
              <p className="text-xs text-muted-foreground">Imagem exibida no WhatsApp/Facebook/Instagram quando o link da landing é compartilhado. Recomendado 1200×630.</p>
              <SingleImageUpload
                value={form.og_image_url}
                onChange={(url) => setForm({ ...form, og_image_url: url })}
                folder="og-landings"
                hint="1200x630 recomendado · até 5MB"
                previewMaxWidth={360}
              />
              <div>
                <Label className="text-xs">Texto alternativo (alt)</Label>
                <Input value={form.og_image_alt} onChange={(e) => setForm({ ...form, og_image_alt: e.target.value })}
                  placeholder="Ex: Lembrancinhas artesanais para chá de bebê" />
              </div>
            </div>
            <div>
              <Label>Depoimentos (JSON)</Label>
              <Textarea value={form.testimonials_json} rows={4} className="font-mono text-xs"
                onChange={(e) => setForm({ ...form, testimonials_json: e.target.value })} />
            </div>
            <div>
              <Label>Stats (JSON: [&#123;value, label&#125;])</Label>
              <Textarea value={form.social_proof_stats_json} rows={3} className="font-mono text-xs"
                onChange={(e) => setForm({ ...form, social_proof_stats_json: e.target.value })} />
            </div>
            <div>
              <Label>Related route slugs (CSV)</Label>
              <Input value={form.related_route_slugs_csv}
                onChange={(e) => setForm({ ...form, related_route_slugs_csv: e.target.value })}
                placeholder="maternidade, cha-revelacao" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Posição</Label>
                <Input type="number" value={form.position}
                  onChange={(e) => setForm({ ...form, position: Number(e.target.value) })} />
              </div>
              <div className="flex items-end justify-between gap-2">
                <Label htmlFor="pub">Publicada</Label>
                <Switch id="pub" checked={form.is_published}
                  onCheckedChange={(c) => setForm({ ...form, is_published: c })} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={upsert.isPending}>
                {form.id ? "Salvar" : "Criar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={() => setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir landing?</AlertDialogTitle>
            <AlertDialogDescription>
              A página <strong>/lembrancinhas-{confirmDelete?.route_slug}</strong> deixará de existir. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={async () => { if (confirmDelete) { await remove.mutateAsync(confirmDelete.id); setConfirmDelete(null); } }}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminOccasionLandings;
