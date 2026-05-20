import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface AcceptedMethods {
  pix: boolean;
  credit_card: boolean;
  boleto: boolean;
}

interface PaymentConfig {
  pix_discount: number;
  installments: number;
  accepted_methods: AcceptedMethods;
}

export interface SEOConfig {
  site_title: string;
  site_description: string;
  site_keywords: string;
  og_image: string;
  twitter_handle: string;
  google_verification: string;
  bing_verification: string;
  facebook_app_id: string;
  canonical_url: string;
  robots_txt: string;
  additional_meta_tags: string;
  structured_data_business: string;
  sitemap_notification_email: string;
}

export interface FooterLink {
  icon?: string;
  label: string;
  url: string;
}

export interface FooterConfig {
  brand_description: string;
  useful_links: FooterLink[];
  occasions: FooterLink[];
  contacts: {
    phone: string;
    address: string;
  };
  social_links: {
    instagram: string;
    facebook: string;
  };
  footer_text: string;
  made_with_love: string;
}

export interface TrustBadgeItem {
  icon: 'Truck' | 'Percent' | 'Headset' | 'CreditCard' | 'Shield' | 'Heart' | 'Sparkles' | 'Package' | 'Clock' | 'Star';
  title: string;
  subtitle: string;
}

export interface TrustBadgesConfig {
  items: TrustBadgeItem[];
  whatsapp_label: string;
  whatsapp_message: string;
  show_whatsapp: boolean;
}

const defaultPaymentConfig: PaymentConfig = {
  pix_discount: 5,
  installments: 3,
  accepted_methods: {
    pix: true,
    credit_card: true,
    boleto: false,
  },
};

export const defaultTrustBadgesConfig: TrustBadgesConfig = {
  items: [
    { icon: 'Truck', title: 'Envio para', subtitle: 'Todo o Brasil' },
    { icon: 'Percent', title: 'Descontos', subtitle: '5% PIX' },
    { icon: 'Headset', title: 'Atendimento', subtitle: 'Personalizado' },
    { icon: 'CreditCard', title: 'Pague com Cartão', subtitle: 'Até 3x sem juros' },
  ],
  whatsapp_label: 'Conversar no WhatsApp',
  whatsapp_message: 'Oi, aqui é da LeleCute. Vim do site e gostaria de conversar sobre as lembrancinhas.',
  show_whatsapp: true,
};

const defaultSEOConfig: SEOConfig = {
  site_title: 'Empório LeleCute | Lembrancinhas Artesanais Personalizadas',
  site_description: 'Ateliê criativo de lembrancinhas artesanais personalizadas. Sabonetes, velas perfumadas e presentes únicos para todas as ocasiões especiais.',
  site_keywords: 'lembrancinhas personalizadas, sabonetes artesanais, velas perfumadas, maternidade, chá de bebê, batizado, casamento',
  og_image: 'https://emporiolelecute.com.br/og-image.webp',
  twitter_handle: '@emporiolelecute',
  google_verification: '',
  bing_verification: '',
  facebook_app_id: '',
  canonical_url: 'https://emporiolelecute.com.br',
  robots_txt: '',
  additional_meta_tags: '',
  structured_data_business: '',
  sitemap_notification_email: '',
};

export const defaultFooterConfig: FooterConfig = {
  brand_description: 'Ateliê criativo de lembrancinhas artesanais personalizadas. Sabonetes, velas e presentes feitos com amor.',
  useful_links: [
    { icon: 'Package', label: 'Rastrear Pedido', url: '/rastrear' },
    { icon: 'Heart', label: 'Orçamento Personalizado', url: '/orcamento' },
    { icon: 'ExternalLink', label: 'Loja Virtual', url: 'https://emporiolelecute.com.br/loja/' },
    { icon: 'ExternalLink', label: 'Pinterest', url: 'https://br.pinterest.com/emporiolelecute' },
  ],
  occasions: [
    { label: 'Maternidade & Chá de Bebê', url: '/produtos?ocasiao=maternidade' },
    { label: 'Batizado & Primeira Comunhão', url: '/produtos?ocasiao=batizado' },
    { label: 'Casamento & Bodas', url: '/produtos?ocasiao=casamento' },
    { label: 'Aniversário & Festas', url: '/produtos?ocasiao=aniversario' },
    { label: 'Eventos Corporativos', url: '/produtos?ocasiao=corporativo' },
  ],
  contacts: {
    phone: '(41) 99221-4299',
    address: 'São José dos Pinhais, PR\nEnviamos para todo o Brasil',
  },
  social_links: {
    instagram: 'https://www.instagram.com/emporiolelecute',
    facebook: 'https://www.facebook.com/emporiolelecute',
  },
  footer_text: '© {year} Empório LeleCute. Todos os direitos reservados.',
  made_with_love: 'Feito com ❤️ em São José dos Pinhais, PR',
};

export const usePaymentConfig = () => {
  return useQuery({
    queryKey: ['payment_config'],
    queryFn: async (): Promise<PaymentConfig> => {
      const { data, error } = await supabase
        .from('store_settings')
        .select('value')
        .eq('key', 'payment_config')
        .maybeSingle();

      if (error) {
        console.error('Error fetching payment config:', error);
        return defaultPaymentConfig;
      }

      if (data?.value && typeof data.value === 'object' && !Array.isArray(data.value)) {
        const val = data.value as Record<string, unknown>;
        const methods = val.accepted_methods as Record<string, unknown> | undefined;
        return {
          pix_discount: typeof val.pix_discount === 'number' ? val.pix_discount : defaultPaymentConfig.pix_discount,
          installments: typeof val.installments === 'number' ? val.installments : defaultPaymentConfig.installments,
          accepted_methods: {
            pix: typeof methods?.pix === 'boolean' ? methods.pix : defaultPaymentConfig.accepted_methods.pix,
            credit_card: typeof methods?.credit_card === 'boolean' ? methods.credit_card : defaultPaymentConfig.accepted_methods.credit_card,
            boleto: typeof methods?.boleto === 'boolean' ? methods.boleto : defaultPaymentConfig.accepted_methods.boleto,
          },
        };
      }

      return defaultPaymentConfig;
    },
    placeholderData: defaultPaymentConfig,
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 60,
  });
};

export const useSEOConfig = () => {
  return useQuery({
    queryKey: ['seo_config'],
    queryFn: async (): Promise<SEOConfig> => {
      const { data, error } = await supabase
        .from('store_settings')
        .select('value')
        .eq('key', 'seo_config')
        .maybeSingle();

      if (error) {
        console.error('Error fetching SEO config:', error);
        return defaultSEOConfig;
      }

      if (data?.value && typeof data.value === 'object' && !Array.isArray(data.value)) {
        const val = data.value as Record<string, unknown>;
        return {
          site_title: typeof val.site_title === 'string' ? val.site_title : defaultSEOConfig.site_title,
          site_description: typeof val.site_description === 'string' ? val.site_description : defaultSEOConfig.site_description,
          site_keywords: typeof val.site_keywords === 'string' ? val.site_keywords : defaultSEOConfig.site_keywords,
          og_image: typeof val.og_image === 'string' ? val.og_image : defaultSEOConfig.og_image,
          twitter_handle: typeof val.twitter_handle === 'string' ? val.twitter_handle : defaultSEOConfig.twitter_handle,
          google_verification: typeof val.google_verification === 'string' ? val.google_verification : defaultSEOConfig.google_verification,
          bing_verification: typeof val.bing_verification === 'string' ? val.bing_verification : defaultSEOConfig.bing_verification,
          facebook_app_id: typeof val.facebook_app_id === 'string' ? val.facebook_app_id : defaultSEOConfig.facebook_app_id,
          canonical_url: typeof val.canonical_url === 'string' ? val.canonical_url : defaultSEOConfig.canonical_url,
          robots_txt: typeof val.robots_txt === 'string' ? val.robots_txt : defaultSEOConfig.robots_txt,
          additional_meta_tags: typeof val.additional_meta_tags === 'string' ? val.additional_meta_tags : defaultSEOConfig.additional_meta_tags,
          structured_data_business: typeof val.structured_data_business === 'string' ? val.structured_data_business : defaultSEOConfig.structured_data_business,
          sitemap_notification_email: typeof val.sitemap_notification_email === 'string' ? val.sitemap_notification_email : defaultSEOConfig.sitemap_notification_email,
        };
      }

      return defaultSEOConfig;
    },
    placeholderData: defaultSEOConfig,
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 60,
  });
};

export const useFooterConfig = () => {
  return useQuery({
    queryKey: ['footer_config'],
    queryFn: async (): Promise<FooterConfig> => {
      const { data, error } = await supabase
        .from('store_settings')
        .select('value')
        .eq('key', 'footer_config')
        .maybeSingle();

      if (error) {
        console.error('Error fetching footer config:', error);
        return defaultFooterConfig;
      }

      if (data?.value && typeof data.value === 'object' && !Array.isArray(data.value)) {
        const val = data.value as Record<string, unknown>;
        return {
          brand_description: typeof val.brand_description === 'string' ? val.brand_description : defaultFooterConfig.brand_description,
          useful_links: Array.isArray(val.useful_links) ? val.useful_links : defaultFooterConfig.useful_links,
          occasions: Array.isArray(val.occasions) ? val.occasions : defaultFooterConfig.occasions,
          contacts: typeof val.contacts === 'object' ? val.contacts as FooterConfig['contacts'] : defaultFooterConfig.contacts,
          social_links: typeof val.social_links === 'object' ? val.social_links as FooterConfig['social_links'] : defaultFooterConfig.social_links,
          footer_text: typeof val.footer_text === 'string' ? val.footer_text : defaultFooterConfig.footer_text,
          made_with_love: typeof val.made_with_love === 'string' ? val.made_with_love : defaultFooterConfig.made_with_love,
        };
      }

      return defaultFooterConfig;
    },
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });
};

const VALID_ICONS = new Set<TrustBadgeItem['icon']>(['Truck','Percent','Headset','CreditCard','Shield','Heart','Sparkles','Package','Clock','Star']);

export const useTrustBadgesConfig = () => {
  return useQuery({
    queryKey: ['trust_badges_config'],
    queryFn: async (): Promise<TrustBadgesConfig> => {
      const { data, error } = await supabase
        .from('store_settings')
        .select('value')
        .eq('key', 'trust_badges_config')
        .maybeSingle();

      if (error || !data?.value || typeof data.value !== 'object' || Array.isArray(data.value)) {
        return defaultTrustBadgesConfig;
      }

      const val = data.value as Record<string, unknown>;
      const rawItems = Array.isArray(val.items) ? val.items : [];
      const items: TrustBadgeItem[] = rawItems
        .map((it) => {
          const item = it as Record<string, unknown>;
          const icon = (typeof item.icon === 'string' && VALID_ICONS.has(item.icon as TrustBadgeItem['icon']))
            ? (item.icon as TrustBadgeItem['icon'])
            : 'Truck';
          return {
            icon,
            title: typeof item.title === 'string' ? item.title : '',
            subtitle: typeof item.subtitle === 'string' ? item.subtitle : '',
          };
        })
        .filter((it) => it.title || it.subtitle);

      return {
        items: items.length > 0 ? items : defaultTrustBadgesConfig.items,
        whatsapp_label: typeof val.whatsapp_label === 'string' ? val.whatsapp_label : defaultTrustBadgesConfig.whatsapp_label,
        whatsapp_message: typeof val.whatsapp_message === 'string' ? val.whatsapp_message : defaultTrustBadgesConfig.whatsapp_message,
        show_whatsapp: typeof val.show_whatsapp === 'boolean' ? val.show_whatsapp : defaultTrustBadgesConfig.show_whatsapp,
      };
    },
    staleTime: 1000 * 60 * 5,
  });
};
