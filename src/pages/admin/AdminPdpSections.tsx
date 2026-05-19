import { useMemo, useState, useEffect } from "react";
import { Eye, EyeOff, GripVertical, LayoutGrid, Loader2, Save } from "lucide-react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

import {
  PdpSection,
  useAdminPdpSections,
  useReorderPdpSections,
  useUpdatePdpSection,
} from "@/hooks/usePdpSections";
import { pdpSectionRegistry } from "@/lib/pdpSectionsRegistry";

interface SortableSectionCardProps {
  section: PdpSection;
  onToggle: (s: PdpSection) => void;
  onSave: (s: PdpSection, patch: { label: string; description: string }) => void;
}

const SortableSectionCard = ({ section, onToggle, onSave }: SortableSectionCardProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: section.id,
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : "auto",
    opacity: isDragging ? 0.85 : 1,
  };

  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(section.label);
  const [description, setDescription] = useState(section.description ?? "");
  useEffect(() => {
    setLabel(section.label);
    setDescription(section.description ?? "");
  }, [section.label, section.description]);

  const isRegistered = Boolean(pdpSectionRegistry[section.section_key]);

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={`border shadow-sm transition-shadow ${
        isDragging ? "shadow-xl ring-2 ring-primary/40" : ""
      } ${!section.is_visible ? "bg-muted/30" : ""}`}
    >
      <CardContent className="p-3 md:p-4 space-y-3">
        <div className="flex items-center gap-3">
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
                  <><Eye className="w-3 h-3 mr-1" /> Visível</>
                ) : (
                  <><EyeOff className="w-3 h-3 mr-1" /> Oculta</>
                )}
              </Badge>
              {!isRegistered && (
                <Badge variant="outline" className="text-xs text-amber-600 border-amber-600/40">
                  Sem renderer
                </Badge>
              )}
            </div>
            {section.description && (
              <p className="text-xs text-muted-foreground mt-1 truncate">{section.description}</p>
            )}
            <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
              {section.section_key} · pos {section.position}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={section.is_visible} onCheckedChange={() => onToggle(section)} />
            <Button size="sm" variant="ghost" onClick={() => setEditing((v) => !v)}>
              {editing ? "Fechar" : "Editar"}
            </Button>
          </div>
        </div>

        {editing && (
          <div className="grid gap-2 pl-12">
            <div>
              <Label className="text-xs">Rótulo</Label>
              <Input value={label} onChange={(e) => setLabel(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Descrição interna</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>
            <div className="flex justify-end">
              <Button size="sm" onClick={() => onSave(section, { label, description })}>
                <Save className="w-3 h-3 mr-1" /> Salvar
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const AdminPdpSections = () => {
  const { toast } = useToast();
  const { data: sections, isLoading } = useAdminPdpSections();
  const update = useUpdatePdpSection();
  const reorder = useReorderPdpSections();

  const [localOrder, setLocalOrder] = useState<PdpSection[]>([]);
  useEffect(() => {
    if (sections) setLocalOrder(sections);
  }, [sections]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const ids = useMemo(() => localOrder.map((s) => s.id), [localOrder]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = localOrder.findIndex((s) => s.id === active.id);
    const newIndex = localOrder.findIndex((s) => s.id === over.id);
    const next = arrayMove(localOrder, oldIndex, newIndex);
    setLocalOrder(next);
    reorder.mutate(
      next.map((s) => s.id),
      {
        onSuccess: () => toast({ title: "Ordem salva" }),
      }
    );
  };

  const handleToggle = (s: PdpSection) => {
    update.mutate({ id: s.id, is_visible: !s.is_visible });
  };

  const handleSave = (s: PdpSection, patch: { label: string; description: string }) => {
    update.mutate(
      { id: s.id, label: patch.label, description: patch.description },
      { onSuccess: () => toast({ title: "Seção atualizada" }) }
    );
  };

  return (
    <div className="container mx-auto max-w-4xl py-6 space-y-4">
      <div className="flex items-center gap-3">
        <LayoutGrid className="w-6 h-6 text-primary" />
        <div>
          <h1 className="font-display text-2xl text-foreground">Seções da Página de Produto</h1>
          <p className="text-sm text-muted-foreground">
            Arraste para reordenar, alterne para ocultar, edite os rótulos.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Blocos da PDP</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={ids} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {localOrder.map((s) => (
                    <SortableSectionCard
                      key={s.id}
                      section={s}
                      onToggle={handleToggle}
                      onSave={handleSave}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
          {(reorder.isPending || update.isPending) && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-3">
              <Loader2 className="w-3 h-3 animate-spin" /> Salvando…
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminPdpSections;
