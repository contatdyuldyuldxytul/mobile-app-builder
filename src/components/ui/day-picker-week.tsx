import { cn } from "@/lib/utils";

const CURTO = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

/** Sete dias numa grade que cabe na tela — sem rolagem lateral. */
export function DayPickerWeek({
  value,
  onChange,
  single = false,
  className,
  alerta = [],
}: {
  value: number[];
  onChange: (dias: number[]) => void;
  single?: boolean;
  className?: string;
  /** Dias que estouraram a capacidade — aparecem marcados em vermelho. */
  alerta?: number[];
}) {
  return (
    <div className={cn("grid grid-cols-7 gap-1", className)}>
      {CURTO.map((d, i) => {
        const ativo = value.includes(i);
        const cheio = alerta.includes(i);
        return (
          <button
            key={d}
            type="button"
            aria-pressed={ativo}
            onClick={() =>
              onChange(
                single
                  ? [i]
                  : ativo
                    ? value.filter((x) => x !== i)
                    : [...value, i].sort((a, b) => a - b),
              )
            }
            className={cn(
              "h-11 rounded-xl border text-xs text-muted-foreground transition-colors",
              ativo && "border-primary bg-primary text-primary-foreground",
              cheio && "border-destructive bg-destructive text-destructive-foreground",
            )}
          >
            {d}
          </button>
        );
      })}
    </div>
  );
}
