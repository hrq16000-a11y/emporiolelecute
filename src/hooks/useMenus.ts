import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface MenuItem {
  id: string;
  menu_location: 'header' | 'footer';
  label: string;
  url: string | null;
  page_id: string | null;
  parent_id: string | null;
  position: number;
  is_external: boolean;
  is_visible: boolean;
  created_at: string;
}

export const useMenuItems = (location?: 'header' | 'footer') => {
  return useQuery({
    queryKey: ['menu_items', location],
    queryFn: async (): Promise<MenuItem[]> => {
      let query = supabase
        .from('menu_items')
        .select('*')
        .order('position');

      if (location) {
        query = query.eq('menu_location', location);
      }

      const { data, error } = await query;

      if (error) throw error;
      return (data || []) as MenuItem[];
    },
    placeholderData: [] as MenuItem[],
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 60,
  });
};

export const useCreateMenuItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (item: Omit<MenuItem, 'id' | 'created_at'>) => {
      const { data, error } = await supabase
        .from('menu_items')
        .insert([item])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu_items'] });
    },
  });
};

export const useUpdateMenuItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...item }: Partial<MenuItem> & { id: string }) => {
      const { data, error } = await supabase
        .from('menu_items')
        .update(item)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu_items'] });
    },
  });
};

export const useDeleteMenuItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('menu_items')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu_items'] });
    },
  });
};

export const useReorderMenuItems = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (items: { id: string; position: number }[]) => {
      for (const item of items) {
        const { error } = await supabase
          .from('menu_items')
          .update({ position: item.position })
          .eq('id', item.id);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu_items'] });
    },
  });
};
