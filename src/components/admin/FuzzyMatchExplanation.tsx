import { CheckCircle2, HelpCircle, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { classifyScore, type MatchExplanation } from '@/lib/fuzzyMatch';

interface FuzzyMatchExplanationProps {
  source: string;
  target: string;
  explanation: MatchExplanation;
  threshold: number;
}

const SIGNALS: Array<{ key: keyof MatchExplanation; label: string; weight: string; help: string }> = [
  { key: 'bigram', label: 'Similaridade textual (bigramas)', weight: '50%', help: 'Coeficiente de Dice — tolera erros de digitação.' },
  { key: 'tokenOverlap', label: 'Sobreposição de palavras', weight: '40%', help: 'Palavras relevantes em comum entre os títulos.' },
  { key: 'containment', label: 'Contenção literal', weight: '10%', help: 'Um título contém o outro por inteiro.' },
];

const STATUS = {
  confirmed: { label: 'Match confirmado', icon: CheckCircle2, className: 'text-primary' },
  doubtful: { label: 'Match duvidoso', icon: HelpCircle, className: 'text-amber-600 dark:text-amber-400' },
  no_match: { label: 'Sem match', icon: XCircle, className: 'text-destructive' },
} as const;

/**
 * Transparência do fuzzy match: mostra quais campos foram comparados,
 * o peso e o score de cada sinal, o score final e o limiar de corte vigente.
 */
export const FuzzyMatchExplanation = ({
  source,
  target,
  explanation,
  threshold,
}: FuzzyMatchExplanationProps) => {
  const verdict = STATUS[classifyScore(explanation.score, threshold)];
  const Icon = verdict.icon;
  const pct = (v: number) => `${(v * 100).toFixed(0)}%`;

  return (
    <div className="animate-fade-in space-y-4 rounded-lg border bg-muted/30 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Icon className={`h-4 w-4 ${verdict.className}`} aria-hidden />
        <span className={`text-sm font-medium ${verdict.className}`}>{verdict.label}</span>
        <Badge variant="outline" className="ml-auto">
          Score {pct(explanation.score)} · limiar {pct(threshold)}
        </Badge>
      </div>

      <div className="grid gap-2 text-xs sm:grid-cols-2">
        <div className="rounded-md border bg-background p-2">
          <p className="text-muted-foreground">Campo comparado (origem)</p>
          <p className="break-words font-medium">{source || '—'}</p>
        </div>
        <div className="rounded-md border bg-background p-2">
          <p className="text-muted-foreground">Campo comparado (catálogo)</p>
          <p className="break-words font-medium">{target || '—'}</p>
        </div>
      </div>

      <ul className="space-y-3">
        {SIGNALS.map((signal) => {
          const value = Number(explanation[signal.key] ?? 0);
          return (
            <li key={signal.key} className="space-y-1">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-medium">
                  {signal.label}{' '}
                  <span className="text-muted-foreground">(peso {signal.weight})</span>
                </span>
                <span className="tabular-nums text-muted-foreground">{pct(value)}</span>
              </div>
              <Progress value={value * 100} className="h-1.5 transition-all duration-500" />
              <p className="text-[11px] text-muted-foreground">{signal.help}</p>
            </li>
          );
        })}
      </ul>

      <div className="grid gap-2 text-xs sm:grid-cols-2">
        <div>
          <p className="mb-1 text-muted-foreground">Palavras em comum</p>
          <div className="flex flex-wrap gap-1">
            {explanation.sharedTokens.length ? (
              explanation.sharedTokens.map((t) => (
                <Badge key={t} variant="secondary" className="font-normal">{t}</Badge>
              ))
            ) : (
              <span className="text-muted-foreground">nenhuma</span>
            )}
          </div>
        </div>
        <div>
          <p className="mb-1 text-muted-foreground">Sem correspondência</p>
          <div className="flex flex-wrap gap-1">
            {explanation.missingTokens.length ? (
              explanation.missingTokens.slice(0, 8).map((t) => (
                <Badge key={t} variant="outline" className="font-normal">{t}</Badge>
              ))
            ) : (
              <span className="text-muted-foreground">nenhuma</span>
            )}
          </div>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground">
        Fórmula: bigramas × 0,5 + sobreposição × 0,4 + contenção × 0,1. Registros acima do limiar
        são marcados como confirmados; entre 60% e 100% do limiar ficam como duvidosos.
      </p>
    </div>
  );
};

export default FuzzyMatchExplanation;
