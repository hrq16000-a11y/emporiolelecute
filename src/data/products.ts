export interface Product {
  id: string;
  slug: string;
  name: string;
  description: string;
  longDescription?: string;
  price: string;
  /** Numeric price (BRL) used for Schema.org microdata. Optional for back-compat. */
  priceValue?: number;
  originalPrice?: string;
  image: string;
  images?: string[];
  link: string;
  badge?: string;
  rating: number;
  category: "sabonetes" | "velas" | "kits" | "outros";
  occasions: ("maternidade" | "cha-bebe" | "batizado" | "casamento" | "aniversario" | "corporativo")[];
  keywords: string[];
  min_quantity?: number;
  production_days?: number | null;
  production_speed?: 'rapido' | 'normal' | 'longo' | null;
  personalization_enabled?: boolean | null;
  featured_weight?: number | null;
}

export const products: Product[] = [];

export const categories = [
  { id: "sabonetes", name: "Sabonetes", icon: "🧼" },
  { id: "velas", name: "Velas", icon: "🕯️" },
  { id: "kits", name: "Kits", icon: "🎁" },
  { id: "outros", name: "Outros", icon: "✨" }
];

export const occasions = [
  { id: "maternidade", name: "Maternidade", icon: "👶" },
  { id: "cha-bebe", name: "Chá de Bebê", icon: "🍼" },
  { id: "batizado", name: "Batizado", icon: "⛪" },
  { id: "casamento", name: "Casamento", icon: "💒" },
  { id: "aniversario", name: "Aniversário", icon: "🎂" },
  { id: "corporativo", name: "Corporativo", icon: "🏢" }
];

export const states = [
  "Acre", "Alagoas", "Amapá", "Amazonas", "Bahia", "Ceará", "Distrito Federal",
  "Espírito Santo", "Goiás", "Maranhão", "Mato Grosso", "Mato Grosso do Sul",
  "Minas Gerais", "Pará", "Paraíba", "Paraná", "Pernambuco", "Piauí",
  "Rio de Janeiro", "Rio Grande do Norte", "Rio Grande do Sul", "Rondônia",
  "Roraima", "Santa Catarina", "São Paulo", "Sergipe", "Tocantins"
];

export const getProductBySlug = (slug: string): Product | undefined => {
  return products.find(p => p.slug === slug);
};
