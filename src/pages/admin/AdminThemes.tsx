/**
 * Fase 10.3 — Admin de Hubs Temáticos.
 * Lista, classifica, edita e governa hubs (/admin/themes).
 */
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Plus, ExternalLink, Trash2, Save } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useTags } from "@/hooks/useTags";
import {
  useThemeHubs,
  useUpdateThemeHub,
  useCreateThemeHub,
  useDeleteThemeHub,
} from "@/hooks/useThemeHubs";
import { classifyTheme, MIN_AUTHORITY_INDEX, MIN_AUTHORITY_STRONG } from "@/lib/themeGovernance";
import type { ThemeHub } from "@/lib/themeGovernance";

const slugify = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

const AdminThemes = () => {
  const hubsQuery = useThemeHubs();
  const tagsQuery = useTags();
  const updateHub = useUpdateThemeHub();
  const createHub = useCreateThemeHub();
  const deleteHub = useDeleteThemeHub();

  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [newTagId, setNewTagId] = useState<string>("");
  const [editing, setEditing] = useState<ThemeHub | null>(null);

  const hubs = hubsQuery.data ?? [];

  const buckets = useMemo(() => {
    const strong: ThemeHub[] = [];
    const indexable: ThemeHub[] = [];
    const regular: ThemeHub[] = [];
    const weak: ThemeHub[] = [];
    for (const h of hubs) {
      const c = classifyTheme(h.authority_score);
      if (c === "strong") strong.push(h);
      else if (c === "indexable") indexable.push(h);
      else if (c === "regular") regular.push(h);
      else weak.push(h);
    }
    return { strong, indexable, regular, weak };
  }, [hubs]);

  const thin = useMemo(() => hubs.filter((h) => h.thin_content_risk), [hubs]);
  const cannibal = useMemo(
    () => hubs.filter((h) => h.cannibalization_risk === "high" || h.cannibalization_risk === "medium"),
    [hubs]
  );

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    try {
      const hub = await createHub.mutateAsync({
        title: newTitle.trim(),
        slug: newSlug.trim() || slugify(newTitle),
        tag_id: newTagId || null,
        is_approved: false,
        is_indexed: false,
      });
      toast.success(`Hub "${hub.title}" criado em modo seguro.`);
      setCreating(false);
      setNewTitle(""); setNewSlug(""); setNewTagId("");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro ao criar hub";
      toast.error(msg);
    }
  };

  const handleApprove = async (hub: ThemeHub) => {
    try {
      await updateHub.mutateAsync({
        id: hub.id,
        patch: { is_approved: true, discovery_status: "approved" },
      });
      toast.success("Hub aprovado.");
    } catch { toast.error("Erro ao aprovar"); }
  };

  const handleToggleIndex = async (hub: ThemeHub) => {
    try {
      await updateHub.mutateAsync({
        id: hub.id,
        patch: { is_indexed: !hub.is_indexed },
      });
      toast.success(hub.is_indexed ? "Hub marcado como noindex." : "Hub indexável.");
    } catch { toast.error("Erro ao atualizar indexação"); }
  };

  const handleIgnore = async (hub: ThemeHub) => {
    try {
      await updateHub.mutateAsync({
        id: hub.id,
        patch: { discovery_status: "ignored", is_approved: false, is_indexed: false },
      });
      toast.success("Hub ignorado.");
    } catch { toast.error("Erro ao ignorar"); }
  };

  const handleDelete = async (hub: ThemeHub) => {
    try {
      await deleteHub.mutateAsync(hub.id);
      toast.success("Hub excluído.");
    } catch { toast.error("Erro ao excluir"); }
  };

  const handleSaveEdit = async () => {
    if (!editing) return;
    try {
      await updateHub.mutateAsync({
        id: editing.id,
        patch: {
          title: editing.title,
          intro: editing.intro,
          editorial_content: editing.editorial_content,
          meta_title: editing.meta_title,
          meta_description: editing.meta_description,
          hero_image_url: editing.hero_image_url,
          authority_score: editing.authority_score,
          thin_content_risk: editing.thin_content_risk,
          notes: editing.notes,
        },
      });
      toast.success("Hub atualizado.");
      setEditing(null);
    } catch { toast.error("Erro ao salvar"); }
  };

  const renderRow = (hub: ThemeHub) => (
    <Card key={hub.id} className="mb-3">
      <CardContent className="p-4 flex flex-col md:flex-row md:items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold truncate">{hub.title}</span>
            <Badge variant="outline" className="font-mono text-xs">/tema/{hub.slug}</Badge>
            <Badge variant={hub.is_approved ? "default" : "secondary"}>
              {hub.is_approved ? "Aprovado" : "Pendente"}
            </Badge>
            <Badge variant={hub.is_indexed ? "default" : "outline"}>
              {hub.is_indexed ? "Indexável" : "noindex"}
            </Badge>
            <Badge variant="outline">Score {hub.authority_score}</Badge>
            {hub.thin_content_risk && <Badge variant="destructive">Thin content</Badge>}
            {hub.cannibalization_risk === "high" && <Badge variant="destructive">Canibal alta</Badge>}
            {hub.cannibalization_risk === "medium" && <Badge variant="outline">Canibal média</Badge>}
            <Badge variant="outline" className="text-xs">{hub.discovery_status}</Badge>
          </div>
          {hub.intro && (
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{hub.intro}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" variant="outline">
            <Link to={`/tema/${hub.slug}?admin_preview=1`} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="w-3.5 h-3.5 mr-1" /> Preview
            </Link>
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setEditing(hub)}>Editar</Button>
          {!hub.is_approved && (
            <Button size="sm" onClick={() => handleApprove(hub)}>Aprovar</Button>
          )}
          <Button size="sm" variant="outline" onClick={() => handleToggleIndex(hub)}>
            {hub.is_indexed ? "Tornar noindex" : "Tornar indexável"}
          </Button>
          {hub.discovery_status !== "ignored" && (
            <Button size="sm" variant="ghost" onClick={() => handleIgnore(hub)}>Ignorar</Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => handleDelete(hub)}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  if (hubsQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display font-semibold">Hubs Temáticos</h1>
          <p className="text-sm text-muted-foreground">
            Governança SAFE MODE — autoridade ≥ {MIN_AUTHORITY_INDEX} para indexar, ≥ {MIN_AUTHORITY_STRONG} para hub forte.
          </p>
        </div>
        <Button onClick={() => setCreating((v) => !v)}>
          <Plus className="w-4 h-4 mr-1" />
          {creating ? "Cancelar" : "Novo hub"}
        </Button>
      </div>

      {creating && (
        <Card>
          <CardHeader><CardTitle className="text-base">Novo hub temático</CardTitle></CardHeader>
          <CardContent className="grid md:grid-cols-3 gap-3">
            <div>
              <Label htmlFor="title">Título</Label>
              <Input id="title" value={newTitle}
                onChange={(e) => { setNewTitle(e.target.value); if (!newSlug) setNewSlug(slugify(e.target.value)); }}
                placeholder="Ex.: Safari" />
            </div>
            <div>
              <Label htmlFor="slug">Slug</Label>
              <Input id="slug" value={newSlug} onChange={(e) => setNewSlug(slugify(e.target.value))} placeholder="safari" />
            </div>
            <div>
              <Label>Tag vinculada (opcional)</Label>
              <Select value={newTagId} onValueChange={setNewTagId}>
                <SelectTrigger><SelectValue placeholder="Nenhuma" /></SelectTrigger>
                <SelectContent>
                  {(tagsQuery.data ?? []).map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-3">
              <Button onClick={handleCreate} disabled={!newTitle.trim() || createHub.isPending}>
                <Save className="w-4 h-4 mr-1" /> Criar hub (modo seguro)
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Fortes</div><div className="text-2xl font-semibold">{buckets.strong.length}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Indexáveis</div><div className="text-2xl font-semibold">{buckets.indexable.length}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Thin content</div><div className="text-2xl font-semibold">{thin.length}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Risco canibal.</div><div className="text-2xl font-semibold">{cannibal.length}</div></CardContent></Card>
      </div>

      <Tabs defaultValue="strong">
        <TabsList>
          <TabsTrigger value="strong">Fortes ({buckets.strong.length})</TabsTrigger>
          <TabsTrigger value="indexable">Indexáveis ({buckets.indexable.length})</TabsTrigger>
          <TabsTrigger value="regular">Regulares ({buckets.regular.length})</TabsTrigger>
          <TabsTrigger value="weak">Fracos ({buckets.weak.length})</TabsTrigger>
          <TabsTrigger value="thin">Thin ({thin.length})</TabsTrigger>
          <TabsTrigger value="cannibal">Canibal ({cannibal.length})</TabsTrigger>
          <TabsTrigger value="all">Todos ({hubs.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="strong">{buckets.strong.map(renderRow)}</TabsContent>
        <TabsContent value="indexable">{buckets.indexable.map(renderRow)}</TabsContent>
        <TabsContent value="regular">{buckets.regular.map(renderRow)}</TabsContent>
        <TabsContent value="weak">{buckets.weak.map(renderRow)}</TabsContent>
        <TabsContent value="thin">{thin.map(renderRow)}</TabsContent>
        <TabsContent value="cannibal">{cannibal.map(renderRow)}</TabsContent>
        <TabsContent value="all">{hubs.map(renderRow)}</TabsContent>
      </Tabs>

      {editing && (
        <Card className="fixed inset-4 md:inset-10 z-50 overflow-auto shadow-2xl">
          <CardHeader className="flex flex-row items-center justify-between sticky top-0 bg-background z-10 border-b">
            <CardTitle className="text-base">Editar hub: {editing.title}</CardTitle>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setEditing(null)}>Fechar</Button>
              <Button onClick={handleSaveEdit} disabled={updateHub.isPending}>
                <Save className="w-4 h-4 mr-1" /> Salvar
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <Label>Título</Label>
                <Input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
              </div>
              <div>
                <Label>Imagem do hero (URL)</Label>
                <Input value={editing.hero_image_url ?? ""} onChange={(e) => setEditing({ ...editing, hero_image_url: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Intro</Label>
              <Textarea rows={2} value={editing.intro ?? ""} onChange={(e) => setEditing({ ...editing, intro: e.target.value })} />
            </div>
            <div>
              <Label>Conteúdo editorial</Label>
              <Textarea rows={8} value={editing.editorial_content ?? ""} onChange={(e) => setEditing({ ...editing, editorial_content: e.target.value })} />
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <Label>Meta title</Label>
                <Input value={editing.meta_title ?? ""} onChange={(e) => setEditing({ ...editing, meta_title: e.target.value })} />
              </div>
              <div>
                <Label>Meta description</Label>
                <Input value={editing.meta_description ?? ""} onChange={(e) => setEditing({ ...editing, meta_description: e.target.value })} />
              </div>
              <div>
                <Label>Authority score (manual override)</Label>
                <Input type="number" value={editing.authority_score}
                  onChange={(e) => setEditing({ ...editing, authority_score: Number(e.target.value) || 0 })} />
              </div>
              <div className="flex items-center gap-2 pt-6">
                <Switch checked={editing.thin_content_risk}
                  onCheckedChange={(v) => setEditing({ ...editing, thin_content_risk: v })} />
                <Label>Marcar como thin content</Label>
              </div>
            </div>
            <div>
              <Label>Notas internas</Label>
              <Textarea rows={2} value={editing.notes ?? ""} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AdminThemes;
