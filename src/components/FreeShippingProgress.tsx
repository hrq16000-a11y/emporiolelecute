import { useMemo } from 'react';
import { Truck, Sparkles, Gift } from 'lucide-react';
import { useFreeShippingThreshold } from '@/hooks/useFreeShippingThreshold';
import { formatBRL } from '@/lib/format';

interface Props {
  /** Subtotal atual do carrinho. Se omitido, o componente pode ser combinado com useCart(). */
  currentTotal: number;
  /** Variante visual. 'card' para bloco discreto (carrinho/checkout); 'compact' para drawers/sidebars. */
  variant?: 'card' | 'compact';
}

/**
 * Barra de progresso de Frete Grátis — 100% dinâmica e orientada a CRO.
 *
 * Requisitos:
 * - Threshold lido do backend (shipping_settings → store_settings → fallback 299).
 * - Animação fluida (transition-all duration-500) ao alterar a largura.
 * - Mensagens persuasivas: urgência quando próximo, celebração ao atingir.
 * - Design harmonizado com a paleta artesanal/feminina (verde oliva suave).
 * - Acessível: role="status", aria-live="polite", progressbar semântico.
 */
const FreeShippingProgress = ({ currentTotal, variant = 'card' }: Props) => {
  const { data: threshold, isLoading } = useFreeShippingThreshold();

  const safeThreshold = threshold ?? 299;
  const reached = currentTotal >= safeThreshold;
  const missing = Math.max(0, safeThreshold - currentTotal);
  const pct = useMemo(
    () => Math.min(100, Math.round((currentTotal / safeThreshold) * 100)),
    [currentTotal, safeThreshold]
  );

  // Não renderiza nada enquanto carrega o threshold (evita flicker de layout)
  if (isLoading) return null;

  // Se o threshold for 0, desabilita a barra (frete grátis universal ou desativado)
  if (safeThreshold <= 0) return null;

  const isCompact = variant === 'compact';

  return (
    <div
      className={`
        ${isCompact ? 'px-3 py-2' : 'rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-card)]'}
      `}
      role="status"
      aria-live="polite"
    >
      {/* Cabeçalho com ícone + mensagem CRO */}
      <div className="flex items-center gap-2.5">
        <div
          className={`
            flex items-center justify-center rounded-full flex-shrink-0
            ${reached
              ? 'bg-success/15 text-success'
              : 'bg-primary/10 text-primary'}
            ${isCompact ? 'h-7 w-7' : 'h-9 w-9'}
          `}
        >
          {reached ? (
            <Gift className={isCompact ? 'h-4 w-4' : 'h-5 w-5'} aria-hidden="true" />
          ) : (
            <Truck className={isCompact ? 'h-4 w-4' : 'h-5 w-5'} aria-hidden="true" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className={`font-medium leading-snug ${isCompact ? 'text-xs' : 'text-sm'}`}>
            {reached ? (
              <span className="text-success">
                <span className="font-display font-semibold">Parabéns!</span>{' '}
                Você garantiu <span className="font-semibold">Frete Grátis</span> 🎉
              </span>
            ) : missing <= safeThreshold * 0.15 ? (
              // Menos de 15% faltando: mensagem de urgência/escassez
              <span className="text-foreground">
                <span className="font-display font-semibold text-primary">Faltam apenas {formatBRL(missing)}</span>{' '}
                para o <span className="font-semibold">Frete Grátis</span>!
              </span>
            ) : (
              <span className="text-foreground">
                Faltam <span className="font-display font-semibold text-primary">{formatBRL(missing)}</span>{' '}
                para você ganhar <span className="font-semibold">Frete Grátis</span>
              </span>
            )}
          </p>

          {!reached && !isCompact && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Aproveite e complete seu pedido — frete grátis em compras acima de {formatBRL(safeThreshold)}.
            </p>
          )}
        </div>

        {reached && (
          <Sparkles className="h-5 w-5 text-success flex-shrink-0 animate-pulse" aria-hidden="true" />
        )}
      </div>

      {/* Barra de progresso */}
      <div
        className={`
          w-full overflow-hidden rounded-full bg-muted
          ${isCompact ? 'mt-2 h-1.5' : 'mt-3 h-2.5'}
        `}
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Progresso para frete grátis"
      >
        <div
          className={`
            h-full rounded-full transition-all duration-500 ease-out
            ${reached
              ? 'bg-success'
              : pct >= 75
                ? 'bg-success/80'
                : 'bg-primary'}
          `}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Percentual numérico (visível apenas em variant card) */}
      {!isCompact && (
        <div className="flex justify-between mt-1.5">
          <span className="text-[11px] text-muted-foreground">
            {formatBRL(currentTotal)}
          </span>
          <span className="text-[11px] text-muted-foreground">
            {formatBRL(safeThreshold)}
          </span>
        </div>
      )}
    </div>
  );
};

export default FreeShippingProgress;
