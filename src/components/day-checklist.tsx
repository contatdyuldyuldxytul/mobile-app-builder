import { useMemo, useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Check, Coffee, GripVertical, Plus, Scissors, Trash2, WandSparkles } from "lucide-react";
import { toMinutes, toTime, formatDuration } from "@/lib/scheduler";
import { hhmm, type Block, type Domain } from "@/lib/day-schedule";
import { areaIcon, areaTint } from "@/lib/area-icons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const FOCO_MINUTOS = 120;

type Grupo =
  | { tipo: "foco"; inicio: number; fim: number; itens: Block[] }
  | { tipo: "pausa"; bloco: Block };

/** Agrupa as atividades em blocos de foco de 2h; as pausas ficam fora. */
export function agruparEmFocos(blocks: Block[]): Grupo[] {
  const ordenados = [...blocks].sort((a, b) => a.start_time.localeCompare(b.start_time));
  const grupos: Grupo[] = [];
  let atual: Extract<Grupo, { tipo: "foco" }> | null = null;

  for (const b of ordenados) {
    const ini = toMinutes(hhmm(b.start_time));
    const fim = toMinutes(hhmm(b.end_time));
    if (b.block_kind === "pausa") {
      atual = null;
      grupos.push({ tipo: "pausa", bloco: b });
      continue;
    }
    if (!atual || fim - atual.inicio > FOCO_MINUTOS) {
      atual = { tipo: "foco", inicio: ini, fim, itens: [b] };
      grupos.push(atual);
    } else {
      atual.itens.push(b);
      atual.fim = Math.max(atual.fim, fim);
    }
  }
  return grupos;
}

export function DayChecklist({
  blocks,
  domains,
  onToggle,
  onSplit,
  onDelete,
  onReorder,
  onAdd,
  onTidy,
}: {
  blocks: Block[];
  domains: Domain[];
  onToggle: (b: Block, done: boolean) => void;
  onSplit: (b: Block) => void;
  onDelete: (b: Block) => void;
  onReorder: (ids: string[]) => void;
  onAdd: () => void;
  onTidy: () => void;
}) {
  const [aberto, setAberto] = useState<string | null>(null);
  const grupos = useMemo(() => agruparEmFocos(blocks), [blocks]);
  const ordem = useMemo(
    () =>
      [...blocks]
        .sort((a, b) => a.start_time.localeCompare(b.start_time))
        .filter((b) => b.block_kind !== "pausa")
        .map((b) => b.id),
    [blocks],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function aoSoltar(e: DragEndEvent) {
    if (!e.over || e.active.id === e.over.id) return;
    const de = ordem.indexOf(String(e.active.id));
    const para = ordem.indexOf(String(e.over.id));
    if (de < 0 || para < 0) return;
    onReorder(arrayMove(ordem, de, para));
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-xl">Seu dia</h2>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={onTidy}>
            <WandSparkles className="h-4 w-4" /> Arrumar
          </Button>
          <Button size="sm" variant="outline" onClick={onAdd}>
            <Plus className="h-4 w-4" /> Bloco
          </Button>
        </div>
      </div>

      {blocks.length === 0 && (
        <p className="rounded-2xl border border-dashed bg-muted/40 px-4 py-6 text-center text-sm text-muted-foreground">
          Nenhuma atividade hoje ainda.
        </p>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis]}
        onDragEnd={aoSoltar}
      >
        <SortableContext items={ordem} strategy={verticalListSortingStrategy}>
          <div className="space-y-3">
            {grupos.map((g, i) =>
              g.tipo === "pausa" ? (
                <CartaoPausa key={g.bloco.id} b={g.bloco} />
              ) : (
                <div key={`foco-${i}-${g.itens[0].id}`} className="relative pl-4">
                  <span
                    aria-hidden
                    className="absolute inset-y-1 left-0 w-2.5 rounded-l-xl border-y-2 border-l-2 border-secondary/40"
                  />
                  <p className="mb-1.5 pl-1 font-mono text-[0.68rem] uppercase tracking-wide text-muted-foreground">
                    Foco {toTime(g.inicio)}–{toTime(g.fim)}
                  </p>
                  <div className="space-y-2">
                    {g.itens.map((b) => (
                      <CartaoAtividade
                        key={b.id}
                        b={b}
                        cor={domains.find((d) => d.id === b.domain_id)?.color}
                        area={domains.find((d) => d.id === b.domain_id)?.name}
                        expandido={aberto === b.id}
                        onAbrir={() => setAberto(aberto === b.id ? null : b.id)}
                        onToggle={onToggle}
                        onSplit={onSplit}
                        onDelete={onDelete}
                      />
                    ))}
                  </div>
                </div>
              ),
            )}
          </div>
        </SortableContext>
      </DndContext>
    </section>
  );
}

function CartaoPausa({ b }: { b: Block }) {
  const ini = toMinutes(hhmm(b.start_time));
  const fim = toMinutes(hhmm(b.end_time));
  return (
    <div className="ml-4 flex items-center gap-2 rounded-xl border border-dashed bg-muted/30 px-3 py-1.5">
      <Coffee className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <span className="truncate text-xs text-muted-foreground">
        Pausa · {formatDuration(fim - ini)}
      </span>
      <span className="ml-auto font-mono text-[0.68rem] text-muted-foreground">
        {toTime(ini)}–{toTime(fim)}
      </span>
    </div>
  );
}

function CartaoAtividade({
  b,
  cor,
  area,
  expandido,
  onAbrir,
  onToggle,
  onSplit,
  onDelete,
}: {
  b: Block;
  cor?: string;
  area?: string;
  expandido: boolean;
  onAbrir: () => void;
  onToggle: (b: Block, done: boolean) => void;
  onSplit: (b: Block) => void;
  onDelete: (b: Block) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: b.id,
  });
  const Icone = areaIcon(area, b.title);
  const feito = b.completed;
  const ini = toMinutes(hhmm(b.start_time));
  const fim = toMinutes(hhmm(b.end_time));

  return (
    <article
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex items-center gap-3 rounded-2xl bg-card p-3 shadow-sm transition-opacity duration-150",
        feito && "opacity-70",
        isDragging && "z-30 opacity-90 shadow-lg ring-2 ring-secondary/40",
      )}
    >
      <button
        type="button"
        aria-label="Reordenar"
        className="grid h-8 w-8 shrink-0 cursor-grab touch-none place-items-center rounded-full border text-muted-foreground active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <span
        aria-hidden
        className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl"
        style={{ backgroundColor: areaTint(cor) }}
      >
        <Icone className="h-5 w-5" style={{ color: cor ?? "var(--foreground)" }} />
      </span>

      <button type="button" onClick={onAbrir} className="min-w-0 flex-1 text-left">
        <span className={cn("block truncate font-semibold", feito && "line-through")}>
          {b.title}
        </span>
        <span className="block font-mono text-xs text-muted-foreground">
          {toTime(ini)} – {toTime(fim)}
        </span>
      </button>

      {expandido ? (
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            aria-label="Dividir ao meio"
            onClick={() => onSplit(b)}
            className="grid h-9 w-9 place-items-center rounded-xl border"
          >
            <Scissors className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Excluir"
            onClick={() => onDelete(b)}
            className="grid h-9 w-9 place-items-center rounded-xl border text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          aria-label={feito ? "Desmarcar" : "Concluir"}
          onClick={() => onToggle(b, !feito)}
          className={cn(
            "grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 transition-colors duration-150 active:scale-90",
            feito ? "border-secondary bg-secondary text-secondary-foreground" : "border-muted",
          )}
        >
          <Check className={cn("h-4 w-4", !feito && "opacity-0")} />
        </button>
      )}
    </article>
  );
}
