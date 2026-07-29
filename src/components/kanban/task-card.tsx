import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Check, CoffeeIcon, GripVertical, MoveRight, Trash2 } from "lucide-react";
import type { Task } from "@/lib/data";
import type { Domain } from "@/lib/data";
import { formatDuration } from "@/lib/scheduler";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  task: Task;
  domain?: Domain;
  metaTitulo?: string;
  onMover: () => void;
  onConcluir: () => void;
  onExcluir: () => void;
};

export function TaskCard({ task, domain, metaTitulo, onMover, onConcluir, onExcluir }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  });

  const feita = task.status === "feita";

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        borderLeftColor: domain?.color ?? "var(--border)",
      }}
      className={cn(
        "flex items-start gap-2 rounded-xl border-l-4 bg-card p-3 shadow-sm",
        isDragging && "opacity-60",
        feita && "opacity-60",
      )}
    >
      <button
        type="button"
        className="mt-0.5 touch-none text-muted-foreground"
        aria-label="Arrastar tarefa"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <div className="min-w-0 flex-1">
        <p className={cn("text-sm leading-snug", feita && "line-through")}>{task.title}</p>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
          {domain && (
            <span className="inline-flex items-center gap-1">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: domain.color }}
              />
              {domain.name}
            </span>
          )}
          <span>{formatDuration(task.estimated_minutes)}</span>
          {task.allows_break && <CoffeeIcon className="h-3 w-3" aria-label="Permite pausa" />}
          {metaTitulo && <span className="truncate">· {metaTitulo}</span>}
        </p>
      </div>

      <div className="flex shrink-0 gap-0.5">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onConcluir} aria-label="Concluir">
          <Check className={cn("h-3.5 w-3.5", feita && "text-primary")} />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onMover} aria-label="Mover">
          <MoveRight className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onExcluir} aria-label="Excluir">
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </li>
  );
}