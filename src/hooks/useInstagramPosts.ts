import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface InstagramPost {
  id: string;
  image_url: string;
  alt_text: string;
  post_url: string | null;
  position: number;
  is_visible: boolean;
  shortcode?: string | null;
  extraction_status?: string | null;
  extraction_error?: string | null;
  last_extracted_at?: string | null;
}

export const useInstagramPosts = () =>
  useQuery({
    queryKey: ["instagram_posts", "public"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("instagram_posts")
        .select("*")
        .eq("is_visible", true)
        .order("position", { ascending: true })
        .limit(12);
      if (error) throw error;
      return (data || []) as InstagramPost[];
    },
    // Stale-while-revalidate: entrega o cache na hora e revalida em segundo plano.
    staleTime: 5 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    placeholderData: (previous) => previous,
  });

export const useAdminInstagramPosts = () =>
  useQuery({
    queryKey: ["instagram_posts", "admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("instagram_posts")
        .select("*")
        .order("position", { ascending: true });
      if (error) throw error;
      return (data || []) as InstagramPost[];
    },
  });

export const useSaveInstagramPost = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (post: Partial<InstagramPost> & { id?: string }) => {
      if (post.id) {
        const { error } = await supabase.from("instagram_posts").update(post).eq("id", post.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("instagram_posts").insert({
          image_url: post.image_url!,
          alt_text: post.alt_text || "Empório LeleCute - Instagram",
          post_url: post.post_url || null,
          position: post.position ?? 0,
          is_visible: post.is_visible ?? true,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["instagram_posts"] });
    },
  });
};

export const useDeleteInstagramPost = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("instagram_posts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["instagram_posts"] }),
  });
};
