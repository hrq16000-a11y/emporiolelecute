import { Suspense, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Eye,
  EyeOff,
  GripVertical,
  History,
  LayoutGrid,
  Loader2,
  Pencil,
  Save,
  Settings,
  ArrowUpRight,
  Info,
} from "lucide-react";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";

import {
  HomeSection,
  useAdminHomeSections,
  useHomeSectionAudit,
  useReorderHomeSections,
  useUpdateHomeSection,
} from "@/hooks/useHomeSections";
import { HOME_SECTIONS_REGISTRY } from "@/lib/homeSectionsRegistry";
import {
  buildSectionDestinationPath,
  getSectionDestination,
} from "@/lib/homeSectionsDestinations";

// =====================================================================
// Card sortable
// =====================================================================
interface SortableSectionCardProps {
  section: HomeSection;
  onToggle: (s: HomeSection) => void;
  onEdit: (s: HomeSection) => void;
  onPreview: (s: HomeSection) => void;
  onConfigure: (s: HomeSection) => void;
}

const SortableSectionCard = ({
  section,
  onToggle,
  onEdit,
  onPreview,
  onConfigure,
}: SortableSectionCardProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: section.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : "auto",
    opacity: isDragging ? 0.85 : 1,
  };

  const isRegistered = Boolean(HOME_SECTIONS_REGISTRY[section.component_name]);
  const destination = getSectionDestination(section.component_name);
  const hasDestination = Boolean(destination.route);

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={`border shadow-sm transition-shadow ${
        isDragging ? "shadow-xl ring-2 ring-primary/40" : ""
      } ${!section.is_visible ? "bg-muted/30" : ""}`}
    >
      <CardContent className="flex items-center gap-3 p-3 md:p-4">
        <button
          type="button"
          className="cursor-grab active:cursor-grabbing p-2 rounded hover:bg-muted text-muted-foreground"
          aria-label="Arrastar para reordenar"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="w-5 h-5" />
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-foreground truncate">{section.label}</h3>
            <Badge variant={section.is_visible ? "default" : "secondary"} className="text-xs">
              {section.is_visible ? (
                <>
                  <Eye className="w-3 h-3 mr-1" /> Visível
                </>
              ) : (
                <>
                  <EyeOff className="w-3 h-3 mr-1" /> Oculta
                </>
              )}
            </Badge>
            {!isRegistered && (
              <Badge variant="destructive" className="text-xs">
                componente não registrado
              </Badge>
            )}
            {destination.type === "indirect" && (
              <Badge variant="outline" className="text-xs gap-1">
                <Info className="w-3 h-3" /> Controle indireto
              </Badge>
            )}
            {destination.type === "unavailable" && (
              <Badge variant="secondary" className="text-xs">
                Configuração indisponível
              </Badge>
            )}
          </div>
          {section.description && (
            <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
              {section.description}
            </p>
          )}
          <p className="text-[11px] text-muted-foreground/70 mt-1 font-mono">
            {section.section_key} · {section.component_name} · pos {section.position}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Switch
            checked={section.is_visible}
            onCheckedChange={() => onToggle(section)}
            aria-label={section.is_visible ? "Ocultar seção" : "Exibir seção"}
          />
          <Tooltip>
            <TooltipTrigger asChild>
              {hasDestination ? (
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => onConfigure(section)}
                  aria-label="Configurar conteúdo"
                  className="text-primary hover:text-primary hover:bg-primary/10"
                >
                  <Settings className="w-4 h-4" />
                </Button>
              ) : (
                <Button
                  size="icon"
                  variant="ghost"
                  disabled
                  aria-label="Configuração indisponível"
                  className="opacity-50 cursor-not-allowed"
                >
                  <Settings className="w-4 h-4" />
                </Button>
              )}
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[220px] text-xs">
              {hasDestination ? (
                <span className="flex items-center gap-1">
                  <ArrowUpRight className="w-3 h-3 shrink-0" />
                  Configurar conteúdo · {destination.label}
                </span>
              ) : (
                <span>{destination.hint ?? "Configuração indisponível"}</span>
              )}
              {hasDestination && destination.hint && (
                <span className="block mt-1 text-muted-foreground">{destination.hint}</span>
              )}
            </TooltipContent>
          </Tooltip>
          <Button size="icon" variant="ghost" onClick={() => onPreview(section)} title="Prévia">
            <Eye className="w-4 h-4" />
          </Button>
          <Button size="icon" variant="ghost" onClick={() => onEdit(section)} title="Editar">
            <Pencil className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

// =====================================================================
// Painel de prévia ao vivo
// =====================================================================
const PreviewPanel = ({ section }: { section: HomeSection | null }) => {
  if (!section) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        Selecione uma seção para visualizar a prévia.
      </div>
    );
  }

  const Component = HOME_SECTIONS_REGISTRY[section.component_name];
  if (!Component) {
    return (
      <div className="p-4 sm:p-6 text-sm text-destructive">
        Componente <code>{section.component_name}</code> não está registrado em{" "}
        <code>homeSectionsRegistry.ts</code>.
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-background overflow-hidden">
      <div className="border-b bg-muted/40 px-4 py-2 text-xs text-muted-foreground flex items-center justify-between">
        <span>
          Prévia ao vivo · <span className="font-mono">{section.section_key}</span>
        </span>
        <span>{section.is_visible ? "exibindo como visível" : "atualmente oculta na home"}</span>
      </div>
      <div className="overflow-x-hidden">
        <Suspense
          fallback={
            <div className="p-8 flex justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          }
        >
          <Component {...(section.editable_props || {})} />
        </Suspense>
      </div>
    </div>
  );
};

// =====================================================================
// Diff helpers para o histórico
// =====================================================================
const formatJson = (value: unknown) => {
  if (value === null || value === undefined) return "—";
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const actionLabels: Record<string, string> = {
  visibility_changed: "Visibilidade alterada",
  reordered: "Reordenada",
  edited: "Editada",
  created: "Criada",
  deleted: "Removida",
};

// =====================================================================
// Editor dinâmico de editable_props
// =====================================================================
/** Rótulos amigáveis (PT-BR) para chaves conhecidas. Chaves desconhecidas usam a própria key. */
const PROP_LABELS: Record<string, string> = {
  title: "Título",
  subtitle: "Subtítulo",
  cta: "Texto do botão (CTA)",
  ctaPath: "Link do botão",
  maxItems: "Máximo de itens",
  bundleType: "Tipo de kit",
};

/** Opções fixas conhecidas para bundleType (preserva valores fora da lista). */
const BUNDLE_TYPE_OPTIONS = [
  { value: "suggested", label: "Sugerido" },
  { value: "curated", label: "Curado" },
  { value: "premium", label: "Premium" },
];

const getBundleOptions = (current: unknown) => {
  const opts = [...BUNDLE_TYPE_OPTIONS];
  if (typeof current === "string" && current && !opts.some((o) => o.value === current)) {
    opts.push({ value: current, label: current });
  }
  return opts;
};

/** Campos de texto longo recebem Textarea; demais recebem Input. */
const MULTILINE_KEYS = new Set(["subtitle", "description"]);


const AdminHomeSections = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { data: sections, isLoading } = useAdminHomeSections();
  const { data: audit } = useHomeSectionAudit();
  const updateMut = useUpdateHomeSection();
  const reorderMut = useReorderHomeSections();

  const handleConfigure = (s: HomeSection) => {
    const path = buildSectionDestinationPath(s.component_name);
    if (!path) {
      toast({
        title: "Configuração indisponível",
        description: "Esta seção não possui um módulo de configuração no painel.",
      });
      return;
    }
    navigate(path);
  };

  const [previewSection, setPreviewSection] = useState<HomeSection | null>(null);
  const [editing, setEditing] = useState<HomeSection | null>(null);
  const [editForm, setEditForm] = useState<Pick<HomeSection, "label" | "description">>({
    label: "",
    description: "",
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const ids = useMemo(() => (sections || []).map((s) => s.id), [sections]);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !sections) return;
    const oldIdx = sections.findIndex((s) => s.id === active.id);
    const newIdx = sections.findIndex((s) => s.id === over.id);
    if (oldIdx === -1 || newIdx === -1) return;
    const reordered = arrayMove(sections, oldIdx, newIdx);
    await reorderMut.mutateAsync(reordered.map((s) => s.id));
    toast({ title: "Ordem atualizada" });
  };

  const handleToggle = async (s: HomeSection) => {
    await updateMut.mutateAsync({ id: s.id, is_visible: !s.is_visible });
    toast({ title: s.is_visible ? "Seção ocultada" : "Seção exibida" });
  };

  const openEdit = (s: HomeSection) => {
    setEditing(s);
    setEditForm({ label: s.label, description: s.description || "" });
  };

  const saveEdit = async () => {
    if (!editing) return;
    await updateMut.mutateAsync({
      id: editing.id,
      label: editForm.label.trim() || editing.label,
      description: editForm.description.trim() || null,
    });
    toast({ title: "Seção atualizada" });
    setEditing(null);
  };

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1 text-primary">
            <LayoutGrid className="w-5 h-5" />
            <span className="text-sm font-medium">CMS</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-display font-semibold">Seções da Home</h1>
          <p className="text-muted-foreground mt-1 max-w-2xl">
            Controle a visibilidade, a ordem e o conteúdo de cada seção exibida na página inicial.
            Arraste para reordenar.
          </p>
        </div>
      </header>

      <Tabs defaultValue="sections" className="space-y-6">
        <TabsList>
          <TabsTrigger value="sections">
            <LayoutGrid className="w-4 h-4 mr-2" /> Seções
          </TabsTrigger>
          <TabsTrigger value="history">
            <History className="w-4 h-4 mr-2" /> Histórico
          </TabsTrigger>
        </TabsList>

        {/* ============== ABA SEÇÕES ============== */}
        <TabsContent value="sections" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-6">
            {/* Lista sortable */}
            <div className="space-y-2">
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 rounded-lg" />
                ))
              ) : sections && sections.length > 0 ? (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext items={ids} strategy={verticalListSortingStrategy}>
                    {sections.map((s) => (
                      <SortableSectionCard
                        key={s.id}
                        section={s}
                        onToggle={handleToggle}
                        onEdit={openEdit}
                        onPreview={setPreviewSection}
                        onConfigure={handleConfigure}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhuma seção cadastrada.</p>
              )}
            </div>

            {/* Prévia */}
            <div className="lg:sticky lg:top-4 lg:self-start space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-foreground">Prévia ao vivo</h2>
                {previewSection && (
                  <Button variant="ghost" size="sm" onClick={() => setPreviewSection(null)}>
                    Fechar
                  </Button>
                )}
              </div>
              <PreviewPanel section={previewSection} />
            </div>
          </div>
        </TabsContent>

        {/* ============== ABA HISTÓRICO ============== */}
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Histórico de alterações</CardTitle>
            </CardHeader>
            <CardContent>
              {!audit || audit.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhuma alteração registrada ainda.
                </p>
              ) : (
                <ScrollArea className="h-[60vh] pr-3">
                  <ul className="space-y-3">
                    {audit.map((entry) => (
                      <li
                        key={entry.id}
                        className="border rounded-lg p-3 text-sm flex flex-col gap-1 bg-card"
                      >
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{actionLabels[entry.action] ?? entry.action}</Badge>
                            <span className="font-mono text-xs text-muted-foreground">
                              {entry.section_key}
                            </span>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {new Date(entry.created_at).toLocaleString("pt-BR")}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          por <span className="font-medium">{entry.changed_by_email || "sistema"}</span>
                        </div>
                        <div className="text-xs font-mono break-all">
                          <span className="text-muted-foreground">antes:</span>{" "}
                          {formatJson(entry.old_value)}
                          <br />
                          <span className="text-muted-foreground">depois:</span>{" "}
                          {formatJson(entry.new_value)}
                        </div>
                      </li>
                    ))}
                  </ul>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ============== DIALOG EDITAR ============== */}
      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar seção</DialogTitle>
            <DialogDescription>
              Alterações no rótulo e descrição são apenas internas ao painel.
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Rótulo (admin)</Label>
                <Input
                  value={editForm.label}
                  onChange={(e) => setEditForm((f) => ({ ...f, label: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea
                  rows={3}
                  value={editForm.description}
                  onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                />
              </div>
              <div className="text-xs text-muted-foreground font-mono">
                section_key: {editing.section_key} · component: {editing.component_name}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button onClick={saveEdit} disabled={updateMut.isPending}>
              {updateMut.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminHomeSections;
