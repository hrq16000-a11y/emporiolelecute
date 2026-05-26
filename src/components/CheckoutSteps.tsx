import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface Step {
  label: string;
  status: "done" | "current" | "pending";
}

interface Props {
  current: 1 | 2 | 3;
  className?: string;
}

// Indicador de progresso do checkout: 1) Carrinho 2) Dados 3) WhatsApp
const CheckoutSteps = ({ current, className }: Props) => {
  const steps: Step[] = [
    { label: "Carrinho", status: current > 1 ? "done" : "current" },
    { label: "Seus dados", status: current > 2 ? "done" : current === 2 ? "current" : "pending" },
    { label: "WhatsApp", status: current === 3 ? "current" : "pending" },
  ];

  return (
    <ol
      className={cn("flex items-center justify-between gap-2 w-full", className)}
      aria-label="Etapas do pedido"
    >
      {steps.map((step, idx) => {
        const isDone = step.status === "done";
        const isCurrent = step.status === "current";
        return (
          <li key={step.label} className="flex items-center flex-1 last:flex-none">
            <div className="flex items-center gap-2 min-w-0">
              <span
                aria-current={isCurrent ? "step" : undefined}
                className={cn(
                  "flex-shrink-0 h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold border transition-colors",
                  isDone && "bg-primary text-primary-foreground border-primary",
                  isCurrent && "bg-primary/10 text-primary border-primary",
                  !isDone && !isCurrent && "bg-muted text-muted-foreground border-border"
                )}
              >
                {isDone ? <Check className="h-4 w-4" aria-hidden="true" /> : idx + 1}
              </span>
              <span
                className={cn(
                  "text-xs sm:text-sm truncate",
                  isCurrent ? "text-foreground font-medium" : "text-muted-foreground"
                )}
              >
                {step.label}
              </span>
            </div>
            {idx < steps.length - 1 && (
              <div
                className={cn(
                  "flex-1 h-px mx-2 transition-colors",
                  isDone ? "bg-primary" : "bg-border"
                )}
                aria-hidden="true"
              />
            )}
          </li>
        );
      })}
    </ol>
  );
};

export default CheckoutSteps;
