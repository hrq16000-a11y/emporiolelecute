import { Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  isChoiceType,
  type PersonalizationOption,
  type PersonalizationValues,
} from "@/lib/personalizationOptions";

interface Props {
  options: PersonalizationOption[];
  values: PersonalizationValues;
  onChange: (values: PersonalizationValues) => void;
}

/** Renderiza as condições de personalização configuradas pelo admin no PDP. */
const ProductPersonalizationOptions = ({ options, values, onChange }: Props) => {
  if (!options.length) return null;

  const set = (id: string, value: string) => onChange({ ...values, [id]: value });

  return (
    <div className="space-y-5">
      {options.map((option) => {
        const selected = values[option.id] || "";
        return (
          <div key={option.id} className="space-y-2">
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-medium text-foreground">{option.label}</span>
              {option.required && <span className="text-xs text-primary">obrigatório</span>}
            </div>
            {option.help && <p className="text-xs text-muted-foreground">{option.help}</p>}

            {option.type === "text" && (
              <Input
                value={selected}
                maxLength={option.max_length || undefined}
                placeholder={option.placeholder || ""}
                onChange={(e) => set(option.id, e.target.value)}
                className="border-border/40"
              />
            )}

            {isChoiceType(option.type) && (
              <div
                role="radiogroup"
                aria-label={option.label}
                className={cn(
                  "flex flex-wrap gap-2",
                  option.type === "image" && "gap-3",
                )}
              >
                {(option.choices || []).map((choice) => {
                  const active = selected === choice.id;
                  const commonProps = {
                    type: "button" as const,
                    role: "radio",
                    "aria-checked": active,
                    onClick: () => set(option.id, active ? "" : choice.id),
                  };

                  if (option.type === "color") {
                    return (
                      <button
                        key={choice.id}
                        {...commonProps}
                        title={choice.label}
                        className={cn(
                          "flex min-h-[44px] items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition-colors",
                          active ? "border-primary bg-primary/10 text-foreground" : "border-border/60 text-muted-foreground",
                        )}
                      >
                        <span
                          className="h-5 w-5 rounded-full border border-border/60"
                          style={{ backgroundColor: choice.value || "transparent" }}
                          aria-hidden
                        />
                        {choice.label}
                        {active && <Check className="h-3.5 w-3.5 text-primary" aria-hidden />}
                      </button>
                    );
                  }

                  if (option.type === "image") {
                    return (
                      <button
                        key={choice.id}
                        {...commonProps}
                        className={cn(
                          "w-20 overflow-hidden rounded-lg border text-[11px] transition-colors",
                          active ? "border-primary ring-2 ring-primary/30" : "border-border/60",
                        )}
                      >
                        <span className="block aspect-square bg-muted">
                          {choice.value && (
                            <img
                              src={choice.value}
                              alt={choice.label}
                              loading="lazy"
                              decoding="async"
                              className="h-full w-full object-cover"
                            />
                          )}
                        </span>
                        <span className="block truncate px-1 py-1 text-center text-muted-foreground">
                          {choice.label}
                        </span>
                      </button>
                    );
                  }

                  return (
                    <button
                      key={choice.id}
                      {...commonProps}
                      className={cn(
                        "min-h-[44px] rounded-full border px-4 py-1.5 text-xs transition-colors",
                        active
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-border/60 text-muted-foreground hover:border-primary/40",
                      )}
                    >
                      {choice.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default ProductPersonalizationOptions;
