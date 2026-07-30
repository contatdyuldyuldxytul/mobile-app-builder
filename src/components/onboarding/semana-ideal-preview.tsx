import { WEEKDAYS } from "@/lib/dates";
import { A_CLASSIFICAR } from "@/lib/areas";
import { cn } from "@/lib/utils";
import { Trash2 } from "lucide-react";
import type { RoutinePattern } from "@/lib/routine-detect";

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
  if (!padroes.length) {
    return (
      <p className="rounded-2xl border border-dashed p-5 text-sm text-muted-foreground">
        Nada por aqui ainda. Volte e distribua algumas horas — eu monto os blocos.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {WEEKDAYS.map((dia, i) => {
        const doDia = padroes
          .map((p, index) => ({ p, index }))
          .filter(({ p }) => p.dayOfWeek === i);
        if (!doDia.length) return null;
        return (
          <div key={dia}>
            <p className="text-sm text-muted-foreground">{dia}</p>
            <ul className="mt-2 space-y-2">
              {doDia.map(({ p, index }) => (
                <li
                  key={`${p.title}-${index}`}
                  className={cn(
                    "rounded-xl border bg-card px-3 py-2.5",
                    p.area === A_CLASSIFICAR && "border-dashed border-primary/60",
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs text-muted-foreground">
                      {p.startTime}–{p.endTime}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm">{p.title}</span>
                    <button
                      type="button"
                      aria-label="Remover bloco"
                      onClick={() => onRemover(index)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {areas.map((area) => (
                      <button
                        key={area}
                        type="button"
                        onClick={() => onArea(index, area)}
                        className={cn(
                          "rounded-full border px-2.5 py-1 text-xs text-muted-foreground",
                          p.area === area && "border-primary bg-primary/10 text-foreground",
                        )}
                      >
                        {area}
                      </button>
                    ))}
                  </div>
                  {p.area === A_CLASSIFICAR && (
                    <p className="mt-2 text-xs text-primary">
                      A classificar — escolha a área em um toque.
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}