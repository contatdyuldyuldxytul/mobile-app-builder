import { useMemo, useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  useDroppable,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Check,
  ChevronDown,
  ChevronsUpDown,
  Coffee,
  Combine,
  Copy,
  CalendarArrowDown,
  GripVertical,
  Minus,
  Plus,
  Scissors,
  Trash2,
  WandSparkles,
} from "lucide-react";
import { toMinutes, toTime, formatDuration } from "@/lib/scheduler";
import { hhmm, type Block, type Domain } from "@/lib/day-schedule";
import { areaIcon, areaTint } from "@/lib/area-icons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const FOCO_MINUTOS = 120;

/** Quantos cartões cabem visíveis em um colchete antes do "ver mais". */
export const MAX_POR_FOCO = 4;

export type Movimento = {
  id: string;
  bandStart: number;
  bandEnd: number;
  beforeId?: string | null;
};

/** Altura fixa do miolo de cada colchete: todo bloco de foco ocupa o mesmo espaço. */
const ALTURA_FOCO = 208;

/** Pedaço de um bloco dentro de uma faixa de 2h. Recorte visual: o id é o mesmo. */
export type Segmento = {
  bloco: Block;
  ini: number;
  fim: number;
  primeiro: boolean;
  continua: boolean;
};

type Grupo =
  | { tipo: "foco"; idx: number; inicio: number; fim: number; itens: Segmento[] }
  | { tipo: "pausa"; bloco: Block };

/**
 * Divide o dia em faixas fixas de 2h ancoradas no relógio (06–08, 08–10, ...).
 * Cada atividade pertence a uma única faixa; as pausas ficam fora dos colchetes.
 */
export function agruparEmFocos(blocks: Block[], dayStart = "06:00"): Grupo[] {
  const ordenados = [...blocks].sort((a, b) => a.start_time.localeCompare(b.start_time));
  const atividades = ordenados.filter((b) => b.block_kind !== "pausa");
  const pausas = ordenados.filter((b) => b.block_kind === "pausa");
  if (!atividades.length) return ordenados.map((b) => ({ tipo: "pausa", bloco: b }) as Grupo);

  const inicios = atividades.map((b) => toMinutes(hhmm(b.start_time)));
  const fins = atividades.map((b) => toMinutes(hhmm(b.end_time)));
  const ultimo = Math.max(...fins);
  void dayStart;

  const idxIni = Math.floor(Math.min(...inicios) / FOCO_MINUTOS);
  const idxFim = Math.ceil(ultimo / FOCO_MINUTOS) - 1;

  const grupos: Grupo[] = [];
  for (let idx = idxIni; idx <= idxFim; idx++) {
    const inicio = idx * FOCO_MINUTOS;
    const fim = inicio + FOCO_MINUTOS;
    const itens: Segmento[] = [];
    for (const b of atividades) {
      const bi = toMinutes(hhmm(b.start_time));
      const bf = toMinutes(hhmm(b.end_time));
      if (bi < inicio || bi >= fim) continue;
      // A agenda normaliza os dados antes de renderizar. Mesmo durante uma
      // atualização otimista, nunca recortamos um cartão em dois colchetes.
      itens.push({ bloco: b, ini: bi, fim: Math.min(bf, fim), primeiro: true, continua: false });
    }
    itens.sort((a, b) => a.ini - b.ini);
    // Pausa que cai na virada do relógio é o respiro ENTRE os colchetes.
    for (const p of pausas) {
      if (toMinutes(hhmm(p.start_time)) === inicio) grupos.push({ tipo: "pausa", bloco: p });
    }
    grupos.push({ tipo: "foco", idx, inicio, fim, itens });
    for (const p of pausas) {
      const pi = toMinutes(hhmm(p.start_time));
      if (pi > inicio && pi < fim) grupos.push({ tipo: "pausa", bloco: p });
    }
  }
  return grupos;
}

export function DayChecklist({
  blocks,
  domains,
  dayStart = "06:00",
  onToggle,
  onSplit,
  onDelete,
  onMove,
  onMerge,
  onAdd,
  onTidy,
  onResize,
  onTomorrow,
  onDuplicate,
  onPushPending,
  onEdit,
}: {
  blocks: Block[];
  domains: Domain[];
  dayStart?: string;
  onToggle: (b: Block, done: boolean) => void;
  onSplit: (b: Block) => void;
  onDelete: (b: Block) => void;
  /** Move UMA atividade para a faixa escolhida. */
  onMove: (m: Movimento) => void;
  /** Une os pedaços da mesma atividade dentro de um colchete. */
  onMerge: (ids: string[]) => void;
  onAdd: () => void;
  onTidy: () => void;
  /** Nova duração do bloco, em minutos. */
  onResize?: (b: Block, minutos: number) => void;
  /** Manda a atividade para amanhã, no mesmo horário. */
  onTomorrow?: (b: Block) => void;
  /** Cria uma cópia da atividade no próximo espaço livre. */
  onDuplicate?: (b: Block) => void;
  /** Empurra para amanhã tudo que não foi feito. */
  onPushPending?: () => void;
  /** Abre o editor completo da atividade. */
  onEdit: (b: Block) => void;
}) {
  const [aberto, setAberto] = useState<string | null>(null);
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [alvo, setAlvo] = useState<number | null>(null);
  const grupos = useMemo(() => agruparEmFocos(blocks, dayStart), [blocks, dayStart]);
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

  const focos = useMemo(
    () => grupos.filter((g): g is Extract<Grupo, { tipo: "foco" }> => g.tipo === "foco"),
    [grupos],
  );

  /** Qual colchete está sob o dedo agora — usado para o brilho e para soltar. */
  function faixaDe(overId: string | null): number | null {
    if (!overId) return null;
    if (overId.startsWith("faixa-")) return Number(overId.slice(6));
    const g = focos.find((f) => f.itens.some((s) => s.bloco.id === overId));
    return g ? g.idx : null;
  }

  function aoComecar(e: DragStartEvent) {
    setArrastando(String(e.active.id));
  }

  function aoPassar(e: DragOverEvent) {
    setAlvo(faixaDe(e.over ? String(e.over.id) : null));
  }

  function aoSoltar(e: DragEndEvent) {
    setArrastando(null);
    setAlvo(null);
    if (!e.over) return;
    const ativo = String(e.active.id);
    const sobre = String(e.over.id);
    if (ativo === sobre) return;
    if (!ordem.includes(ativo)) return;

    const idx = faixaDe(sobre);
    if (idx === null) return;
    const faixa = focos.find((f) => f.idx === idx);
    if (!faixa) return;

    // Soltou em cima de um cartão: o bloco entra logo antes dele.
    const emCima = faixa.itens.find((s) => s.bloco.id === sobre)?.bloco.id ?? null;
    onMove({
      id: ativo,
      bandStart: faixa.inicio,
      bandEnd: faixa.fim,
      beforeId: emCima && emCima !== ativo ? emCima : null,
    });
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
        onDragStart={aoComecar}
        onDragOver={aoPassar}
        onDragCancel={() => {
          setArrastando(null);
          setAlvo(null);
        }}
        onDragEnd={aoSoltar}
      >
        <SortableContext items={ordem} strategy={verticalListSortingStrategy}>
          <div className="space-y-3">
            {grupos.map((g, i) =>
              g.tipo === "pausa" ? (
                <CartaoPausa key={g.bloco.id} b={g.bloco} onToggle={onToggle} />
              ) : (
                <Colchete
                  key={`foco-${g.idx}-${i}`}
                  g={g}
                  destacado={arrastando !== null && alvo === g.idx}
                  arrastando={arrastando}
                  domains={domains}
                  aberto={aberto}
                  setAberto={setAberto}
                  onToggle={onToggle}
                  onSplit={onSplit}
                  onDelete={onDelete}
                  onMerge={onMerge}
                  onResize={onResize}
                  onTomorrow={onTomorrow}
                  onDuplicate={onDuplicate}
                  onEdit={onEdit}
                />
              ),
            )}
          </div>
        </SortableContext>
      </DndContext>

      {onPushPending && blocks.some((b) => b.block_kind !== "pausa" && !b.completed) && (
        <Button variant="outline" size="sm" className="w-full" onClick={onPushPending}>
          <CalendarArrowDown className="h-4 w-4" /> Empurrar o que não foi feito para amanhã
        </Button>
      )}
    </section>
  );
}

function Colchete({
  g,
  destacado,
  arrastando,
  domains,
  aberto,
  setAberto,
  onToggle,
  onSplit,
  onDelete,
  onMerge,
  onResize,
  onTomorrow,
  onDuplicate,
  onEdit,
}: {
  g: Extract<Grupo, { tipo: "foco" }>;
  destacado: boolean;
  arrastando: string | null;
  domains: Domain[];
  aberto: string | null;
  setAberto: (id: string | null) => void;
  onToggle: (b: Block, done: boolean) => void;
  onSplit: (b: Block) => void;
  onDelete: (b: Block) => void;
  onMerge: (ids: string[]) => void;
  onResize?: (b: Block, minutos: number) => void;
  onTomorrow?: (b: Block) => void;
  onDuplicate?: (b: Block) => void;
  onEdit: (b: Block) => void;
}) {
  const { setNodeRef } = useDroppable({ id: `faixa-${g.idx}` });
  const [expandido, setExpandido] = useState(false);
  const densidade = g.itens.length >= 4 ? "compacto" : g.itens.length >= 2 ? "medio" : "cheio";
  const ocupado = g.itens.reduce((s, x) => s + (x.fim - x.ini), 0);
  const livre = Math.max(0, FOCO_MINUTOS - ocupado);

  const visiveis = expandido ? g.itens : g.itens.slice(0, MAX_POR_FOCO);
  const escondidos = g.itens.length - visiveis.length;

  /** Pedaços da mesma atividade repetidos nesta faixa — dá para unir em um. */
  const repetidos = useMemo(() => {
    const porTitulo = new Map<string, string[]>();
    for (const s of g.itens) {
      const ids = porTitulo.get(s.bloco.title) ?? [];
      if (!ids.includes(s.bloco.id)) ids.push(s.bloco.id);
      porTitulo.set(s.bloco.title, ids);
    }
    return [...porTitulo.values()].filter((ids) => ids.length > 1);
  }, [g.itens]);

  return (
    <div className="relative pl-4">
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-1 left-0 w-2.5 rounded-l-xl border-y-2 border-l-2 transition-colors duration-200",
          destacado ? "border-secondary" : "border-secondary/40",
        )}
      />
      <div className="mb-1.5 flex items-center justify-between gap-2 pl-1">
        <p className="font-mono text-[0.68rem] uppercase tracking-wide text-muted-foreground">
          Foco {toTime(g.inicio)}–{toTime(g.fim)}
        </p>
        {repetidos.length > 0 && (
          <button
            type="button"
            onClick={() => repetidos.forEach((ids) => onMerge(ids))}
            className="flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.68rem] text-muted-foreground"
          >
            <Combine className="h-3 w-3" /> Unificar
          </button>
        )}
      </div>
      <div
        ref={setNodeRef}
        style={{ height: ALTURA_FOCO }}
        className={cn(
          "flex flex-col gap-2 rounded-2xl p-1 transition-all duration-200",
          expandido ? "h-auto overflow-visible" : "overflow-hidden",
          destacado && "bg-secondary/10 ring-2 ring-secondary/60",
          !destacado && arrastando !== null && "ring-1 ring-dashed ring-border",
        )}
      >
        {visiveis.map((s) => (
          <CartaoAtividade
            key={`${s.bloco.id}-${s.ini}`}
            s={s}
            densidade={densidade}
            cor={domains.find((d) => d.id === s.bloco.domain_id)?.color}
            area={domains.find((d) => d.id === s.bloco.domain_id)?.name}
            expandido={false}
            onAbrir={() => onEdit(s.bloco)}
            onToggle={onToggle}
            onSplit={onSplit}
            onDelete={onDelete}
            onResize={onResize}
            onTomorrow={onTomorrow}
            onDuplicate={onDuplicate}
          />
        ))}
        {escondidos > 0 && (
          <button
            type="button"
            onClick={() => setExpandido(true)}
            className="flex shrink-0 items-center justify-center gap-1 rounded-xl border border-dashed py-1 text-xs text-muted-foreground"
          >
            <ChevronDown className="h-3.5 w-3.5" /> +{escondidos} atividade
            {escondidos === 1 ? "" : "s"}
          </button>
        )}
        {livre > 0 && escondidos === 0 && (
          <div
            aria-hidden
            style={{ flexGrow: livre, flexBasis: 0 }}
            className="min-h-[18px] rounded-xl border border-dashed border-border/60"
          />
        )}
      </div>
    </div>
  );
}

function CartaoPausa({ b, onToggle }: { b: Block; onToggle: (b: Block, done: boolean) => void }) {
  const ini = toMinutes(hhmm(b.start_time));
  const fim = toMinutes(hhmm(b.end_time));
  return (
    <div className="flex min-h-11 items-center gap-2 px-1 py-1">
      <span className="h-px flex-1 border-t border-dashed border-border" />
      <Coffee className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <span className="whitespace-nowrap text-xs text-muted-foreground">
        Pausa · {formatDuration(fim - ini)}
      </span>
      <span className="whitespace-nowrap font-mono text-[0.68rem] text-muted-foreground">
        {toTime(ini)}–{toTime(fim)}
      </span>
      <button
        type="button"
        aria-label={b.completed ? "Desmarcar pausa" : "Concluir pausa"}
        onClick={() => onToggle(b, !b.completed)}
        className={cn(
          "grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 transition-all active:scale-90",
          b.completed
            ? "border-secondary bg-secondary text-secondary-foreground"
            : "border-muted bg-card",
        )}
      >
        <Check className={cn("h-4 w-4", !b.completed && "opacity-0")} />
      </button>
      <span className="h-px flex-1 border-t border-dashed border-border" />
    </div>
  );
}

function CartaoAtividade({
  s,
  densidade,
  cor,
  area,
  expandido,
  onAbrir,
  onToggle,
  onSplit,
  onDelete,
  onResize,
  onTomorrow,
  onDuplicate,
}: {
  s: Segmento;
  densidade: "cheio" | "medio" | "compacto";
  cor?: string;
  area?: string;
  expandido: boolean;
  onAbrir: () => void;
  onToggle: (b: Block, done: boolean) => void;
  onSplit: (b: Block) => void;
  onDelete: (b: Block) => void;
  onResize?: (b: Block, minutos: number) => void;
  onTomorrow?: (b: Block) => void;
  onDuplicate?: (b: Block) => void;
}) {
  const b = s.bloco;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: b.id,
    disabled: !s.primeiro,
  });
  const Icone = areaIcon(area, b.title);
  const feito = b.completed;
  const ini = s.ini;
  const fim = s.fim;
  const duracao = fim - ini;
  const compacto = densidade === "compacto" || duracao < 45;
  const total = toMinutes(hhmm(b.end_time)) - toMinutes(hhmm(b.start_time));
  const [previa, setPrevia] = useState<number | null>(null);
  const podeEsticar = !!onResize && s.primeiro && !s.continua;
  const [desliza, setDesliza] = useState(0);

  /** Deslizar: direita marca como feito, esquerda adia para amanhã. */
  function aoDeslizar(e: React.PointerEvent) {
    if (e.pointerType === "mouse") return;
    const x0 = e.clientX;
    const y0 = e.clientY;
    let horizontal = false;
    const alvo = e.currentTarget as HTMLElement;

    const mover = (ev: PointerEvent) => {
      const dx = ev.clientX - x0;
      const dy = ev.clientY - y0;
      if (!horizontal && Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy)) {
        horizontal = true;
        alvo.setPointerCapture(ev.pointerId);
      }
      if (horizontal) setDesliza(Math.max(-120, Math.min(120, dx)));
    };
    const soltar = () => {
      alvo.removeEventListener("pointermove", mover);
      alvo.removeEventListener("pointerup", soltar);
      alvo.removeEventListener("pointercancel", soltar);
      setDesliza((dx) => {
        if (dx > 80) onToggle(b, !feito);
        else if (dx < -80) onTomorrow?.(b);
        return 0;
      });
    };
    alvo.addEventListener("pointermove", mover);
    alvo.addEventListener("pointerup", soltar);
    alvo.addEventListener("pointercancel", soltar);
  }

  /** Arrasta a borda de baixo: cada 2h do colchete equivalem a ALTURA_FOCO px. */
  function aoPegarBorda(e: React.PointerEvent) {
    if (!onResize) return;
    e.preventDefault();
    e.stopPropagation();
    const y0 = e.clientY;
    const base = total;
    const alvo = e.currentTarget as HTMLElement;
    alvo.setPointerCapture(e.pointerId);

    const emMinutos = (dy: number) =>
      Math.max(30, Math.round((base + (dy * FOCO_MINUTOS) / ALTURA_FOCO) / 15) * 15);

    const mover = (ev: PointerEvent) => setPrevia(emMinutos(ev.clientY - y0));
    const soltar = (ev: PointerEvent) => {
      alvo.removeEventListener("pointermove", mover);
      alvo.removeEventListener("pointerup", soltar);
      alvo.removeEventListener("pointercancel", soltar);
      const novo = emMinutos(ev.clientY - y0);
      setPrevia(null);
      if (novo !== base) onResize(b, novo);
    };
    alvo.addEventListener("pointermove", mover);
    alvo.addEventListener("pointerup", soltar);
    alvo.addEventListener("pointercancel", soltar);
  }

  return (
    <article
      ref={setNodeRef}
      onPointerDown={aoDeslizar}
      style={{
        transform: desliza
          ? `translateX(${desliza}px)`
          : CSS.Transform.toString(transform),
        transition: desliza ? "none" : transition,
        flexGrow: previa ?? duracao,
        flexBasis: 0,
      }}
      className={cn(
        "relative flex min-h-0 items-center gap-3 overflow-hidden rounded-2xl bg-card shadow-sm transition-opacity duration-150",
        compacto ? "gap-2 px-2.5 py-1" : "p-3",
        feito && "opacity-70",
        !s.primeiro && "border-l-4 border-dashed border-secondary/50",
        previa !== null && "ring-2 ring-secondary",
        isDragging && "z-30 opacity-90 shadow-lg ring-2 ring-secondary/40",
      )}
    >
      <button
        type="button"
        aria-label="Reordenar"
        className={cn(
          "grid shrink-0 cursor-grab touch-none place-items-center rounded-full border text-muted-foreground active:cursor-grabbing",
          compacto ? "h-7 w-7" : "h-8 w-8",
          !s.primeiro && "invisible",
        )}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <span
        aria-hidden
        className={cn(
          "grid shrink-0 place-items-center rounded-2xl",
          densidade === "cheio" ? "h-11 w-11" : densidade === "medio" ? "h-9 w-9" : "h-8 w-8",
        )}
        style={{ backgroundColor: areaTint(cor) }}
      >
        <Icone
          className={cn(compacto ? "h-4 w-4" : "h-5 w-5")}
          style={{ color: cor ?? "var(--foreground)" }}
        />
      </span>

      <button
        type="button"
        onClick={onAbrir}
        className={cn("min-w-0 flex-1 text-left", compacto && "flex items-baseline gap-2")}
      >
        <span
          className={cn(
            "block truncate font-semibold",
            compacto && "text-sm",
            feito && "line-through",
          )}
        >
          {b.title}
        </span>
        <span
          className={cn(
            "block shrink-0 font-mono text-muted-foreground",
            compacto ? "text-[0.65rem]" : "text-xs",
          )}
        >
          {toTime(ini)}
          {compacto ? "" : ` – ${toTime(fim)}`}
          {s.continua && !compacto ? " →" : ""}
          {previa !== null ? ` · ${formatDuration(previa)}` : ""}
        </span>
      </button>

      {expandido ? (
        <div className="flex shrink-0 items-center gap-1">
          {onTomorrow && (
            <button
              type="button"
              aria-label="Mover para amanhã"
              onClick={() => onTomorrow(b)}
              className={cn(
                "grid place-items-center rounded-xl border",
                compacto ? "h-8 w-8" : "h-9 w-9",
              )}
            >
              <CalendarArrowDown className="h-4 w-4" />
            </button>
          )}
          {onDuplicate && (
            <button
              type="button"
              aria-label="Duplicar"
              onClick={() => onDuplicate(b)}
              className={cn(
                "grid place-items-center rounded-xl border",
                compacto ? "h-8 w-8" : "h-9 w-9",
              )}
            >
              <Copy className="h-4 w-4" />
            </button>
          )}
          {podeEsticar && (
            <>
              <button
                type="button"
                aria-label="Menos 15 minutos"
                onClick={() => onResize?.(b, Math.max(30, total - 15))}
                className={cn(
                  "grid place-items-center rounded-xl border",
                  compacto ? "h-8 w-8" : "h-9 w-9",
                )}
              >
                <Minus className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label="Mais 15 minutos"
                onClick={() => onResize?.(b, total + 15)}
                className={cn(
                  "grid place-items-center rounded-xl border",
                  compacto ? "h-8 w-8" : "h-9 w-9",
                )}
              >
                <Plus className="h-4 w-4" />
              </button>
            </>
          )}
          <button
            type="button"
            aria-label="Dividir ao meio"
            onClick={() => onSplit(b)}
            className={cn(
              "grid place-items-center rounded-xl border",
              compacto ? "h-8 w-8" : "h-9 w-9",
            )}
          >
            <Scissors className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Excluir"
            onClick={() => onDelete(b)}
            className={cn(
              "grid place-items-center rounded-xl border text-destructive",
              compacto ? "h-8 w-8" : "h-9 w-9",
            )}
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
            "grid shrink-0 place-items-center rounded-full border-2 transition-colors duration-150 active:scale-90",
            compacto ? "h-7 w-7" : "h-8 w-8",
            feito ? "border-secondary bg-secondary text-secondary-foreground" : "border-muted",
          )}
        >
          <Check className={cn("h-4 w-4", !feito && "opacity-0")} />
        </button>
      )}

      {podeEsticar && (
        <button
          type="button"
          aria-label="Esticar duração"
          onPointerDown={aoPegarBorda}
          className="absolute inset-x-0 bottom-0 grid h-4 cursor-ns-resize touch-none place-items-center text-muted-foreground/60 hover:text-secondary"
        >
          <ChevronsUpDown className="h-3 w-3" />
        </button>
      )}
    </article>
  );
}
