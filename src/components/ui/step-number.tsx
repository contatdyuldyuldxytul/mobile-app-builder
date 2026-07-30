import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

/** Formata horas decimais em "7h30", "8h" ou "45min". */
export function fmtHoras(h: number) {
  const min = Math.round(h * 60);
  const hh = Math.floor(min / 60);
  const mm = min % 60;
  if (hh && mm) return `${hh}h${String(mm).padStart(2, "0")}`;
  if (hh) return `${hh}h`;
  return `${mm}min`;
}

/**
 * Controle de toque com − e +. Substitui sliders: nada de arrastar,
 * área de toque grande o bastante para o celular.
 */
export function StepNumber({
  value,
  onChange,
  step = 0.5,
  min = 0,
  max = 24,
  suffix,
  format = fmtHoras,
  className,
}: {
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
  suffix?: string;
  format?: (v: number) => string;
  className?: string;
}) {
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v / step) * step));
  const botao =
    "grid h-11 w-11 shrink-0 place-items-center rounded-xl border transition-transform active:scale-90 disabled:opacity-40";

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <button
        type="button"
        aria-label="Diminuir"
        disabled={value <= min}
        onClick={() => onChange(clamp(value - step))}
        className={botao}
      >
        <Minus className="h-4 w-4" />
      </button>
      <div className="min-w-0 flex-1 text-center">
        <span className="font-mono text-2xl">{format(value)}</span>
        {suffix && <span className="ml-1.5 text-sm text-muted-foreground">{suffix}</span>}
      </div>
      <button
        type="button"
        aria-label="Aumentar"
        disabled={value >= max}
        onClick={() => onChange(clamp(value + step))}
        className={botao}
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}