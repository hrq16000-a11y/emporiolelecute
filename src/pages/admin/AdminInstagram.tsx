import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Loader2, Trash2, Save, Instagram, Sparkles, GripVertical, ExternalLink, Pencil,
  CheckCircle2, AlertTriangle, Upload, RefreshCcw, Heart, Download,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  useAdminInstagramPosts,
  useSaveInstagramPost,
  useDeleteInstagramPost,
  InstagramPost,
} from "@/hooks/useInstagramPosts";
import { supabase } from "@/integrations/supabase/client";
import SingleImageUpload from "@/components/admin/SingleImageUpload";
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors, DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useQueryClient } from "@tanstack/react-query";
import InstagramSchedulePanel from "@/components/admin/InstagramSchedulePanel";

const SHORTCODE_RE = /^https?:\/\/(www\.)?instagram\.com\/(p|reel|tv)\/([A-Za-z0-9_-]+)\/?/i;
const PROFILE_USERNAME = "emporiolelecute";

const blank: Partial<InstagramPost> = {
  image_url: "",
  alt_text: "Empório LeleCute - Instagram",
  post_url: "",
  position: 0,
  is_visible: true,
  extraction_status: "manual",
  extraction_error: null,
};

function validateUrl(url: string): { valid: boolean; reason?: string; shortcode?: string } {
  const t = url.trim();
  if (!t) return { valid: false, reason: "Cole a URL do post" };
  const m = t.match(SHORTCODE_RE);
  if (!m) return { valid: false, reason: "URL inválida. Use o formato https://www.instagram.com/p/SHORTCODE/ (ou /reel/, /tv/)" };
  return { valid: true, shortcode: m[3] };
}

function StatusBadge({ status, error }: { status?: string | null; error?: string | null }) {
  if (status === "extracted") {
    return (
      <Badge variant="secondary" className="gap-1 bg-emerald-100 text-emerald-700 border-emerald-200">
        <CheckCircle2 className="w-3 h-3" /> Extraído
      </Badge>
    );
  }
  if (status === "failed") {
    return (
      <Badge variant="destructive" className="gap-1" title={error || ""}>
        <AlertTriangle className="w-3 h-3" /> Falhou
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1">
      <Upload className="w-3 h-3" /> Manual
    </Badge>
  );
}

function SortableCard({
  post, onEdit, onDelete,
}: { post: InstagramPost; onEdit: () => void; onDelete: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: post.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative group rounded-xl overflow-hidden border bg-card ${isDragging ? "opacity-60 z-50" : ""} ${!post.is_visible ? "opacity-50" : ""}`}
    >
      <button
        {...attributes} {...listeners}
        className="absolute top-2 left-2 z-10 p-1.5 bg-background/80 rounded-md opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing"
        aria-label="Reordenar"
      >
        <GripVertical className="w-4 h-4" />
      </button>
      <div className="absolute top-2 right-2 z-10">
        <StatusBadge status={post.extraction_status} error={post.extraction_error} />
      </div>
      <img src={post.image_url} alt={post.alt_text} loading="lazy" className="w-full aspect-square object-cover" />
      <div className="p-2 text-xs flex items-center justify-between gap-2">
        <span className="truncate">#{post.position} {post.is_visible ? "✓" : "oculto"}</span>
        {post.post_url && (
          <a href={post.post_url} target="_blank" rel="noopener noreferrer" className="text-primary inline-flex items-center gap-1 hover:underline">
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
      {post.extraction_error && (
        <p className="px-2 pb-2 text-[10px] text-destructive line-clamp-2" title={post.extraction_error}>
          {post.extraction_error}
        </p>
      )}
      <div className="absolute inset-x-0 bottom-0 p-2 flex gap-2 opacity-0 group-hover:opacity-100 bg-gradient-to-t from-foreground/70 to-transparent">
        <Button size="sm" variant="secondary" onClick={onEdit} className="flex-1">
          <Pencil className="w-3 h-3 mr-1" /> Editar
        </Button>
        <Button size="sm" variant="destructive" onClick={onDelete}>
          <Trash2 className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
}

const AdminInstagram = () => {
  const { data: posts, isLoading } = useAdminInstagramPosts();
  const save = useSaveInstagramPost();
  const del = useDeleteInstagramPost();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [form, setForm] = useState<Partial<InstagramPost>>(blank);
  const [instagramUrl, setInstagramUrl] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [bulkRunning, setBulkRunning] = useState(false);
  const [profileRunning, setProfileRunning] = useState(false);
  const [profileResult, setProfileResult] = useState<{ ok: boolean; error?: string; posts?: { shortcode: string; permalink: string }[] } | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const runDeletePost = async (id: string) => {
    await del.mutateAsync(id);
    toast({ title: "Post removido" });
  };

  const validation = useMemo(() => validateUrl(instagramUrl), [instagramUrl]);
  const previewPosition = form.id ? form.position ?? 0 : (posts?.length ?? 0) + 1;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleExtract = async () => {
    if (!validation.valid) {
      toast({ title: "URL inválida", description: validation.reason, variant: "destructive" });
      return;
    }
    setExtracting(true);
    try {
      const { data, error } = await supabase.functions.invoke("instagram-oembed", {
        body: { action: "extract", url: instagramUrl.trim() },
      });
      if (error) throw error;
      if (data?.image_url) {
        setForm((f) => ({
          ...f,
          image_url: data.image_url,
          post_url: data.permalink || instagramUrl.trim(),
          alt_text: data.title?.slice(0, 200) || f.alt_text,
          shortcode: data.shortcode,
          extraction_status: "extracted",
          extraction_error: null,
          last_extracted_at: data.timestamp,
        }));
        toast({ title: "Thumbnail extraída", description: "Revise o preview e salve abaixo." });
      } else {
        setForm((f) => ({
          ...f,
          post_url: data?.permalink || instagramUrl.trim(),
          shortcode: data?.shortcode,
          extraction_status: "failed",
          extraction_error: data?.extraction_error || data?.error || "Falha desconhecida",
        }));
        toast({
          title: "Extração falhou",
          description: (data?.extraction_error || data?.error || "Faça upload manual da imagem."),
          variant: "destructive",
        });
      }
    } catch (e: any) {
      toast({ title: "Erro na extração", description: e.message, variant: "destructive" });
    } finally {
      setExtracting(false);
    }
  };

  const handleSave = async () => {
    if (!form.image_url) {
      toast({ title: "Adicione uma imagem", variant: "destructive" });
      return;
    }
    if (form.post_url) {
      const v = validateUrl(form.post_url);
      if (!v.valid) {
        toast({ title: "URL do post inválida", description: v.reason, variant: "destructive" });
        return;
      }
    }
    const status = form.extraction_status || (form.image_url ? "manual" : "failed");
    await save.mutateAsync({
      ...form,
      position: previewPosition,
      extraction_status: status,
    } as any);
    toast({ title: form.id ? "Post atualizado" : "Post adicionado" });
    setForm(blank);
    setInstagramUrl("");
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !posts) return;
    const oldIndex = posts.findIndex((p) => p.id === active.id);
    const newIndex = posts.findIndex((p) => p.id === over.id);
    const reordered = arrayMove(posts, oldIndex, newIndex);
    setReordering(true);
    try {
      qc.setQueryData(["instagram_posts", "admin"], reordered.map((p, i) => ({ ...p, position: i + 1 })));
      await Promise.all(reordered.map((p, i) =>
        supabase.from("instagram_posts").update({ position: i + 1 }).eq("id", p.id),
      ));
      qc.invalidateQueries({ queryKey: ["instagram_posts"] });
      toast({ title: "Ordem atualizada" });
    } catch (e: any) {
      toast({ title: "Erro ao reordenar", description: e.message, variant: "destructive" });
    } finally {
      setReordering(false);
    }
  };

  const toggleVisible = async (p: InstagramPost) => {
    await save.mutateAsync({ id: p.id, is_visible: !p.is_visible });
  };

  const handleBulkRefresh = async () => {
    setBulkRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("instagram-oembed", { body: { action: "bulk-refresh" } });
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["instagram_posts"] });
      toast({
        title: "Atualização concluída",
        description: `${data?.refreshed || 0} de ${data?.total || 0} posts re-extraídos.${data?.failed ? ` ${data.failed} falharam.` : ""}`,
      });
    } catch (e: any) {
      toast({ title: "Erro na atualização", description: e.message, variant: "destructive" });
    } finally {
      setBulkRunning(false);
    }
  };

  const handleProfileSync = async () => {
    setProfileRunning(true);
    setProfileResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("instagram-oembed", {
        body: { action: "profile", username: PROFILE_USERNAME },
      });
      if (error) throw error;
      setProfileResult(data);
      if (!data?.ok) {
        toast({ title: "Não foi possível ler o perfil", description: data?.error, variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Erro ao buscar perfil", description: e.message, variant: "destructive" });
    } finally {
      setProfileRunning(false);
    }
  };

  const importDiscoveredPost = async (permalink: string) => {
    setInstagramUrl(permalink);
    // dispara extract automaticamente
    setTimeout(() => {
      const btn = document.getElementById("ig-extract-btn") as HTMLButtonElement | null;
      btn?.click();
    }, 50);
  };

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Instagram className="w-7 h-7 text-primary" />
        <div className="flex-1">
          <h1 className="text-2xl font-display">Últimas Postagens do Instagram</h1>
          <p className="text-sm text-muted-foreground">
            Cole URLs de posts ou tente sincronizar com o perfil <strong>@{PROFILE_USERNAME}</strong>. Sem login, sem API oficial. Até 12 posts visíveis no site.
          </p>
        </div>
      </div>

      {/* Sincronização do perfil + bulk-refresh */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sincronizar com a conta @{PROFILE_USERNAME}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleProfileSync} disabled={profileRunning} variant="outline">
              {profileRunning ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
              Buscar últimas do perfil
            </Button>
            <Button onClick={handleBulkRefresh} disabled={bulkRunning || !posts?.length} variant="outline">
              {bulkRunning ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCcw className="w-4 h-4 mr-2" />}
              Atualizar imagens/títulos dos posts cadastrados ({posts?.length || 0})
            </Button>
          </div>
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Limitação técnica</AlertTitle>
            <AlertDescription className="text-xs">
              Sem token Meta, o Instagram normalmente bloqueia leitura do perfil (parede de login). Esta sincronização é <em>best-effort</em>: se conseguir, listamos as URLs encontradas para você importar com 1 clique. Se não, use a colagem manual abaixo.
            </AlertDescription>
          </Alert>
          {profileResult && profileResult.ok && profileResult.posts && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-emerald-700">{profileResult.posts.length} postagem(ns) encontradas:</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {profileResult.posts.map((p) => (
                  <Button key={p.shortcode} size="sm" variant="outline" className="justify-between" onClick={() => importDiscoveredPost(p.permalink)}>
                    <span className="truncate">/{p.shortcode}</span>
                    <Sparkles className="w-3 h-3" />
                  </Button>
                ))}
              </div>
            </div>
          )}
          {profileResult && !profileResult.ok && (
            <Alert variant="destructive">
              <AlertDescription className="text-xs">{profileResult.error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <InstagramSchedulePanel />

      {/* Form: URL + extract + preview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            {form.id ? "Editar post" : "Adicionar novo post"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!form.id && (
            <div className="space-y-2">
              <Label>URL do post do Instagram</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="https://www.instagram.com/p/XXXXXXXXX/"
                  value={instagramUrl}
                  onChange={(e) => setInstagramUrl(e.target.value)}
                  className={instagramUrl && !validation.valid ? "border-destructive" : ""}
                />
                <Button id="ig-extract-btn" onClick={handleExtract} disabled={extracting || !validation.valid}>
                  {extracting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Sparkles className="w-4 h-4 mr-1" /> Extrair</>}
                </Button>
              </div>
              {instagramUrl && !validation.valid && (
                <p className="text-xs text-destructive">{validation.reason}</p>
              )}
              {!instagramUrl && (
                <p className="text-xs text-muted-foreground">
                  Aceita posts (/p/), reels (/reel/) e IGTV (/tv/) públicos.
                </p>
              )}
            </div>
          )}

          {/* Status do form */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Status da imagem:</span>
            <StatusBadge status={form.extraction_status} error={form.extraction_error} />
            {form.extraction_error && (
              <span className="text-xs text-destructive">{form.extraction_error}</span>
            )}
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* Coluna esquerda: campos */}
            <div className="space-y-4">
              <div>
                <Label>Imagem (thumbnail)</Label>
                <SingleImageUpload
                  value={form.image_url || ""}
                  onChange={(url) => setForm({ ...form, image_url: url, extraction_status: form.extraction_status === "extracted" ? "extracted" : "manual" })}
                  folder="instagram"
                  hint="Quadrado 1:1 recomendado · até 5MB"
                  previewMaxWidth={220}
                />
              </div>

              <div>
                <Label>Título / texto alternativo</Label>
                <Input
                  value={form.alt_text || ""}
                  onChange={(e) => setForm({ ...form, alt_text: e.target.value })}
                  placeholder="Descreva a imagem (alt text para SEO)"
                />
              </div>

              <div>
                <Label>Link do post</Label>
                <Input
                  placeholder="https://instagram.com/p/..."
                  value={form.post_url || ""}
                  onChange={(e) => setForm({ ...form, post_url: e.target.value })}
                />
              </div>

              <div className="flex items-center gap-3">
                <Switch
                  checked={form.is_visible ?? true}
                  onCheckedChange={(v) => setForm({ ...form, is_visible: v })}
                />
                <Label>Visível no site</Label>
              </div>
            </div>

            {/* Coluna direita: PREVIEW */}
            <div>
              <Label>Preview no grid do site</Label>
              <div className="mt-2 p-4 bg-muted/30 rounded-lg border-2 border-dashed">
                <div className="max-w-[220px] mx-auto">
                  {form.image_url ? (
                    <a
                      href={form.post_url || `https://www.instagram.com/${PROFILE_USERNAME}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="relative aspect-square overflow-hidden rounded-xl group bg-muted/30 block"
                    >
                      <img
                        src={form.image_url}
                        alt={form.alt_text || "Instagram"}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                      />
                      <div className="absolute inset-0 bg-primary/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Heart className="h-8 w-8 text-primary-foreground" />
                      </div>
                    </a>
                  ) : (
                    <div className="aspect-square rounded-xl bg-muted flex items-center justify-center text-muted-foreground text-xs text-center p-4">
                      Adicione uma imagem para ver o preview
                    </div>
                  )}
                  <div className="mt-3 text-center space-y-1">
                    <p className="text-xs text-muted-foreground">Posição #{previewPosition} · {form.is_visible ? "Visível" : "Oculto"}</p>
                    <p className="text-xs italic line-clamp-2" title={form.alt_text || ""}>"{form.alt_text || "Sem texto alternativo"}"</p>
                    <a
                      href={form.post_url || `https://www.instagram.com/${PROFILE_USERNAME}`}
                      target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      <ExternalLink className="w-3 h-3" /> Ver no Instagram
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button onClick={handleSave} disabled={save.isPending}>
              {save.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              {form.id ? "Salvar alterações" : "Adicionar post"}
            </Button>
            {(form.id || form.image_url || instagramUrl) && (
              <Button variant="outline" onClick={() => { setForm(blank); setInstagramUrl(""); }}>
                Cancelar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Lista */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Posts cadastrados ({posts?.length || 0})</span>
            {reordering && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Loader2 className="w-6 h-6 animate-spin" />
          ) : !posts?.length ? (
            <p className="text-muted-foreground text-sm">Nenhum post cadastrado.</p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground mb-3">
                Arraste pelo ícone <GripVertical className="inline w-3 h-3" /> para reordenar. Os 12 primeiros visíveis aparecem no site.
              </p>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={posts.map((p) => p.id)} strategy={rectSortingStrategy}>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {posts.map((p) => (
                      <SortableCard
                        key={p.id}
                        post={p}
                        onEdit={() => setForm(p)}
                        onDelete={() => setConfirmDeleteId(p.id)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>

              <div className="mt-4 flex flex-wrap gap-2">
                {posts.map((p) => (
                  <Button key={`tog-${p.id}`} size="sm" variant={p.is_visible ? "default" : "outline"} onClick={() => toggleVisible(p)}>
                    #{p.position} {p.is_visible ? "Visível" : "Oculto"}
                  </Button>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminInstagram;
