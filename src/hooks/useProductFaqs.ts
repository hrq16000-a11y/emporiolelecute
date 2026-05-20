import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ProductFaq {
  id: string;
  product_id: string;
  question: string;
  answer: string;
  position: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const keys = {
  byProduct: (id?: string | null) => ["product_faqs", id ?? "_"] as const,
  adminByProduct: (id?: string | null) => ["product_faqs_admin", id ?? "_"] as const,
};

/** Público: somente FAQs ativas, ordenadas. */
export function useProductFaqs(productId?: string | null) {
  return useQuery({
    queryKey: keys.byProduct(productId),
    enabled: !!productId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_faqs")
        .select("*")
        .eq("product_id", productId!)
        .eq("is_active", true)
        .order("position", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ProductFaq[];
    },
    staleTime: 60_000,
  });
}

/** Admin: todas (ativas e inativas). */
export function useAdminProductFaqs(productId?: string | null) {
  return useQuery({
    queryKey: keys.adminByProduct(productId),
    enabled: !!productId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_faqs")
        .select("*")
        .eq("product_id", productId!)
        .order("position", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ProductFaq[];
    },
  });
}

export function useUpsertProductFaq() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<ProductFaq> & { product_id: string; question: string; answer: string }) => {
      if (payload.id) {
        const { error } = await supabase.from("product_faqs").update({
          question: payload.question,
          answer: payload.answer,
          position: payload.position ?? 0,
          is_active: payload.is_active ?? true,
        }).eq("id", payload.id);
        if (error) throw error;
        return payload.id;
      }
      const { data, error } = await supabase.from("product_faqs").insert({
        product_id: payload.product_id,
        question: payload.question,
        answer: payload.answer,
        position: payload.position ?? 0,
        is_active: payload.is_active ?? true,
      }).select("id").single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: (_id, vars) => {
      qc.invalidateQueries({ queryKey: keys.byProduct(vars.product_id) });
      qc.invalidateQueries({ queryKey: keys.adminByProduct(vars.product_id) });
    },
  });
}

export function useDeleteProductFaq() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; product_id: string }) => {
      const { error } = await supabase.from("product_faqs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: keys.byProduct(vars.product_id) });
      qc.invalidateQueries({ queryKey: keys.adminByProduct(vars.product_id) });
    },
  });
}

/** Gera 3 perguntas-padrão (ingredientes, durabilidade, personalização) usando dados do produto. */
export function buildAutoFaq(opts: {
  productName: string;
  productionDays?: number | null;
  personalizationEnabled?: boolean | null;
  categoryName?: string | null;
}): Array<{ question: string; answer: string }> {
  const { productName, productionDays, personalizationEnabled, categoryName } = opts;
  const isSoap = /sabonete|sabão|sabao/i.test(productName) || /sabonete/i.test(categoryName ?? "");
  const isCandle = /vela/i.test(productName) || /vela/i.test(categoryName ?? "");

  const ingredientesA = isSoap
    ? "Produzido artesanalmente com base glicerinada vegetal, óleos essenciais e corantes cosméticos seguros para a pele. Não testamos em animais."
    : isCandle
      ? "Vela artesanal feita com parafina de qualidade (ou cera vegetal sob consulta), pavio de algodão e essências importadas, com queima limpa e aroma duradouro."
      : "Produto artesanal feito sob encomenda com materiais de qualidade selecionados. Detalhes específicos de composição podem ser consultados pelo WhatsApp.";

  const durabilidade = isSoap
    ? "O sabonete dura, em média, de 3 a 5 semanas de uso diário, conservado em local seco. Mantenha a peça arejada para preservar o aroma."
    : isCandle
      ? "A vela tem queima estimada conforme o tamanho da peça. Para preservar a fragrância, mantenha em local fresco e fora da luz direta."
      : "Conservado em ambiente seco e ao abrigo da luz, o produto preserva cor, aroma e acabamento por longos meses.";

  const prazoTxt = productionDays && productionDays > 0
    ? `Pronto em até ${productionDays} dias úteis após confirmação. Para datas próximas, consulte disponibilidade pelo WhatsApp.`
    : "O prazo médio é informado por WhatsApp conforme a quantidade. Pedidos com data próxima podem ter prioridade mediante consulta.";

  const personalizacao = personalizationEnabled
    ? `Sim! O ${productName} é totalmente personalizável: nome, cor da fita, tag editorial e detalhes especiais. Alinhamos cada detalhe pelo WhatsApp antes de produzir.`
    : `Cuidamos da curadoria estética do ${productName}. Algumas adaptações são possíveis sob consulta — fale conosco pelo WhatsApp para alinhar detalhes.`;

  return [
    { question: `Quais ingredientes/materiais compõem o ${productName}?`, answer: ingredientesA },
    { question: `Qual a durabilidade e como conservar o ${productName}?`, answer: `${durabilidade} ${prazoTxt}` },
    { question: `Posso personalizar o ${productName}?`, answer: personalizacao },
  ];
}
