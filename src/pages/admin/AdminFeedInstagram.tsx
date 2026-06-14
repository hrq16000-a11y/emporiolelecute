import { useState, useEffect } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Plus, Trash2, ExternalLink, Eye, EyeOff, Instagram, GripVertical, Save, AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import {
  useInstagramFeedEmbedsAdmin,
  useSaveInstagramFeedEmbed,
  useDeleteInstagramFeedEmbed,
  type InstagramFeedEmbed,
} from "@/hooks/useInstagramFeedEmbeds";
import { useInstagramFeedConfig, useSaveInstagramFeedConfig } from "@/hooks/useInstagramFeedConfig";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";

// /p/, /reel/, /tv/ + shortcode com no mínimo 5 chars (Instagram normalmente usa 11)
const STRICT_URL_REGEX =
  /^https?:\/\/(www\.)?instagram\.com\/(p|reel|tv)\/([A-Za-z0-9_-]{5,})\/?(\?.*)?$/i;

const parseShortcode = (url: string): string | null => {
  const m = url.trim().match(STRICT_URL_REGEX);
  return m ? m[3] : null;
};

interface SortableRowProps {
  item: InstagramFeedEmbed;
  index: number;
  visibleLimit: number;
  onUpdate: (item: InstagramFeedEmbed, patch: Partial<InstagramFeedEmbed>) => void;
  onDelete: (id: string) => void;
}

const SortableRow = ({ item, index, visibleLimit, onUpdate, onDelete }: SortableRowProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  const shortcode = parseShortcode(item.post_url);

  return (
    <Card ref={setNodeRef} style={style} className="p-4">
      <div className="grid gap-3 md:grid-cols-[auto_1fr_auto_auto] items-center">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground p-1"
          aria-label="Reordenar"
        >
          <GripVertical className="h-5 w-5" />
        </button>

        <div className="space-y-1 min-w-0">
          <a
            href={item.post_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary hover:underline truncate flex items-center gap-1"
          >
            {item.post_url} <ExternalLink className="h-3 w-3 flex-shrink-0" />
          </a>
          {item.caption && (
            <p className="text-xs text-muted-foreground truncate">{item.caption}</p>
          )}
          <div className="flex items-center gap-2 text-xs">
            <Badge variant={index >= visibleLimit ? "outline" : "default"}>
              {index >= visibleLimit ? `Excedente (#${index + 1})` : `Visível #${index + 1}`}
            </Badge>
            {shortcode && <Badge variant="secondary">{shortcode}</Badge>}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {item.is_active ? (
            <Eye className="h-4 w-4" />
          ) : (
            <EyeOff className="h-4 w-4 text-muted-foreground" />
          )}
          <Switch
            checked={item.is_active}
            onCheckedChange={(checked) => onUpdate(item, { is_active: checked })}
          />
        </div>

        <Button variant="ghost" size="icon" onClick={() => onDelete(item.id)} aria-label="Remover">
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>
    </Card>
  );
};

const AdminFeedInstagram = () => {
  const { data: items = [], isLoading } = useInstagramFeedEmbedsAdmin();
  const { data: config } = useInstagramFeedConfig();
  const save = useSaveInstagramFeedEmbed();
  const del = useDeleteInstagramFeedEmbed();
  const saveConfig = useSaveInstagramFeedConfig();
  const qc = useQueryClient();

  const [draftUrl, setDraftUrl] = useState("");
  const [draftCaption, setDraftCaption] = useState("");
  const [draftPreviewImg, setDraftPreviewImg] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [cfg, setCfg] = useState({
    visible_count: 6,
    heading: "",
    subheading: "",
    description: "",
  });
  useEffect(() => {
    if (config) setCfg(config);
  }, [config]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const draftShortcode = parseShortcode(draftUrl);
  const draftValid = draftUrl.length === 0 || !!draftShortcode;
  const draftEmbedSrc = draftShortcode
    ? `https://www.instagram.com/p/${draftShortcode}/embed/captioned`
    : null;

  const handleAdd = async () => {
    if (!draftShortcode) {
      toast.error("URL inválida. Use /p/, /reel/ ou /tv/ com código do post.");
      return;
    }
    try {
      await save.mutateAsync({
        post_url: draftUrl.trim(),
        caption: draftCaption.trim() || null,
        preview_image_url: draftPreviewImg.trim() || null,
        position: items.length,
        is_active: true,
      });
      toast.success("Post adicionado");
      setDraftUrl("");
      setDraftCaption("");
      setDraftPreviewImg("");
      setPreviewUrl(null);
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar");
    }
  };

  const handleUpdate = async (item: InstagramFeedEmbed, patch: Partial<InstagramFeedEmbed>) => {
    try {
      await save.mutateAsync({ ...item, ...patch });
    } catch (e: any) {
      toast.error(e.message || "Erro ao atualizar");
    }
  };

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleDelete = (id: string) => {
    setConfirmDeleteId(id);
  };

  const runDelete = async (id: string) => {
    try {
      await del.mutateAsync(id);
      toast.success("Removido");
    } catch (e: any) {
      toast.error(e.message || "Erro ao remover");
    }
  };

  const handleDragEnd = async (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = items.findIndex((i) => i.id === active.id);
    const newIdx = items.findIndex((i) => i.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    const reordered = arrayMove(items, oldIdx, newIdx);
    try {
      await Promise.all(
        reordered.map((it, idx) =>
          (supabase as any).from("instagram_feed_embeds").update({ position: idx }).eq("id", it.id),
        ),
      );
      toast.success("Ordem atualizada");
      // refetch via mutation invalidate
      qc.invalidateQueries({ queryKey: ["instagram_feed_embeds"] });
    } catch (err: any) {
      toast.error(err.message || "Erro ao reordenar");
    }
  };

  const handleSaveConfig = async () => {
    try {
      await saveConfig.mutateAsync(cfg);
      toast.success("Configuração salva");
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar config");
    }
  };

  return (
    <div className="space-y-6 p-6">
      <header className="flex items-center gap-3">
        <Instagram className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-display">Feed Instagram (Embed Oficial)</h1>
          <p className="text-sm text-muted-foreground">
            URLs de posts públicos. Sem scraping, sem tokens. Reordenar arrastando.
          </p>
        </div>
      </header>

      {/* Configurações públicas */}
      <Card className="p-5 space-y-4">
        <h2 className="font-medium flex items-center gap-2">
          <Save className="h-4 w-4" /> Configuração do componente público
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Quantidade de posts visíveis: {cfg.visible_count}</Label>
            <Slider
              min={1}
              max={12}
              step={1}
              value={[cfg.visible_count]}
              onValueChange={([v]) => setCfg({ ...cfg, visible_count: v })}
            />
          </div>
          <div className="space-y-1">
            <Label>Subtítulo / handle</Label>
            <Input
              value={cfg.subheading}
              maxLength={80}
              onChange={(e) => setCfg({ ...cfg, subheading: e.target.value })}
            />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label>Título</Label>
            <Input
              value={cfg.heading}
              maxLength={120}
              onChange={(e) => setCfg({ ...cfg, heading: e.target.value })}
            />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label>Descrição (opcional)</Label>
            <Textarea
              value={cfg.description}
              maxLength={280}
              rows={2}
              onChange={(e) => setCfg({ ...cfg, description: e.target.value })}
            />
          </div>
        </div>
        <Button onClick={handleSaveConfig} disabled={saveConfig.isPending}>
          Salvar configuração
        </Button>
      </Card>

      {/* Adicionar */}
      <Card className="p-5 space-y-4 border-primary/30">
        <h2 className="font-medium">Adicionar novo post</h2>
        <div className="grid gap-3 md:grid-cols-[2fr_1fr_auto] items-start">
          <div className="space-y-1">
            <Label>URL do post</Label>
            <Input
              placeholder="https://www.instagram.com/p/XXXXXXXXXXX/"
              value={draftUrl}
              onChange={(e) => setDraftUrl(e.target.value)}
            />
            {draftUrl && !draftValid && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                Formato inválido. Use /p/, /reel/ ou /tv/ com código de pelo menos 5 caracteres.
              </p>
            )}
            {draftValid && draftShortcode && (
              <p className="text-xs text-emerald-600 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Shortcode válido: <code>{draftShortcode}</code>
              </p>
            )}
          </div>
          <div className="space-y-1">
            <Label>Legenda fallback (opcional)</Label>
            <Input
              placeholder="Ver no Instagram"
              value={draftCaption}
              onChange={(e) => setDraftCaption(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Button
              variant="outline"
              type="button"
              disabled={!draftEmbedSrc}
              onClick={() => setPreviewUrl(draftEmbedSrc)}
            >
              Pré-visualizar
            </Button>
            <Button onClick={handleAdd} disabled={save.isPending || !draftShortcode}>
              <Plus className="h-4 w-4 mr-1" /> Adicionar
            </Button>
          </div>
        </div>
        <div className="space-y-1">
          <Label>Imagem de prévia (URL pública, opcional)</Label>
          <Input
            placeholder="https://...jpg — usada se o embed não carregar"
            value={draftPreviewImg}
            onChange={(e) => setDraftPreviewImg(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Recomendado: copie a URL da imagem do post (clique direito → copiar endereço da imagem) para garantir uma prévia mesmo se o embed bloquear.
          </p>
          {draftPreviewImg && (
            <img src={draftPreviewImg} alt="" className="h-32 rounded-md border mt-2 object-cover" />
          )}
        </div>

        {previewUrl && (
          <div className="border border-border rounded-xl overflow-hidden bg-muted/30">
            <div className="flex items-center justify-between px-3 py-2 text-xs text-muted-foreground border-b">
              <span>Pré-visualização (iframe oficial do Instagram)</span>
              <button onClick={() => setPreviewUrl(null)} className="hover:underline">
                Fechar
              </button>
            </div>
            <iframe
              src={previewUrl}
              className="w-full h-[480px] bg-white"
              loading="lazy"
              allow="encrypted-media"
              title="Preview Instagram"
            />
            <p className="text-xs text-muted-foreground p-2">
              Se o preview ficar em branco, o post pode ser privado, removido ou bloquear embed.
            </p>
          </div>
        )}
      </Card>

      {/* Lista com drag-and-drop */}
      <div className="space-y-3">
        <h2 className="font-medium">
          Posts cadastrados {items.length > 0 && <Badge variant="secondary">{items.length}</Badge>}
        </h2>
        {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
        {!isLoading && items.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhum post cadastrado.</p>
        )}

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {items.map((item, idx) => (
                <SortableRow
                  key={item.id}
                  item={item}
                  index={idx}
                  visibleLimit={cfg.visible_count}
                  onUpdate={handleUpdate}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>
    </div>
  );
};

export default AdminFeedInstagram;
