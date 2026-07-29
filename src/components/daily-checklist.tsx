import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { formatDuration } from "@/lib/scheduler";
import { cn } from "@/lib/utils";

export type ChecklistItem = {
  id: string;
  label: string;
  done: boolean;
  color?: string;
  /** Duração estimada em minutos (tarefas). */
  minutes?: number;
  hint?: string;
  onToggle: (done: boolean) => void;
};

export function DailyChecklist({ items }: { items: ChecklistItem[] }) {
  const feitos = items.filter((i) => i.done).length;
  const minutosTotal = items.reduce((s, i) => s + (i.minutes ?? 0), 0);
  const minutosFeitos = items.filter((i) => i.done).reduce((s, i) => s + (i.minutes ?? 0), 0);

  return (
    <section className="rounded-2xl border bg-card p-5">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3">
        <h2 className="truncate text-xl">Checklist de hoje</h2>
        <span className="shrink-0 text-sm text-muted-foreground">
          {feitos} de {items.length}
        </span>
      </div>
      <Progress className="mt-3" value={items.length ? (feitos / items.length) * 100 : 0} />
      {minutosTotal > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          {formatDuration(minutosFeitos)} de {formatDuration(minutosTotal)} concluídos
        </p>
      )}

      {items.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Nada marcado para hoje. Distribua suas tarefas na aba Semana.
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {items.map((i) => (
            <li
              key={i.id}
              className="flex items-center gap-3 rounded-xl border-l-4 bg-muted/40 px-3 py-2.5"
              style={{ borderLeftColor: i.color ?? "var(--border)" }}
            >
              <Checkbox id={i.id} checked={i.done} onCheckedChange={(v) => i.onToggle(!!v)} />
              <label
                htmlFor={i.id}
                className={cn(
                  "min-w-0 flex-1 cursor-pointer text-sm",
                  i.done && "text-muted-foreground line-through",
                )}
              >
                <span className="block truncate">{i.label}</span>
                {i.hint && <span className="block text-xs text-muted-foreground">{i.hint}</span>}
              </label>
              {i.minutes ? (
                <span className="shrink-0 font-mono text-xs text-muted-foreground">
                  {formatDuration(i.minutes)}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}