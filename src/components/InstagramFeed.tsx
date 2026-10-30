import { useState, useCallback, useEffect } from "react";
import { Instagram, Heart, ExternalLink, X, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { useInstagramPosts } from "@/hooks/useInstagramPosts";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import sabonetesImg from "@/assets/category-sabonetes.webp";
import velasImg from "@/assets/category-velas.webp";
import lembrancinhasImg from "@/assets/category-lembrancinhas.webp";
import kitsImg from "@/assets/category-kits.webp";

const fallbackPosts = [
  { id: "f1", image_url: sabonetesImg, alt_text: "Sabonetes artesanais", post_url: null },
  { id: "f2", image_url: velasImg, alt_text: "Velas perfumadas", post_url: null },
  { id: "f3", image_url: lembrancinhasImg, alt_text: "Lembrancinhas em caixinhas", post_url: null },
  { id: "f4", image_url: kitsImg, alt_text: "Kits maternidade", post_url: null },
  { id: "f5", image_url: sabonetesImg, alt_text: "Sabonetes florais", post_url: null },
  { id: "f6", image_url: velasImg, alt_text: "Velas aromáticas", post_url: null },
];

const InstagramFeed = () => {
  const { data: dbPosts, refetch, isFetching } = useInstagramPosts();
  const source = dbPosts && dbPosts.length > 0 ? dbPosts : fallbackPosts;
  const posts = source.slice(0, 6);
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const close = useCallback(() => setOpenIndex(null), []);
  const go = useCallback(
    (delta: number) =>
      setOpenIndex((current) => (current === null ? null : (current + delta + posts.length) % posts.length)),
    [posts.length]
  );

  useEffect(() => {
    if (openIndex === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") go(1);
      if (event.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openIndex, go]);

  // Preload neighbours so switching posts never flickers
  useEffect(() => {
    if (openIndex === null) return;
    [1, -1].forEach((delta) => {
      const next = posts[(openIndex + delta + posts.length) % posts.length];
      if (next) {
        const img = new Image();
        img.src = next.image_url;
      }
    });
  }, [openIndex, posts]);

  const active = openIndex !== null ? posts[openIndex] : null;

  return (
    <section className="py-20 bg-background" aria-labelledby="instagram-heading">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <span className="inline-flex items-center gap-2 px-4 py-2 bg-primary-light rounded-full text-primary text-sm font-medium mb-4">
            <Instagram className="h-4 w-4" />
            @emporiolelecute
          </span>
          <h2 id="instagram-heading" className="font-display text-4xl md:text-5xl text-foreground mb-4">
            Siga-nos no <span className="text-primary">Instagram</span>
          </h2>
          <p className="text-muted-foreground">Acompanhe novidades, bastidores e inspirações</p>
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="mt-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            {isFetching ? "Atualizando..." : "Atualizar fotos"}
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3 md:gap-4 max-w-4xl mx-auto">
          {posts.map((post, index) => (
            <button
              key={post.id}
              type="button"
              onClick={() => setOpenIndex(index)}
              aria-label={`Ampliar: ${post.alt_text || "postagem do Instagram"}`}
              className="relative aspect-[4/5] overflow-hidden rounded-xl group bg-muted/40 block w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              {/* Blurred backdrop fills the tile so rows stay aligned without cropping the photo */}
              <img
                src={post.image_url}
                alt=""
                aria-hidden="true"
                loading="lazy"
                decoding="async"
                className="absolute inset-0 w-full h-full object-cover scale-110 blur-2xl opacity-40"
              />
              <img
                src={post.image_url}
                alt={post.alt_text || "Postagem do Instagram"}
                loading="lazy"
                decoding="async"
                className="absolute inset-0 w-full h-full object-contain object-center transition-transform duration-500 group-hover:scale-[1.03]"
              />
              <div className="absolute inset-0 bg-primary/70 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center pointer-events-none">
                <Heart className="h-8 w-8 text-primary-foreground" />
              </div>
            </button>

          ))}
        </div>

        <div className="text-center mt-8">
          <a
            href="https://www.instagram.com/emporiolelecute"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 text-white px-8 py-4 rounded-full font-semibold shadow-medium hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
          >
            <Instagram className="h-5 w-5" />
            Seguir no Instagram
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </div>

      <Dialog open={openIndex !== null} onOpenChange={(open) => !open && close()}>
        <DialogContent
          className="max-w-3xl w-[96vw] sm:w-[95vw] p-0 border-none bg-background/95 backdrop-blur [&>button]:hidden"
        >
          <DialogTitle className="sr-only">Postagem do Instagram</DialogTitle>
          <DialogDescription className="sr-only">
            {active?.alt_text || "Visualização ampliada da postagem"}
          </DialogDescription>

          {active && (
            <div className="relative animate-fade-in">
              <div className="relative flex items-center justify-center h-[60vh] sm:h-[70vh] overflow-hidden rounded-t-lg bg-muted/30">
                <img
                  src={active.image_url}
                  alt={active.alt_text || "Postagem do Instagram"}
                  className="h-full w-full object-contain animate-fade-in"
                />
              </div>

              <button
                type="button"
                onClick={close}
                aria-label="Fechar"
                className="absolute top-3 right-3 h-10 w-10 rounded-full bg-background/80 hover:bg-background flex items-center justify-center shadow-medium transition-colors"
              >
                <X className="h-5 w-5" />
              </button>

              {posts.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => go(-1)}
                    aria-label="Anterior"
                    className="absolute left-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-background/80 hover:bg-background flex items-center justify-center shadow-medium transition-colors"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => go(1)}
                    aria-label="Próxima"
                    className="absolute right-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-background/80 hover:bg-background flex items-center justify-center shadow-medium transition-colors"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </>
              )}

              <div className="flex items-center justify-between gap-4 p-4">
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {active.alt_text || "@emporiolelecute"}
                </p>
                <a
                  href={active.post_url || "https://www.instagram.com/emporiolelecute"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex shrink-0 items-center gap-2 text-sm font-medium text-primary hover:underline"
                >
                  Ver no Instagram
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
};

export default InstagramFeed;
