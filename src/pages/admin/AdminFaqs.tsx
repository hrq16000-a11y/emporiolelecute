import { useState } from 'react';
import { useAdminFaqs, useCreateFaq, useUpdateFaq, useDeleteFaq, useReorderFaqs } from '@/hooks/useFaqs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { 
  Plus, 
  Pencil, 
  Trash2, 
  HelpCircle, 
  GripVertical,
  Eye,
  EyeOff,
  MessageSquare
} from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';

interface FAQ {
  id: string;
  question: string;
  answer: string;
  position: number;
  is_visible: boolean;
}

interface SortableFaqItemProps {
  faq: FAQ;
  onEdit: (faq: FAQ) => void;
  onDelete: (faq: FAQ) => void;
  onToggleVisibility: (faq: FAQ) => void;
}

const SortableFaqItem = ({ faq, onEdit, onDelete, onToggleVisibility }: SortableFaqItemProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: faq.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "bg-card border border-border rounded-xl p-4 flex items-start gap-4 transition-all",
        isDragging && "opacity-50 shadow-lg z-50",
        !faq.is_visible && "opacity-60"
      )}
    >
      <button
        {...attributes}
        {...listeners}
        className="mt-1 p-1 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
      >
        <GripVertical className="w-5 h-5" />
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-4 mb-2">
          <h3 className="font-semibold text-foreground line-clamp-2">
            {faq.question}
          </h3>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => onToggleVisibility(faq)}
              className={cn(
                "p-2 rounded-lg transition-colors",
                faq.is_visible 
                  ? "text-green-600 hover:bg-green-50" 
                  : "text-muted-foreground hover:bg-muted"
              )}
              title={faq.is_visible ? "Visível" : "Oculto"}
            >
              {faq.is_visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            </button>
            <button
              onClick={() => onEdit(faq)}
              className="p-2 rounded-lg text-primary hover:bg-primary/10 transition-colors"
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              onClick={() => onDelete(faq)}
              className="p-2 rounded-lg text-destructive hover:bg-destructive/10 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
        <p className="text-sm text-muted-foreground line-clamp-3">
          {faq.answer}
        </p>
      </div>
    </div>
  );
};

const AdminFaqs = () => {
  const { data: faqs, isLoading } = useAdminFaqs();
  const createFaq = useCreateFaq();
  const updateFaq = useUpdateFaq();
  const deleteFaq = useDeleteFaq();
  const reorderFaqs = useReorderFaqs();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingFaq, setEditingFaq] = useState<FAQ | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<FAQ | null>(null);
  
  const [formData, setFormData] = useState({
    question: '',
    answer: '',
    is_visible: true,
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleOpenForm = (faq?: FAQ) => {
    if (faq) {
      setEditingFaq(faq);
      setFormData({
        question: faq.question,
        answer: faq.answer,
        is_visible: faq.is_visible,
      });
    } else {
      setEditingFaq(null);
      setFormData({
        question: '',
        answer: '',
        is_visible: true,
      });
    }
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingFaq(null);
    setFormData({
      question: '',
      answer: '',
      is_visible: true,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingFaq) {
      await updateFaq.mutateAsync({
        id: editingFaq.id,
        ...formData,
      });
    } else {
      const maxPosition = faqs?.reduce((max, f) => Math.max(max, f.position), 0) || 0;
      await createFaq.mutateAsync({
        ...formData,
        position: maxPosition + 1,
      });
    }
    
    handleCloseForm();
  };

  const handleDelete = async () => {
    if (deleteConfirm) {
      await deleteFaq.mutateAsync(deleteConfirm.id);
      setDeleteConfirm(null);
    }
  };

  const handleToggleVisibility = async (faq: FAQ) => {
    await updateFaq.mutateAsync({
      id: faq.id,
      is_visible: !faq.is_visible,
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id && faqs) {
      const oldIndex = faqs.findIndex((f) => f.id === active.id);
      const newIndex = faqs.findIndex((f) => f.id === over.id);
      
      const newOrder = arrayMove(faqs, oldIndex, newIndex);
      const updates = newOrder.map((faq, index) => ({
        id: faq.id,
        position: index + 1,
      }));
      
      reorderFaqs.mutate(updates);
    }
  };

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/4" />
          <div className="h-24 bg-muted rounded" />
          <div className="h-24 bg-muted rounded" />
          <div className="h-24 bg-muted rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground flex items-center gap-3">
            <HelpCircle className="w-8 h-8 text-primary" />
            Perguntas Frequentes
          </h1>
          <p className="text-muted-foreground mt-1">
            Gerencie as perguntas e respostas do FAQ
          </p>
        </div>
        <Button onClick={() => handleOpenForm()} className="gap-2">
          <Plus className="w-4 h-4" />
          Nova Pergunta
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{faqs?.length || 0}</p>
                <p className="text-sm text-muted-foreground">Total de FAQs</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                <Eye className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{faqs?.filter(f => f.is_visible).length || 0}</p>
                <p className="text-sm text-muted-foreground">Visíveis</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                <EyeOff className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{faqs?.filter(f => !f.is_visible).length || 0}</p>
                <p className="text-sm text-muted-foreground">Ocultos</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* FAQ List */}
      {faqs && faqs.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Lista de Perguntas</CardTitle>
            <p className="text-sm text-muted-foreground">
              Arraste para reordenar as perguntas
            </p>
          </CardHeader>
          <CardContent>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={faqs.map(f => f.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-3">
                  {faqs.map((faq) => (
                    <SortableFaqItem
                      key={faq.id}
                      faq={faq}
                      onEdit={handleOpenForm}
                      onDelete={setDeleteConfirm}
                      onToggleVisibility={handleToggleVisibility}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-12 text-center">
            <HelpCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhuma FAQ cadastrada</h3>
            <p className="text-muted-foreground mb-4">
              Adicione perguntas frequentes para ajudar seus clientes.
            </p>
            <Button onClick={() => handleOpenForm()} className="gap-2">
              <Plus className="w-4 h-4" />
              Criar primeira FAQ
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Form Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingFaq ? 'Editar Pergunta' : 'Nova Pergunta'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="question">Pergunta</Label>
              <Input
                id="question"
                value={formData.question}
                onChange={(e) => setFormData({ ...formData, question: e.target.value })}
                placeholder="Ex: Qual é o prazo de entrega?"
                required
              />
            </div>
            <div>
              <Label htmlFor="answer">Resposta</Label>
              <Textarea
                id="answer"
                value={formData.answer}
                onChange={(e) => setFormData({ ...formData, answer: e.target.value })}
                placeholder="Escreva a resposta completa..."
                rows={5}
                required
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="is_visible">Visível no site</Label>
              <Switch
                id="is_visible"
                checked={formData.is_visible}
                onCheckedChange={(checked) => setFormData({ ...formData, is_visible: checked })}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseForm}>
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={createFaq.isPending || updateFaq.isPending}
              >
                {editingFaq ? 'Salvar' : 'Criar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir FAQ?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta pergunta? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminFaqs;
