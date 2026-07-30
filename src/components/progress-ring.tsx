import { cn } from "@/lib/utils";

/** Anel de progresso com a porcentagem no meio. */
export function ProgressRing({
  pct,
  size = 108,
  thickness = 12,
  className,
}: {
  pct: number;
  size?: number;
  thickness?: number;
  className?: string;
}) {
  const valor = Math.max(0, Math.min(100, Math.round(pct)));
  const raio = (size - thickness) / 2;
  const circ = 2 * Math.PI * raio;
  return (
    <div className={cn("relative shrink-0", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={raio}
          fill="none"
          strokeWidth={thickness}
          className="stroke-muted"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={raio}
          fill="none"
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ - (circ * valor) / 100}
          className="stroke-secondary transition-[stroke-dashoffset] duration-500"
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center font-mono text-xl">{valor}%</span>
    </div>
  );
}