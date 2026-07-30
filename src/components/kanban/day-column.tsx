import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = {
  id: string;
  titulo: string;
  legenda?: ReactNode;
  ids: string[];
  vazio: string;
  children: ReactNode;
};

export function DayColumn({ id, titulo, legenda, ids, vazio, children }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <section
      ref={setNodeRef}
      className={cn(
        "rounded-2xl border bg-muted/30 p-3 transition-colors",
        isOver && "border-primary bg-primary/5",
      )}
    >
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-medium">{titulo}</h3>
        <span className="text-xs text-muted-foreground">{legenda}</span>
      </div>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <ul className="space-y-2">{children}</ul>
      </SortableContext>
      {ids.length === 0 && (
        <p className="py-4 text-center text-xs text-muted-foreground">{vazio}</p>
      )}
    </section>
  );
}
