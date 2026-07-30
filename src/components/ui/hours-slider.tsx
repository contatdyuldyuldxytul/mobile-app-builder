import { Slider } from "@/components/ui/slider";
import { fmtHoras } from "@/lib/format";
import { cn } from "@/lib/utils";

export { fmtHoras };

/**
 * Escolha de horas por arraste: valor grande em cima, trilho largo embaixo
 * e os limites nas pontas. Polegar grande o bastante para o dedo.
 */
export function HoursSlider({
  value,
  onChange,
  step = 0.5,
  min = 0,
  max = 24,
  suffix,
  format = fmtHoras,
  className,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
  suffix?: string;
  format?: (v: number) => string;
  className?: string;
  label?: string;
}) {
  return (
    <div className={cn("w-full space-y-2", className)}>
      <div className="text-center">
        <span className="font-mono text-3xl">{format(value)}</span>
        {suffix && <span className="ml-1.5 text-sm text-muted-foreground">{suffix}</span>}
      </div>
      <Slider
        aria-label={label ?? "Horas"}
        className="py-3 [&_[role=slider]]:h-7 [&_[role=slider]]:w-7 [&_[role=slider]]:border-2 [&_[role=slider]]:border-primary [&_[role=slider]]:shadow-md [&_[role=slider]]:active:scale-110 [&>span:first-child]:h-2"
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={([v]) => onChange(v)}
      />
      <div className="flex justify-between font-mono text-xs text-muted-foreground">
        <span>{format(min)}</span>
        <span>{format(max)}</span>
      </div>
    </div>
  );
}
