import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Activity } from 'lucide-react';
import TaxonomyManager from '@/components/admin/TaxonomyManager';
import { TaxonomyEntity, TaxonomyKind } from '@/lib/taxonomy';
import {
  useDbCategories, useDbOccasions,
  useCreateCategory, useUpdateCategory, useDeleteCategory,
  useCreateOccasion, useUpdateOccasion, useDeleteOccasion,
} from '@/hooks/useProducts';
import {
  useSegments, useCreateSegment, useUpdateSegment, useDeleteSegment,
} from '@/hooks/useSegments';
import { useTags, useCreateTag, useUpdateTag, useDeleteTag } from '@/hooks/useTags';
import { supabase } from '@/integrations/supabase/client';

const AdminTaxonomies = () => {
  const cats = useDbCategories();
  const occs = useDbOccasions();
  const segs = useSegments();
  const tagsQ = useTags();

  const createCat = useCreateCategory(); const updCat = useUpdateCategory(); const delCat = useDeleteCategory();
  const createOcc = useCreateOccasion(); const updOcc = useUpdateOccasion(); const delOcc = useDeleteOccasion();
  const createSeg = useCreateSegment(); const updSeg = useUpdateSegment(); const delSeg = useDeleteSegment();
  const createTag = useCreateTag(); const updTag = useUpdateTag(); const delTag = useDeleteTag();

  const slugsByKind: Record<TaxonomyKind, Map<string, string>> = useMemo(() => {
    const build = (arr: { name: string; slug: string }[] = []) =>
      new Map(arr.map((x) => [x.slug, x.name]));
    return {
      categoria: build(cats.data ?? []),
      ocasiao:   build(occs.data ?? []),
      segmento:  build(segs.data ?? []),
      tag:       build(tagsQ.data ?? []),
    };
  }, [cats.data, occs.data, segs.data, tagsQ.data]);

  // The hooks for categories/occasions are typed narrowly; bypass with a generic update via supabase.
  const updateCategoryGeneric = async (id: string, values: Partial<TaxonomyEntity>) => {
    const { error } = await supabase.from('categories').update(values).eq('id', id);
    if (error) throw error;
    await cats.refetch();
  };
  const createCategoryGeneric = async (values: Partial<TaxonomyEntity>) => {
    const { error } = await supabase.from('categories').insert(values as never);
    if (error) throw error;
    await cats.refetch();
  };
  const updateOccasionGeneric = async (id: string, values: Partial<TaxonomyEntity>) => {
    const { error } = await supabase.from('occasions').update(values).eq('id', id);
    if (error) throw error;
    await occs.refetch();
  };
  const createOccasionGeneric = async (values: Partial<TaxonomyEntity>) => {
    const { error } = await supabase.from('occasions').insert(values as never);
    if (error) throw error;
    await occs.refetch();
  };

  // Suppress unused-warnings for the original hooks (kept for compat; not used directly here)
  void createCat; void updCat; void createOcc; void updOcc;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-6xl">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-semibold text-foreground">Taxonomias</h1>
          <p className="text-muted-foreground mt-1">
            Centro unificado para gerenciar categorias, ocasiões, segmentos e tags.
          </p>
        </div>
        <Link to="/admin/taxonomias/health">
          <Button variant="outline"><Activity className="w-4 h-4 mr-2" /> Healthcheck</Button>
        </Link>
      </div>

      <Tabs defaultValue="categoria" className="space-y-4">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="categoria">Categorias</TabsTrigger>
          <TabsTrigger value="ocasiao">Ocasiões</TabsTrigger>
          <TabsTrigger value="segmento">Segmentos</TabsTrigger>
          <TabsTrigger value="tag">Tags</TabsTrigger>
        </TabsList>

        <TabsContent value="categoria">
          <TaxonomyManager
            kind="categoria"
            items={(cats.data ?? []) as TaxonomyEntity[]}
            isLoading={cats.isLoading}
            existingSlugsByKind={slugsByKind}
            onCreate={createCategoryGeneric}
            onUpdate={updateCategoryGeneric}
            onDelete={(id) => delCat.mutateAsync(id)}
          />
        </TabsContent>
        <TabsContent value="ocasiao">
          <TaxonomyManager
            kind="ocasiao"
            items={(occs.data ?? []) as TaxonomyEntity[]}
            isLoading={occs.isLoading}
            existingSlugsByKind={slugsByKind}
            onCreate={createOccasionGeneric}
            onUpdate={updateOccasionGeneric}
            onDelete={(id) => delOcc.mutateAsync(id)}
          />
        </TabsContent>
        <TabsContent value="segmento">
          <TaxonomyManager
            kind="segmento"
            items={(segs.data ?? []) as TaxonomyEntity[]}
            isLoading={segs.isLoading}
            existingSlugsByKind={slugsByKind}
            onCreate={(v) => createSeg.mutateAsync(v as { name: string; slug: string })}
            onUpdate={(id, v) => updSeg.mutateAsync({ id, ...v })}
            onDelete={(id) => delSeg.mutateAsync(id)}
          />
        </TabsContent>
        <TabsContent value="tag">
          <TaxonomyManager
            kind="tag"
            items={(tagsQ.data ?? []) as TaxonomyEntity[]}
            isLoading={tagsQ.isLoading}
            showSeo={false}
            existingSlugsByKind={slugsByKind}
            onCreate={(v) => createTag.mutateAsync({ name: v.name!, slug: v.slug! })}
            onUpdate={(id, v) => updTag.mutateAsync({ id, name: v.name, slug: v.slug })}
            onDelete={(id) => delTag.mutateAsync(id)}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminTaxonomies;
