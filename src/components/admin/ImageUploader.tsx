import { useState, useRef } from 'react';
import { Upload, X, Loader2, Image as ImageIcon, GripVertical, Star } from 'lucide-react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, rectSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface ImageUploaderProps {
  images: string[];
  onImagesChange: (images: string[]) => void;
  maxImages?: number;
}

interface SortableImageItemProps {
  id: string;
  url: string;
  index: number;
  isMain: boolean;
  onRemove: () => void;
  isRemoving: boolean;
}

const SortableImageItem = ({ id, url, index, isMain, onRemove, isRemoving }: SortableImageItemProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative group aspect-square",
        isDragging && "opacity-50 z-50"
      )}
    >
      <div className={cn(
        "w-full h-full rounded-lg overflow-hidden bg-muted border-2 transition-all",
        isMain ? "border-primary ring-2 ring-primary/20" : "border-border"
      )}>
        {url ? (
          <img
            src={url}
            alt={`Imagem ${index + 1}`}
            className="w-full h-full object-contain p-1"
            loading="lazy"
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/placeholder.svg';
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageIcon className="w-8 h-8 text-muted-foreground" />
          </div>
        )}
      </div>
      
      {/* Main image badge */}
      {isMain && (
        <span className="absolute top-2 left-2 z-10 bg-primary text-primary-foreground text-[10px] font-medium px-2 py-1 rounded-full flex items-center gap-1">
          <Star className="w-3 h-3 fill-current" />
          Principal
        </span>
      )}
      
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        type="button"
        className="absolute top-2 right-10 z-10 p-1.5 bg-background/80 backdrop-blur-sm rounded-md opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
      >
        <GripVertical className="w-4 h-4 text-foreground" />
      </button>
      
      {/* Remove button */}
      <button
        type="button"
        onClick={onRemove}
        disabled={isRemoving}
        className="absolute top-2 right-2 z-10 p-1.5 bg-destructive text-destructive-foreground rounded-md opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
      >
        {isRemoving ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : (
          <X className="w-3 h-3" />
        )}
      </button>
      
      {/* Index badge */}
      <div className="absolute bottom-2 right-2 bg-background/80 backdrop-blur-sm text-foreground text-xs font-medium px-2 py-1 rounded-md">
        {index + 1}
      </div>
    </div>
  );
};

interface UploadEntry {
  id: string;
  name: string;
  status: 'uploading' | 'done' | 'error';
  error?: string;
}

const ImageUploader = ({ images, onImagesChange, maxImages = 8 }: ImageUploaderProps) => {
  const [uploading, setUploading] = useState(false);
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  // Feedback por arquivo durante o batch (evita sensação de "travou").
  const [uploadQueue, setUploadQueue] = useState<UploadEntry[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const validImages = images.filter(Boolean);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = validImages.indexOf(active.id as string);
      const newIndex = validImages.indexOf(over.id as string);
      const newImages = arrayMove(validImages, oldIndex, newIndex);
      onImagesChange(newImages);
      
      if (oldIndex === 0 || newIndex === 0) {
        toast({
          title: 'Imagem principal alterada',
          description: 'A primeira imagem é sempre a principal.',
        });
      }
    }
  };

  const uploadImage = async (file: File): Promise<string | null> => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `products/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('product-images')
        .getPublicUrl(filePath);

      return data.publicUrl;
    } catch (error) {
      console.error('Upload error:', error);
      return null;
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const remainingSlots = maxImages - validImages.length;
    if (remainingSlots <= 0) {
      toast({
        title: 'Limite de imagens',
        description: `Máximo de ${maxImages} imagens permitidas.`,
        variant: 'destructive',
      });
      return;
    }

    const filesToUpload = Array.from(files).slice(0, remainingSlots);

    // Inicializa fila com 1 entrada por arquivo
    const initialQueue: UploadEntry[] = filesToUpload.map((f, i) => ({
      id: `${Date.now()}-${i}-${f.name}`,
      name: f.name,
      status: 'uploading',
    }));
    setUploadQueue(initialQueue);
    setUploading(true);

    const updateEntry = (id: string, patch: Partial<UploadEntry>) =>
      setUploadQueue((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));

    const uploadedUrls: string[] = [];

    for (let i = 0; i < filesToUpload.length; i++) {
      const file = filesToUpload[i];
      const entryId = initialQueue[i].id;

      if (!file.type.startsWith('image/')) {
        updateEntry(entryId, { status: 'error', error: 'Não é uma imagem' });
        continue;
      }

      if (file.size > 5 * 1024 * 1024) {
        updateEntry(entryId, { status: 'error', error: 'Maior que 5 MB' });
        continue;
      }

      const url = await uploadImage(file);
      if (url) {
        uploadedUrls.push(url);
        updateEntry(entryId, { status: 'done' });
      } else {
        updateEntry(entryId, { status: 'error', error: 'Falha no envio' });
      }
    }

    if (uploadedUrls.length > 0) {
      const newImages = [...validImages, ...uploadedUrls];
      onImagesChange(newImages);
      toast({
        title: 'Upload concluído',
        description: `${uploadedUrls.length} imagem(ns) enviada(s).`,
      });
    }

    const failedCount = filesToUpload.length - uploadedUrls.length;
    if (failedCount > 0) {
      toast({
        title: 'Algumas imagens falharam',
        description: `${failedCount} arquivo(s) não foi(ram) enviado(s). Veja a lista abaixo.`,
        variant: 'destructive',
      });
    }

    setUploading(false);
    // Limpa a fila após 4s para dar tempo de ler o status
    setTimeout(() => setUploadQueue([]), 4000);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveImage = async (index: number) => {
    const imageUrl = validImages[index];
    
    if (imageUrl.includes('product-images')) {
      setUploadingIndex(index);
      try {
        const path = imageUrl.split('product-images/')[1];
        if (path) {
          await supabase.storage.from('product-images').remove([path]);
        }
      } catch (error) {
        console.error('Error deleting image:', error);
      }
      setUploadingIndex(null);
    }

    const newImages = validImages.filter((_, i) => i !== index);
    onImagesChange(newImages.length > 0 ? newImages : []);
  };

  const setAsMainImage = (index: number) => {
    if (index === 0) return;
    const newImages = arrayMove(validImages, index, 0);
    onImagesChange(newImages);
    toast({
      title: 'Imagem principal alterada',
      description: 'A imagem selecionada agora é a principal.',
    });
  };

  return (
    <div className="space-y-4">
      {/* Upload area */}
      <div
        onClick={() => !uploading && fileInputRef.current?.click()}
        className={cn(
          "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors",
          "hover:border-primary hover:bg-primary/5",
          uploading && "opacity-50 cursor-not-allowed"
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileSelect}
          className="hidden"
          disabled={uploading}
        />
        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">Enviando imagens...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Upload className="w-8 h-8 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">
              Clique para fazer upload ou arraste arquivos
            </p>
            <p className="text-xs text-muted-foreground">
              PNG, JPG ou WEBP (máx. 5MB cada) • Até {maxImages} imagens
            </p>
          </div>
        )}
      </div>

      {/* Fila de uploads — status por arquivo */}
      {uploadQueue.length > 0 && (
        <ul className="space-y-1 text-sm">
          {uploadQueue.map((e) => (
            <li
              key={e.id}
              className={cn(
                "flex items-center gap-2 rounded-md border border-border px-3 py-2",
                e.status === 'done' && "bg-green-50 border-green-200 text-green-800",
                e.status === 'error' && "bg-destructive/10 border-destructive/30 text-destructive",
                e.status === 'uploading' && "bg-muted/50"
              )}
            >
              {e.status === 'uploading' && <Loader2 className="w-4 h-4 animate-spin shrink-0" />}
              {e.status === 'done' && <span className="w-4 h-4 shrink-0 text-center">✓</span>}
              {e.status === 'error' && <X className="w-4 h-4 shrink-0" />}
              <span className="truncate flex-1">{e.name}</span>
              {e.status === 'uploading' && <span className="text-xs text-muted-foreground">Enviando…</span>}
              {e.status === 'done' && <span className="text-xs">Enviado</span>}
              {e.status === 'error' && <span className="text-xs">{e.error ?? 'Erro'}</span>}
            </li>
          ))}
        </ul>
      )}


      {/* Instructions */}
      {validImages.length > 0 && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
          <GripVertical className="w-4 h-4" />
          <span>Arraste as imagens para reordenar. A primeira imagem será a principal do produto.</span>
        </div>
      )}

      {/* Draggable image grid */}
      {validImages.length > 0 && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={validImages} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {validImages.map((url, index) => (
                <div key={url} className="relative">
                  <SortableImageItem
                    id={url}
                    url={url}
                    index={index}
                    isMain={index === 0}
                    onRemove={() => handleRemoveImage(index)}
                    isRemoving={uploadingIndex === index}
                  />
                  {/* Set as main button - only show for non-main images */}
                  {index !== 0 && (
                    <button
                      type="button"
                      onClick={() => setAsMainImage(index)}
                      className="absolute bottom-2 left-2 z-10 bg-background/80 backdrop-blur-sm text-foreground text-[10px] font-medium px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-primary hover:text-primary-foreground transition-all flex items-center gap-1"
                    >
                      <Star className="w-3 h-3" />
                      Tornar principal
                    </button>
                  )}
                </div>
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Empty state */}
      {validImages.length === 0 && (
        <div className="text-center py-4 text-sm text-muted-foreground">
          Nenhuma imagem adicionada ainda.
        </div>
      )}
    </div>
  );
};

export default ImageUploader;
