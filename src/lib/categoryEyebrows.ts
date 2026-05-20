// Eyebrows editoriais por slug de taxonomia.
// SAFE: não altera nomes, slugs, SEO ou H1 — apenas adiciona atmosfera
// editorial discreta acima do título. Fallback silencioso (retorna null).

type Kind = "categoria" | "ocasiao" | "segmento";

const MAP: Record<Kind, Record<string, string>> = {
  categoria: {
    sabonetes: "O banho como pausa",
    "sabonete-artesanal": "O banho como pausa",
    sachês: "Perfume que repousa",
    sache: "Perfume que repousa",
    saches: "Perfume que repousa",
    "sache-perfumado": "Perfume que repousa",
    velas: "A luz que perfuma",
    "vela-artesanal": "A luz que perfuma",
    "escalda-pes": "Um ritual antes da noite",
    "escalda-pés": "Um ritual antes da noite",
    escaldapes: "Um ritual antes da noite",
  },
  ocasiao: {
    maternidade: "Os primeiros encontros",
    "cha-de-bebe": "Os primeiros encontros",
    "cha-bebe": "Os primeiros encontros",
    nascimento: "Os primeiros encontros",
    batizado: "Os primeiros encontros",
    casamento: "Lembranças que se usam",
    noivado: "Lembranças que se usam",
    "bodas": "Lembranças que se usam",
    aniversario: "Para marcar a data",
    "aniversário": "Para marcar a data",
    corporativo: "Um gesto entre profissionais",
  },
  segmento: {},
};

export const getEditorialEyebrow = (kind: Kind, slug?: string | null): string | null => {
  if (!slug) return null;
  return MAP[kind]?.[slug.toLowerCase()] ?? null;
};
