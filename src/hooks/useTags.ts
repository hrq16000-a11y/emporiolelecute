import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Tag {
  id: string;
  name: string;
  slug: string;
  created_at: string;
}

export const useTags = () => {
  return useQuery({
    queryKey: ['tags'],
    queryFn: async (): Promise<Tag[]> => {
      const { data, error } = await supabase
        .from('tags')
        .select('*')
        .order('name');

      if (error) throw error;
      return data || [];
    },
  });
};

export const useProductTags = (productId: string) => {
  return useQuery({
    queryKey: ['product_tags', productId],
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from('product_tags')
        .select('tag_id')
        .eq('product_id', productId);

      if (error) throw error;
      return data?.map(pt => pt.tag_id) || [];
    },
    enabled: !!productId,
  });
};

export const useCreateTag = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (tag: { name: string; slug: string }) => {
      const { data, error } = await supabase
        .from('tags')
        .insert({ external_ref: '', ...tag })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
    },
  });
};

export const useDeleteTag = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('tags')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
    },
  });
};

export const useUpdateTag = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...tag }: { id: string; name?: string; slug?: string }) => {
      const { data, error } = await supabase
        .from('tags')
        .update(tag)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
    },
  });
};

export const useUpdateProductTags = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ productId, tagIds }: { productId: string; tagIds: string[] }) => {
      // Delete existing tags
      await supabase
        .from('product_tags')
        .delete()
        .eq('product_id', productId);

      // Insert new tags
      if (tagIds.length > 0) {
        const { error } = await supabase
          .from('product_tags')
          .insert(tagIds.map(tagId => ({ product_id: productId, tag_id: tagId })));

        if (error) throw error;
      }
    },
    onSuccess: (_, { productId }) => {
      queryClient.invalidateQueries({ queryKey: ['product_tags', productId] });
    },
  });
};
