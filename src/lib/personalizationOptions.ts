/**
 * Catálogo de opções de personalização por produto.
 *
 * Armazenado em `products.personalization_options` (jsonb, array).
 * O admin monta livremente campos de texto, cores (swatch), imagens
 * (miniaturas) e variações (lista). O PDP renderiza e o resumo textual
 * resultante entra no pedido / mensagem de WhatsApp.
 */

export type PersonalizationOptionType = "text" | "color" | "image" | "select";

export interface PersonalizationChoice {
  id: string;
  label: string;
  /** Hex (#RRGGBB) para `color`, URL para `image`, texto livre para `select`. */
  value?: string;
}

export interface PersonalizationOption {
  id: string;
  type: PersonalizationOptionType;
  label: string;
  help?: string;
  required?: boolean;
  placeholder?: string;
  max_length?: number;
  choices?: PersonalizationChoice[];
}

export type PersonalizationValues = Record<string, string>;

export const OPTION_TYPE_LABEL: Record<PersonalizationOptionType, string> = {
  text: "Texto livre",
  color: "Cores",
  image: "Imagens",
  select: "Variações",
};

export const isChoiceType = (type: PersonalizationOptionType) =>
  type === "color" || type === "image" || type === "select";

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10);

export const createOption = (type: PersonalizationOptionType): PersonalizationOption => ({
  id: newId(),
  type,
  label: OPTION_TYPE_LABEL[type],
  required: false,
  ...(type === "text"
    ? { placeholder: "Digite aqui...", max_length: 60 }
    : { choices: [createChoice()] }),
});

export const createChoice = (): PersonalizationChoice => ({
  id: newId(),
  label: "",
  value: "",
});

/** Normaliza o jsonb vindo do banco — tolera dados legados/parciais. */
export const parsePersonalizationOptions = (raw: unknown): PersonalizationOption[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
    .map((item) => {
      const type = (["text", "color", "image", "select"] as const).includes(
        item.type as PersonalizationOptionType,
      )
        ? (item.type as PersonalizationOptionType)
        : "text";
      const choices = Array.isArray(item.choices)
        ? (item.choices as Record<string, unknown>[])
            .filter((c) => !!c && typeof c === "object")
            .map((c) => ({
              id: String(c.id || newId()),
              label: String(c.label ?? ""),
              value: c.value == null ? "" : String(c.value),
            }))
        : [];
      return {
        id: String(item.id || newId()),
        type,
        label: String(item.label ?? OPTION_TYPE_LABEL[type]),
        help: item.help ? String(item.help) : undefined,
        required: item.required === true,
        placeholder: item.placeholder ? String(item.placeholder) : undefined,
        max_length: Number.isFinite(Number(item.max_length)) ? Number(item.max_length) : undefined,
        choices: isChoiceType(type) ? choices : undefined,
      } satisfies PersonalizationOption;
    })
    .filter((opt) => opt.label.trim().length > 0);
};

/** Remove campos vazios antes de gravar. */
export const serializePersonalizationOptions = (options: PersonalizationOption[]) =>
  options
    .filter((o) => o.label.trim().length > 0)
    .map((o) => ({
      ...o,
      label: o.label.trim(),
      choices: isChoiceType(o.type)
        ? (o.choices || []).filter((c) => c.label.trim().length > 0)
        : undefined,
    }));

/** Resumo legível para pedido / WhatsApp: "Cor: Rosa | Nome: Ana". */
export const formatPersonalizationSelections = (
  options: PersonalizationOption[],
  values: PersonalizationValues,
): string =>
  options
    .map((opt) => {
      const raw = (values[opt.id] || "").trim();
      if (!raw) return null;
      if (isChoiceType(opt.type)) {
        const choice = (opt.choices || []).find((c) => c.id === raw);
        return choice ? `${opt.label}: ${choice.label}` : null;
      }
      return `${opt.label}: ${raw}`;
    })
    .filter(Boolean)
    .join(" | ");

/** Retorna os labels das opções obrigatórias ainda não preenchidas. */
export const missingRequiredOptions = (
  options: PersonalizationOption[],
  values: PersonalizationValues,
): string[] =>
  options.filter((o) => o.required && !(values[o.id] || "").trim()).map((o) => o.label);
