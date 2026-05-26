import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

const KEY = "conversion_cta_config";

export interface StickyCtaConfig {
  enabled: boolean;
  buttonLabel: string;
  /** Threshold proporcional à viewport (0–1). Fallback se IntersectionObserver não disparar. */
  scrollViewportRatio: number;
}

export interface QuickSummaryConfig {
  enabled: boolean;
  title: string;
  minLabel: string;
  prazoLabel: string;
  shippingLabel: string;
  shippingValue: string;
  ctaLabel: string;
}

export interface ExitPopupConfig {
  enabled: boolean;
  title: string;
  description: string;
  ctaLabel: string;
  dismissLabel: string;
  /** Máximo de exibições por sessão. */
  maxPerSession: number;
  /** Tempo mínimo (min) entre exibições. */
  cooldownMinutes: number;
  /** Atraso (ms) antes de armar o gatilho. */
  armDelayMs: number;
}

export interface WhatsAppTemplateConfig {
  /**
   * Template com placeholders: {produto} {qtd} {personalizacao} {preco} {link} {categoria} {ocasiao} {imagem}
   * Personalização e contexto são opcionais — linhas vazias são removidas.
   */
  template: string;
}

export interface ToastConfig {
  enabled: boolean;
  message: string;
  durationMs: number;
}

export type PdpBadgeTone = "blue" | "coral" | "green" | "amber" | "neutral";
export type PdpBadgePosition = "top-left" | "top-right" | "bottom-left" | "bottom-right";

export interface PdpBadgeConfig {
  enabled: boolean;
  label: string;
  /** Mostra o ícone de caminhão à esquerda do texto. */
  showIcon: boolean;
  tone: PdpBadgeTone;
  position: PdpBadgePosition;
  /** Distância horizontal da borda (px). */
  offsetX: number;
  /** Distância vertical da borda (px). */
  offsetY: number;
}

/** Variante visual do botão CTA inline (dentro do bloco de descrição da PDP). */
export type InlineCtaVariant = "dark" | "primary" | "whatsapp" | "outline";

export interface InlineCtaConfig {
  /** Renderiza o botão dentro do bloco de descrição da PDP. */
  enabled: boolean;
  /** Texto do botão. */
  label: string;
  /** Mostra o ícone do WhatsApp à esquerda do texto. */
  showIcon: boolean;
  /** Estilo visual do botão. */
  variant: InlineCtaVariant;
}

export interface ConversionCtaConfig {
  sticky: StickyCtaConfig;
  quickSummary: QuickSummaryConfig;
  exitPopup: ExitPopupConfig;
  whatsappTemplate: WhatsAppTemplateConfig;
  toast: ToastConfig;
  pdpBadge: PdpBadgeConfig;
  inlineCta: InlineCtaConfig;
}

export const DEFAULT_CONVERSION_CTA: ConversionCtaConfig = {
  sticky: {
    enabled: true,
    buttonLabel: "WhatsApp",
    scrollViewportRatio: 0.7,
  },
  quickSummary: {
    enabled: true,
    title: "Resumo do pedido",
    minLabel: "Mínimo",
    prazoLabel: "Prazo",
    shippingLabel: "Envio",
    shippingValue: "Brasil",
    ctaLabel: "Conversar no WhatsApp",
  },
  exitPopup: {
    enabled: true,
    title: "Antes de sair",
    description:
      "Posso te orientar pelo WhatsApp — sobre prazos, personalização e o que faz sentido para a sua ocasião.",
    ctaLabel: "Falar no WhatsApp",
    dismissLabel: "Continuar navegando",
    maxPerSession: 1,
    cooldownMinutes: 30,
    armDelayMs: 8000,
  },
  whatsappTemplate: {
    template:
      "Oi, aqui é da LeleCute. Vi seu interesse em *{produto}*.{contexto}\n\nQuantidade pensada: {qtd} unidades.\n{personalizacao_linha}Link: {link}{imagem_linha}\n\nMe conta um pouco da ocasião para eu te orientar melhor.",
  },
  toast: {
    enabled: true,
    message: "Abrindo a conversa no WhatsApp.",
    durationMs: 4000,
  },
  pdpBadge: {
    enabled: false,
    label: "Frete reduzido",
    showIcon: true,
    tone: "blue",
    position: "top-left",
    offsetX: 12,
    offsetY: 12,
  },
  inlineCta: {
    enabled: true,
    label: "Fazer Orçamento no WhatsApp",
    showIcon: true,
    variant: "dark",
  },
};

function mergeConfig(raw: any): ConversionCtaConfig {
  const r = (raw || {}) as Partial<ConversionCtaConfig>;
  return {
    sticky: { ...DEFAULT_CONVERSION_CTA.sticky, ...(r.sticky || {}) },
    quickSummary: { ...DEFAULT_CONVERSION_CTA.quickSummary, ...(r.quickSummary || {}) },
    exitPopup: { ...DEFAULT_CONVERSION_CTA.exitPopup, ...(r.exitPopup || {}) },
    whatsappTemplate: { ...DEFAULT_CONVERSION_CTA.whatsappTemplate, ...(r.whatsappTemplate || {}) },
    toast: { ...DEFAULT_CONVERSION_CTA.toast, ...(r.toast || {}) },
    pdpBadge: { ...DEFAULT_CONVERSION_CTA.pdpBadge, ...(r.pdpBadge || {}) },
    inlineCta: { ...DEFAULT_CONVERSION_CTA.inlineCta, ...(r.inlineCta || {}) },
  };
}

export const useConversionCtaConfig = () =>
  useQuery({
    queryKey: ["store_settings", KEY],
    placeholderData: DEFAULT_CONVERSION_CTA,
    staleTime: 10 * 60_000,
    gcTime: 60 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_settings")
        .select("value")
        .eq("key", KEY)
        .maybeSingle();
      if (error) throw error;
      return mergeConfig(data?.value);
    },
  });

// -------------------- Zod schema (validação robusta) --------------------
// Aplicado antes de gravar — rejeita payloads que poderiam quebrar o template
// do WhatsApp ou as regras do popup.
const stickySchema = z.object({
  enabled: z.boolean(),
  buttonLabel: z.string().trim().min(1, "Texto do botão obrigatório").max(40),
  scrollViewportRatio: z.coerce.number().min(0.1).max(1),
});

const quickSummarySchema = z.object({
  enabled: z.boolean(),
  title: z.string().trim().min(1).max(80),
  minLabel: z.string().trim().min(1).max(20),
  prazoLabel: z.string().trim().min(1).max(20),
  shippingLabel: z.string().trim().min(1).max(20),
  shippingValue: z.string().trim().min(1).max(40),
  ctaLabel: z.string().trim().min(1).max(60),
});

const exitPopupSchema = z.object({
  enabled: z.boolean(),
  title: z.string().trim().min(1).max(100),
  description: z.string().trim().min(1).max(400),
  ctaLabel: z.string().trim().min(1).max(60),
  dismissLabel: z.string().trim().min(1).max(60),
  maxPerSession: z.coerce.number().int().min(1).max(5),
  cooldownMinutes: z.coerce.number().int().min(1).max(720),
  armDelayMs: z.coerce.number().int().min(0).max(60_000),
});

// Placeholders permitidos no template (qualquer outro vira literal, mas avisamos)
const ALLOWED_PLACEHOLDERS = new Set([
  "produto", "qtd", "preco", "link", "imagem",
  "categoria", "ocasiao", "segmento", "contexto",
  "personalizacao", "personalizacao_linha", "imagem_linha",
]);

const whatsappTemplateSchema = z.object({
  template: z
    .string()
    .min(20, "Template muito curto")
    .max(2000, "Template muito longo")
    .refine((t) => /\{produto\}/.test(t), "Template deve conter {produto}")
    .refine((t) => /\{qtd\}/.test(t), "Template deve conter {qtd}")
    .refine((t) => /\{link\}/.test(t), "Template deve conter {link}")
    .refine((t) => {
      // Nenhum placeholder desconhecido
      const used = Array.from(t.matchAll(/\{(\w+)\}/g)).map((m) => m[1]);
      return used.every((p) => ALLOWED_PLACEHOLDERS.has(p));
    }, "Template contém placeholder desconhecido. Use apenas: " + [...ALLOWED_PLACEHOLDERS].map(p => `{${p}}`).join(" ")),
});

const toastSchema = z.object({
  enabled: z.boolean(),
  message: z.string().trim().min(1).max(200),
  durationMs: z.coerce.number().int().min(1000).max(15_000),
});

const pdpBadgeSchema = z.object({
  enabled: z.boolean(),
  label: z.string().trim().min(1, "Texto do badge obrigatório").max(40),
  showIcon: z.boolean(),
  tone: z.enum(["blue", "coral", "green", "amber", "neutral"]),
  position: z.enum(["top-left", "top-right", "bottom-left", "bottom-right"]),
  offsetX: z.coerce.number().int().min(0).max(80),
  offsetY: z.coerce.number().int().min(0).max(80),
});

export const conversionCtaConfigSchema = z.object({
  sticky: stickySchema,
  quickSummary: quickSummarySchema,
  exitPopup: exitPopupSchema,
  whatsappTemplate: whatsappTemplateSchema,
  toast: toastSchema,
  pdpBadge: pdpBadgeSchema,
});

/** Valida (e normaliza) o config. Lança Error com mensagem amigável se inválido. */
export function validateConversionCtaConfig(cfg: unknown): ConversionCtaConfig {
  const result = conversionCtaConfigSchema.safeParse(cfg);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `• ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(`Configuração inválida:\n${issues}`);
  }
  return result.data as ConversionCtaConfig;
}

export const useSaveConversionCtaConfig = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (cfg: ConversionCtaConfig) => {
      const safe = validateConversionCtaConfig(cfg);
      const { data: existing } = await supabase
        .from("store_settings")
        .select("id")
        .eq("key", KEY)
        .maybeSingle();
      if (existing) {
        const { error } = await supabase
          .from("store_settings")
          .update({ value: safe as any })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("store_settings")
          .insert({ key: KEY, value: safe as any });
        if (error) throw error;
      }
      return safe;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["store_settings", KEY] }),
  });
};
