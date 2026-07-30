import { useEffect, useMemo, useRef, useState } from "react";
import { Check, GripHorizontal, Plus, Scissors, Trash2, WandSparkles } from "lucide-react";
import { toMinutes, toTime, formatDuration } from "@/lib/scheduler";
import { STEP, hhmm, snap, type Block, type Domain } from "@/lib/day-schedule";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const PPM = 1.05; // pixels por minuto (~63px por hora)

type Arrasto = {
  id: string;
  modo: "mover" | "esticar";
  y0: number;
  inicio: number;
  fim: number;
  delta: number;
};

export function DayTimeline({
  blocks,
  domains,
  dayStart,
  dayEnd,
  onMove,
  onToggle,
  onSplit,
  onDelete,
  onAddAt,
  onTidy,
}: {
  blocks: Block[];
  domains: Domain[];
  dayStart: string;
  dayEnd: string;
  onMove: (b: Block, startMin: number, endMin: number) => void;
  onToggle: (b: Block, done: boolean) => void;
  onSplit: (b: Block) => void;
  onDelete: (b: Block) => void;
  onAddAt: (startMin: number) => void;
  onTidy: () => void;
}) {
  const inicioDia = toMinutes(dayStart);
  const fimDia = toMinutes(dayEnd);
  const alturaTotal = (fimDia - inicioDia) * PPM;
  const horas = Array.from(
    { length: Math.ceil((fimDia - inicioDia) / 60) + 1 },
    (_, i) => inicioDia + i * 60,
  ).filter((m) => m <= fimDia);

  const [arrasto, setArrasto] = useState<Arrasto | null>(null);
  const [aberto, setAberto] = useState<string | null>(null);
  const [agora, setAgora] = useState(() => nowMinutes());
  const ref = useRef<HTMLDivElement>(null);

  // Se dois blocos ocuparem a mesma hora, eles dividem a largura em colunas —
  // nada fica escondido embaixo de nada.
  const colunas = useMemo(() => calcularColunas(blocks), [blocks]);

  useEffect(() => {
    const id = setInterval(() => setAgora(nowMinutes()), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!arrasto) return;
    const mover = (e: PointerEvent) => {
      const delta = snap((e.clientY - arrasto.y0) / PPM);
      setArrasto((a) => (a && a.delta !== delta ? { ...a, delta } : a));
    };
    const soltar = () => {
      setArrasto((a) => {
        if (a) {
          const b = blocks.find((x) => x.id === a.id);
          if (b && a.delta !== 0) {
            if (a.modo === "mover") onMove(b, a.inicio + a.delta, a.fim + a.delta);
            else onMove(b, a.inicio, Math.max(a.inicio + STEP, a.fim + a.delta));
          }
        }
        return null;
      });
    };
    window.addEventListener("pointermove", mover);
    window.addEventListener("pointerup", soltar);
    window.addEventListener("pointercancel", soltar);
    return () => {
      window.removeEventListener("pointermove", mover);
      window.removeEventListener("pointerup", soltar);
      window.removeEventListener("pointercancel", soltar);
    };
  }, [arrasto, blocks, onMove]);

  function iniciar(e: React.PointerEvent, b: Block, modo: Arrasto["modo"]) {
    e.preventDefault();
    setArrasto({
      id: b.id,
      modo,
      y0: e.clientY,
      inicio: toMinutes(hhmm(b.start_time)),
      fim: toMinutes(hhmm(b.end_time)),
      delta: 0,
    });
  }

  return (
    <section className="rounded-2xl border bg-card p-3 sm:p-4">
      <div className="mb-3 flex items-center justify-between px-1">
        <h2 className="text-xl">Seu dia</h2>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={onTidy}>
            <WandSparkles className="h-4 w-4" /> Arrumar
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onAddAt(snap(Math.max(inicioDia, agora)))}
          >
            <Plus className="h-4 w-4" /> Bloco
          </Button>
        </div>
      </div>

      <div ref={ref} className="relative touch-pan-y" style={{ height: alturaTotal }}>
        {horas.map((m) => (
          <div
            key={m}
            className="absolute inset-x-0 flex items-start gap-2"
            style={{ top: (m - inicioDia) * PPM }}
          >
            <span className="-mt-2 w-11 shrink-0 text-right font-mono text-[0.68rem] text-muted-foreground">
              {toTime(m)}
            </span>
            <span className="mt-0 h-px flex-1 bg-border" />
          </div>
        ))}

        {agora >= inicioDia && agora <= fimDia && (
          <div
            className="pointer-events-none absolute inset-x-0 z-20 flex items-center gap-1 pl-11"
            style={{ top: (agora - inicioDia) * PPM }}
          >
            <span className="h-2 w-2 rounded-full bg-primary" />
            <span className="h-0.5 flex-1 bg-primary/70" />
          </div>
        )}

        <div className="absolute inset-y-0 left-12 right-0">
          {blocks.map((b) => {
            const a = arrasto?.id === b.id ? arrasto : null;
            let ini = toMinutes(hhmm(b.start_time));
            let fim = toMinutes(hhmm(b.end_time));
            if (a?.modo === "mover") {
              const dur0 = fim - ini;
              ini = Math.min(Math.max(inicioDia, ini + a.delta), fimDia - dur0);
              fim = ini + dur0;
            } else if (a?.modo === "esticar") {
              fim = Math.min(fimDia, Math.max(ini + STEP, fim + a.delta));
            }
            const dur = fim - ini;
            const dom = domains.find((d) => d.id === b.domain_id);
            const pausa = b.block_kind === "pausa";
            const feito = b.completed;
            const expandido = aberto === b.id;
            const compacto = dur < 40;
            const col = colunas[b.id] ?? { lane: 0, total: 1 };
            const geometria = {
              left: `${(col.lane / col.total) * 100}%`,
              width: `calc(${100 / col.total}% - ${col.total > 1 ? 4 : 0}px)`,
            };

            if (pausa) {
              return (
                <div
                  key={b.id}
                  className="absolute flex items-center gap-2 rounded-md border border-dashed border-secondary/50 bg-secondary/10 px-2"
                  style={{
                    ...geometria,
                    top: (ini - inicioDia) * PPM,
                    height: Math.max(14, dur * PPM - 2),
                  }}
                >
                  <span className="truncate text-[0.65rem] text-muted-foreground">
                    Pausa · {formatDuration(dur)}
                  </span>
                </div>
              );
            }

            return (
              <article
                key={b.id}
                className={cn(
                  "absolute overflow-hidden rounded-xl border-l-4 pl-2 pr-1.5 shadow-sm transition-shadow",
                  pausa ? "border-dashed bg-secondary/10" : "bg-muted/70",
                  feito && "opacity-60",
                  a && "z-30 shadow-lg ring-2 ring-primary/40",
                )}
                style={{
                  ...geometria,
                  top: (ini - inicioDia) * PPM,
                  height: Math.max(18, dur * PPM - 2),
                  borderLeftColor: pausa ? "var(--secondary)" : (dom?.color ?? "var(--border)"),
                }}
              >
                <div className={cn("flex h-full gap-2", compacto ? "items-center" : "items-start py-1")}>
                  <button
                    type="button"
                    aria-label={feito ? "Desmarcar" : "Concluir"}
                    onClick={() => onToggle(b, !feito)}
                    className={cn(
                      "grid shrink-0 place-items-center rounded-full border transition-transform active:scale-90",
                      compacto ? "h-5 w-5" : "mt-0.5 h-6 w-6",
                      feito && "border-primary bg-primary text-primary-foreground",
                    )}
                  >
                    <Check className={cn("pointer-events-none h-3.5 w-3.5", !feito && "opacity-25")} />
                  </button>

                  <button
                    type="button"
                    onClick={() => setAberto(expandido ? null : b.id)}
                    onPointerDown={(e) => iniciar(e, b, "mover")}
                    className={cn(
                      "min-w-0 flex-1 cursor-grab text-left active:cursor-grabbing",
                      compacto && "flex items-baseline gap-2",
                    )}
                  >
                    <span
                      className={cn(
                        "block truncate leading-tight",
                        compacto ? "text-xs" : "text-sm",
                        feito && "line-through",
                      )}
                    >
                      {b.title}
                    </span>
                    <span className="block shrink-0 font-mono text-[0.68rem] text-muted-foreground">
                      {toTime(ini)}–{toTime(fim)}
                      {!compacto && ` · ${formatDuration(dur)}`}
                    </span>
                  </button>

                  {expandido && !pausa && (
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        aria-label="Dividir"
                        onClick={() => onSplit(b)}
                        className="grid h-7 w-7 place-items-center rounded-lg border"
                      >
                        <Scissors className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        aria-label="Excluir"
                        onClick={() => onDelete(b)}
                        className="grid h-7 w-7 place-items-center rounded-lg border text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {!compacto && (
                  <span
                    role="separator"
                    aria-label="Esticar bloco"
                    onPointerDown={(e) => iniciar(e, b, "esticar")}
                    className="absolute inset-x-0 bottom-0 flex h-3 cursor-ns-resize items-center justify-center text-muted-foreground/60"
                  >
                    <GripHorizontal className="h-3 w-3" />
                  </span>
                )}
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function nowMinutes() {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

/** Distribui blocos que se sobrepõem em colunas lado a lado. */
function calcularColunas(blocks: Block[]) {
  const itens = blocks
    .map((b) => ({
      id: b.id,
      ini: toMinutes(hhmm(b.start_time)),
      fim: toMinutes(hhmm(b.end_time)),
    }))
    .sort((a, b) => a.ini - b.ini || a.fim - b.fim);

  const mapa: Record<string, { lane: number; total: number }> = {};
  let grupo: { id: string; lane: number }[] = [];
  let fimGrupo = -1;
  let faixas: number[] = [];

  const fechar = () => {
    const total = Math.max(1, faixas.length);
    for (const g of grupo) mapa[g.id] = { lane: g.lane, total };
    grupo = [];
    faixas = [];
    fimGrupo = -1;
  };

  for (const it of itens) {
    if (grupo.length && it.ini >= fimGrupo) fechar();
    let lane = faixas.findIndex((fim) => fim <= it.ini);
    if (lane === -1) {
      faixas.push(it.fim);
      lane = faixas.length - 1;
    } else {
      faixas[lane] = it.fim;
    }
    grupo.push({ id: it.id, lane });
    fimGrupo = Math.max(fimGrupo, it.fim);
  }
  fechar();
  return mapa;
}