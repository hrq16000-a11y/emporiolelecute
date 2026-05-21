import { Heart, Instagram, Facebook, MapPin, Phone, ExternalLink, Package } from "lucide-react"; // Heart/Package mantidos por uso em getIcon()
import { Link } from "react-router-dom";
import logo from "@/assets/logo.webp";
import { useFooterConfig, defaultFooterConfig } from "@/hooks/useStoreSettings";
import { useMenuItems } from "@/hooks/useMenus";

const Footer = () => {
  const { data: footerConfig } = useFooterConfig();
  const { data: menuItems } = useMenuItems('footer');
  const config = footerConfig || defaultFooterConfig;

  // Get visible footer menu items
  const footerLinks = menuItems?.filter(item => item.is_visible) || [];

  const getIcon = (iconName?: string) => {
    switch (iconName) {
      case 'Package': return <Package className="h-3 w-3" />;
      case 'Heart': return <Heart className="h-3 w-3" />;
      case 'ExternalLink': return <ExternalLink className="h-3 w-3" />;
      default: return null;
    }
  };

  const isExternal = (url: string) => url.startsWith('http');

  // Eyebrow editorial reaproveitado em todas as colunas (mesma cadência da loja)
  const colTitle = "text-[11px] uppercase tracking-[0.18em] text-primary-foreground/60 mb-5 font-medium";

  return (
    <footer id="contato" className="bg-foreground text-primary-foreground pt-20 pb-10">
      <div className="layout-commerce">
        {/* Microcopy editorial — assinatura acima dos grupos de links */}
        <div className="max-w-2xl mb-14">
          <p className="text-base md:text-lg text-primary-foreground/85 font-light leading-relaxed">
            Empório LeleCute — perfumaria artesanal, feita em pequena escala.
          </p>
          <p className="mt-2 text-sm text-primary-foreground/55 font-light">
            Do nosso ateliê, em Curitiba, para a sua casa.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-x-12 gap-y-14 mb-14">
          {/* Brand */}
          <div>
            <img src={logo} alt="Logo Empório LeleCute" className="h-14 w-auto mb-5 rounded-lg bg-white p-2" />
            <p className="text-primary-foreground/65 text-sm leading-relaxed mb-5 font-light">
              {config.brand_description}
            </p>
            <div className="flex gap-3">
              {config.social_links.instagram && (
                <a href={config.social_links.instagram} target="_blank" rel="noopener noreferrer" className="w-9 h-9 bg-primary-foreground/10 hover:bg-primary rounded-full flex items-center justify-center transition-colors" aria-label="Instagram">
                  <Instagram className="h-4 w-4" />
                </a>
              )}
              {config.social_links.facebook && (
                <a href={config.social_links.facebook} target="_blank" rel="noopener noreferrer" className="w-9 h-9 bg-primary-foreground/10 hover:bg-primary rounded-full flex items-center justify-center transition-colors" aria-label="Facebook">
                  <Facebook className="h-4 w-4" />
                </a>
              )}
            </div>
          </div>

          {/* Links - Dynamic from menu_items table */}
          <div>
            <h3 className={colTitle}>Links Úteis</h3>
            <ul className="space-y-3 text-sm text-primary-foreground/70 font-light">
              {footerLinks.length > 0 ? (
                footerLinks.map((link) => (
                  <li key={link.id}>
                    {link.is_external || (link.url && isExternal(link.url)) ? (
                      <a 
                        href={link.url || '#'} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="hover:text-primary transition-colors flex items-center gap-2"
                      >
                        {link.label} <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      <Link 
                        to={link.url || '/'} 
                        className="hover:text-primary transition-colors flex items-center gap-2"
                      >
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))
              ) : (
                // Fallback to config if no menu items
                config.useful_links.map((link, index) => (
                  <li key={index}>
                    {isExternal(link.url) ? (
                      <a href={link.url} target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors flex items-center gap-2">
                        {getIcon(link.icon)} {link.label} <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      <Link to={link.url} className="hover:text-primary transition-colors flex items-center gap-2">
                        {getIcon(link.icon)} {link.label}
                      </Link>
                    )}
                  </li>
                ))
              )}
            </ul>
          </div>

          {/* Ocasiões */}
          <div>
            <h3 className={colTitle}>Ocasiões</h3>
            <ul className="space-y-3 text-sm text-primary-foreground/70 font-light">
              {config.occasions.map((occasion, index) => (
                <li key={index}>
                  <Link to={occasion.url} className="hover:text-primary transition-colors">{occasion.label}</Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contato */}
          <div>
            <h3 className={colTitle}>Contato</h3>
            <ul className="space-y-4 text-sm text-primary-foreground/70 font-light">
              <li className="flex items-start gap-3">
                <Phone className="h-4 w-4 text-primary/80 shrink-0 mt-0.5" />
                <a href={`https://wa.me/55${config.contacts.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">{config.contacts.phone}</a>
              </li>
              <li className="flex items-start gap-3">
                <MapPin className="h-4 w-4 text-primary/80 shrink-0 mt-0.5" />
                <span className="whitespace-pre-line">{config.contacts.address}</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-primary-foreground/10 pt-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-primary-foreground/45 font-light">
          <p>{config.footer_text.replace('{year}', new Date().getFullYear().toString())}</p>
          <div className="flex items-center gap-4">
            <Link to="/politica-de-privacidade" className="hover:text-primary transition-colors">
              Política de Privacidade
            </Link>
            <span className="tracking-wide">Feito à mão. Em Curitiba.</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
