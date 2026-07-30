import { useMemo, useState } from "react";
import { WEEKDAYS } from "@/lib/dates";
import { A_CLASSIFICAR, areaColor } from "@/lib/areas";
import { cn } from "@/lib/utils";
import { Trash2 } from "lucide-react";
import type { RoutinePattern } from "@/lib/routine-detect";

const CURTO = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const MIN_POR_PX = 1.1; // ~1,1 min por px de altura

function emMinutos(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function horas(min: number) {
  const h = min / 60;
  return `${h.toFixed(1).replace(".0", "")}h`;
}

export function SemanaIdealPreview({
  padroes,
  areas,
  onArea,
  onRemover,
}: {
  padroes: RoutinePattern[];
  areas: string[];
  onArea: (index: number, area: string) => void;
  onRemover: (index: number) => void;
}) {
  const [dia, setDia] = useState(0);

  const doDia = useMemo(
    () =>
      padroes
        .map((p, index) => ({ p, index }))
        .filter(({ p }) => p.dayOfWeek === dia)
        .sort((a, b) => a.p.startTime.localeCompare(b.p.startTime)),
    [padroes, dia],
  );

  const resumo = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const { p } of doDia) {
      const dur = emMinutos(p.endTime) - emMinutos(p.startTime);
      mapa.set(p.area, (mapa.get(p.area) ?? 0) + dur);
    }
    return [...mapa.entries()].sort((a, b) => b[1] - a[1]);
  }, [doDia]);

  if (!padroes.length) {
    return (
      <p className="rounded-2xl border border-dashed p-5 text-sm text-muted-foreground">
        Nada por aqui ainda. Volte e distribua algumas horas — eu monto os blocos.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {CURTO.map((d, i) => (
          <button
            key={d}
            type="button"
            onClick={() => setDia(i)}
            className={cn(
              "shrink-0 rounded-full border px-3.5 py-1.5 text-sm text-muted-foreground transition-colors",
              dia === i && "border-primary bg-primary text-primary-foreground",
            )}
          >
            {d}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {resumo.map(([area, min]) => (
          <span key={area} className="flex items-center gap-1.5">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: areaColor(area) }}
              aria-hidden
            />
            {area} · {horas(min)}
          </span>
        ))}
      </div>

      {doDia.length === 0 ? (
        <p className="rounded-2xl border border-dashed p-5 text-sm text-muted-foreground">
          {WEEKDAYS[dia]} está livre.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {doDia.map(({ p, index }) => {
            const dur = emMinutos(p.endTime) - emMinutos(p.startTime);
            const cor = areaColor(p.area);
            const aClassificar = p.area === A_CLASSIFICAR;
            return (
              <li key={`${p.title}-${index}`} className="flex gap-2">
                <span className="w-11 shrink-0 pt-1 text-right font-mono text-[0.7rem] leading-tight text-muted-foreground">
                  {p.startTime}
                </span>
                <div className="min-w-0 flex-1">
                  <div
                    className={cn(
                      "flex items-center gap-2 overflow-hidden rounded-lg border-l-4 px-3 py-1.5",
                      aClassificar && "border-dashed border border-l-4 border-primary/60",
                    )}
                    style={{
                      borderLeftColor: cor,
                      backgroundColor: `color-mix(in oklab, ${cor} 12%, transparent)`,
                      minHeight: Math.max(32, Math.round(dur / MIN_POR_PX)),
                    }}
                  >
                    <span className="min-w-0 flex-1 truncate text-sm">{p.title}</span>
                    <span className="shrink-0 font-mono text-[0.7rem] text-muted-foreground">
                      {horas(dur)}
                    </span>
                    <button
                      type="button"
                      aria-label="Remover bloco"
                      onClick={() => onRemover(index)}
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {aClassificar && (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {areas.map((area) => (
                        <button
                          key={area}
                          type="button"
                          onClick={() => onArea(index, area)}
                          className="rounded-full border px-2.5 py-1 text-xs text-muted-foreground"
                        >
                          {area}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
