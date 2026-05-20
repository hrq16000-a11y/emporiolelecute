/**
 * SectionEyebrow — sobretítulo editorial opcional e padronizado.
 * Uso: <SectionEyebrow>Curadoria da casa</SectionEyebrow>
 *
 * SAFE: visualmente neutro, não altera layout quando ausente.
 * Tipografia alinhada à identidade boutique (uppercase fino, tracking amplo).
 */
interface SectionEyebrowProps {
  children?: React.ReactNode;
  className?: string;
  align?: "left" | "center";
}

const SectionEyebrow = ({ children, className = "", align = "left" }: SectionEyebrowProps) => {
  if (!children) return null;
  const alignClass = align === "center" ? "justify-center text-center" : "justify-start text-left";
  return (
    <div
      className={`flex items-center gap-2 mb-3 text-[10px] md:text-[11px] uppercase tracking-[0.22em] text-muted-foreground/80 font-medium ${alignClass} ${className}`}
    >
      <span aria-hidden className="inline-block h-px w-6 bg-border/70" />
      <span>{children}</span>
    </div>
  );
};

export default SectionEyebrow;
