import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Menu, X, Instagram, Facebook, ShoppingCart, LogIn, Search } from "lucide-react";
import MiniCart from "@/components/MiniCart";
import { Button } from "@/components/ui/button";
import SearchBar from "@/components/SearchBar";
import { useCart } from "@/contexts/CartContext";
import { useMenuItems } from "@/hooks/useMenus";
import logo from "@/assets/logo.webp";

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const { itemCount } = useCart();
  const navigate = useNavigate();
  const navRef = useRef<HTMLElement | null>(null);
  const mobileSearchRef = useRef<HTMLDivElement | null>(null);

  const { data: menuItems } = useMenuItems('header');

  // Track scroll for "shrink header" effect
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinks = menuItems
    ?.filter(item => item.is_visible)
    .map(item => ({
      href: item.url || '/',
      label: item.label,
      isExternal: item.is_external,
    })) || [
      { href: "/sobre", label: "Sobre", isExternal: false },
      { href: "/produtos", label: "Produtos", isExternal: false },
      { href: "/ocasioes", label: "Ocasiões", isExternal: false },
      { href: "/depoimentos", label: "Depoimentos", isExternal: false },
      { href: "/orcamento", label: "Orçamento", isExternal: false },
      { href: "/contato", label: "Contato", isExternal: false },
    ];

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, link: { href: string; isExternal: boolean }) => {
    if (link.isExternal) return;
    e.preventDefault();
    setIsMenuOpen(false);
    navigate(link.href);
  };

  // Auto-close on outside click + ESC
  useEffect(() => {
    if (!isMenuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsMenuOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [isMenuOpen]);

  // Auto-close mobile search on outside click + ESC (independente do menu)
  useEffect(() => {
    if (!isMobileSearchOpen) return;
    const onClick = (e: MouseEvent) => {
      if (mobileSearchRef.current && !mobileSearchRef.current.contains(e.target as Node)) {
        // Ignora cliques no botão de toggle (que já gerencia o estado)
        const target = e.target as HTMLElement;
        if (target.closest('[data-mobile-search-toggle]')) return;
        setIsMobileSearchOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsMobileSearchOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [isMobileSearchOpen]);

  const socialLinks = [
    { href: "https://www.instagram.com/emporiolelecute", icon: Instagram, label: "Instagram" },
    { href: "https://www.facebook.com/emporiolelecute", icon: Facebook, label: "Facebook" },
  ];

  return (
    <header 
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled 
          ? "bg-background/80 backdrop-blur-lg border-b border-border/50 shadow-medium py-1 md:py-1" 
          : "bg-background/95 backdrop-blur-md border-b border-border/30 py-2 md:py-3"
      }`}
    >
      <nav ref={navRef} className="container mx-auto px-4" aria-label="Navegação principal">
        <div className="flex items-center justify-between">
          <Link
            to="/"
            className="flex items-center gap-2 group"
            aria-label="Empório LeleCute - Página inicial"
          >
            <img
              src={logo}
              alt="Logo Empório LeleCute - Ateliê Criativo de Lembrancinhas Artesanais"
              /* width/height intrínsecos reais (1206x701) → browser reserva a aspect-ratio
                 antes da imagem baixar, eliminando CLS no mobile. */
              width={1206}
              height={701}
              decoding="async"
              fetchPriority="high"
              className={`w-auto object-contain transition-all duration-500 group-hover:scale-105 ${
                isScrolled ? "h-12 sm:h-14 md:h-20" : "h-16 sm:h-20 md:h-28"
              }`}
            />

          </Link>

          <div className="hidden lg:flex items-center gap-8">
            <ul className="flex items-center gap-6">
              {navLinks.map((link) => (
                <li key={link.href + link.label}>
                  {link.isExternal ? (
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-foreground/80 hover:text-primary transition-colors duration-200 relative after:absolute after:bottom-[-4px] after:left-0 after:w-0 after:h-0.5 after:bg-primary after:transition-all after:duration-300 hover:after:w-full"
                    >
                      {link.label}
                    </a>
                  ) : (
                    <a
                      href={link.href}
                      onClick={(e) => handleNavClick(e, link)}
                      className="text-sm font-medium text-foreground/80 hover:text-primary transition-colors duration-200 relative after:absolute after:bottom-[-4px] after:left-0 after:w-0 after:h-0.5 after:bg-primary after:transition-all after:duration-300 hover:after:w-full"
                    >
                      {link.label}
                    </a>
                  )}
                </li>
              ))}
            </ul>

            <div className="border-l border-border pl-6">
              <SearchBar />
            </div>

            <div className="flex items-center gap-3">
              {socialLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-primary transition-colors duration-200"
                  aria-label={link.label}
                >
                  <link.icon className="h-5 w-5" />
                </a>
              ))}
            </div>

            <MiniCart />


            {/* Conectar (login) */}
            <Link to="/admin/login">
              <Button
                variant="outline"
                size="sm"
                className="rounded-full px-5 border-primary/30 text-primary hover:bg-primary/10 hover:text-primary"
              >
                <LogIn className="h-4 w-4 mr-2" />
                Conectar
              </Button>
            </Link>
          </div>

          <div className="lg:hidden flex items-center gap-2">
            <button
              data-mobile-search-toggle
              className="p-2 text-foreground hover:text-primary transition-colors"
              onClick={() => {
                setIsMobileSearchOpen((v) => !v);
                setIsMenuOpen(false);
              }}
              aria-label={isMobileSearchOpen ? "Fechar busca" : "Abrir busca"}
              aria-expanded={isMobileSearchOpen}
            >
              {isMobileSearchOpen ? <X className="h-5 w-5" /> : <Search className="h-5 w-5" />}
            </button>

            <MiniCart compact />


            <button
              className="p-2 text-foreground hover:text-primary transition-colors"
              onClick={() => {
                setIsMenuOpen(!isMenuOpen);
                setIsMobileSearchOpen(false);
              }}
              aria-label={isMenuOpen ? "Fechar menu" : "Abrir menu"}
              aria-expanded={isMenuOpen}
            >
              {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {isMobileSearchOpen && (
          <div
            ref={mobileSearchRef}
            className="lg:hidden mt-3 pb-2 animate-fade-in"
          >
            <div className="[&_.max-w-xs]:max-w-full">
              <SearchBar
                autoFocus
                searchPath="/buscar"
                paramKey="q"
                onResultSelect={() => setIsMobileSearchOpen(false)}
              />
            </div>
          </div>
        )}

        {isMenuOpen && (
          <div className="lg:hidden absolute top-full left-0 right-0 bg-background border-b border-border shadow-medium animate-fade-in">
            <ul className="flex flex-col py-4">
              {navLinks.map((link) => (
                <li key={link.href + link.label}>
                  {link.isExternal ? (
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block px-6 py-3 text-foreground/80 hover:text-primary hover:bg-primary-light/50 transition-colors"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      {link.label}
                    </a>
                  ) : (
                    <a
                      href={link.href}
                      className="block px-6 py-3 text-foreground/80 hover:text-primary hover:bg-primary-light/50 transition-colors"
                      onClick={(e) => handleNavClick(e, link)}
                    >
                      {link.label}
                    </a>
                  )}
                </li>
              ))}
              <li className="px-6 pt-4 flex items-center gap-4">
                {socialLinks.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-primary transition-colors"
                    aria-label={link.label}
                  >
                    <link.icon className="h-5 w-5" />
                  </a>
                ))}
                <Link
                  to="/carrinho"
                  className="relative p-2 text-foreground/80 hover:text-primary transition-colors ml-auto"
                  aria-label="Carrinho de compras"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <ShoppingCart className="h-5 w-5" />
                  {itemCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                      {itemCount > 99 ? '99+' : itemCount}
                    </span>
                  )}
                </Link>
              </li>
              <li className="px-6 pt-4">
                <Link to="/admin/login" onClick={() => setIsMenuOpen(false)} className="w-full">
                  <Button variant="outline" className="w-full rounded-full border-primary/30 text-primary hover:bg-primary/10">
                    <LogIn className="h-4 w-4 mr-2" />
                    Conectar
                  </Button>
                </Link>
              </li>
            </ul>
          </div>
        )}
      </nav>
    </header>
  );
};

export default Header;
