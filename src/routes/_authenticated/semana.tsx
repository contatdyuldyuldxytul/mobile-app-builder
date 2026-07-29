import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  useAllGoals,
  useBlocksRange,
  useDomains,
  useProfile,
  useSaveMutation,
  useSettings,
  useTasks,
  useWeeklyPlan,
  type Task,
} from "@/lib/data";
import { WEEKDAYS, addDays, toISODate, weekStart } from "@/lib/dates";
import { distribute, formatDuration, occupiedMinutes, toMinutes } from "@/lib/scheduler";
import { breakPrefsFrom, syncTaskBlocks } from "@/lib/task-sync";
import { useIsMobile } from "@/hooks/use-mobile";
import { WeekTabs } from "@/components/week-tabs";
import { DayColumn } from "@/components/kanban/day-column";
import { TaskCard } from "@/components/kanban/task-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Plus, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/semana")({
  head: () => ({
    meta: [
      { title: "Quadro da semana — Redima" },
      {
        name: "description",
        content:
          "Distribua as tarefas da semana pelos dias, com pausas automáticas a cada duas horas.",
      },
      { property: "og:title", content: "Quadro da semana — Redima" },
      { property: "og:description", content: "Kanban semanal com pausas planejadas." },
    ],
  }),
  component: Semana,
});

const BACKLOG = "backlog";

function Semana() {
  const inicio = weekStart();
  const dias = useMemo(
    () => Array.from({ length: 7 }, (_, i) => toISODate(addDays(inicio, i))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [toISODate(inicio)],
  );

  const { data: plano } = useWeeklyPlan(inicio);
  const { data: tarefas = [] } = useTasks(plano?.id);
  const { data: domains = [] } = useDomains();
  const { data: metas = [] } = useAllGoals();
  const { data: settings } = useSettings();
  const { data: profile } = useProfile();
  const { data: blocos = [] } = useBlocksRange(dias[0], dias[6]);

  const prefs = breakPrefsFrom(settings, profile);
  const isMobile = useIsMobile();
  const hoje = toISODate(new Date());
  const [diaAtivo, setDiaAtivo] = useState(() => (dias.includes(hoje) ? hoje : dias[0]));
  const [arrastando, setArrastando] = useState<Task | null>(null);
  const [aberto, setAberto] = useState(false);

  const capacidadeDia = toMinutes(prefs.dayEnd) - toMinutes(prefs.dayStart);
  const cargaPorDia = useMemo(() => {
    const map: Record<string, number> = {};
    dias.forEach((d) => {
      map[d] = occupiedMinutes(blocos.filter((b) => b.date === d));
    });
    return map;
  }, [blocos, dias]);

  const porDia = (iso: string | null) =>
    tarefas
      .filter((t) => (iso === null ? !t.scheduled_date : t.scheduled_date === iso))
      .sort((a, b) => a.sort_order - b.sort_order);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
  );

  const mover = useSaveMutation<{ task: Task; dateISO: string | null }>(
    async ({ task, dateISO }, userId) => {
      const atualizada: Task = {
        ...task,
        scheduled_date: dateISO,
        status: dateISO ? "agendada" : "backlog",
      };
      const { error } = await supabase
        .from("tasks")
        .update({ scheduled_date: dateISO, status: atualizada.status })
        .eq("id", task.id);
      if (error) throw error;
      const r = await syncTaskBlocks(atualizada, userId, prefs);
      if (!r.ok) throw new Error("O dia não tem espaço livre para essa tarefa.");
    },
    ["tasks", "blocks", "blocks-range"],
  );

  const concluir = useSaveMutation<Task>(async (task) => {
    const feita = task.status !== "feita";
    const { error } = await supabase
      .from("tasks")
      .update({ status: feita ? "feita" : task.scheduled_date ? "agendada" : "backlog" })
      .eq("id", task.id);
    if (error) throw error;
    await supabase
      .from("time_blocks")
      .update({ completed: feita, status: feita ? "feito" : "planejado" })
      .eq("task_id", task.id);
  }, ["tasks", "blocks", "blocks-range"]);

  const excluir = useSaveMutation<Task>(async (task) => {
    await supabase.from("time_blocks").delete().eq("task_id", task.id);
    const { error } = await supabase.from("tasks").delete().eq("id", task.id);
    if (error) throw error;
  }, ["tasks", "blocks", "blocks-range"]);

  const distribuir = useSaveMutation<void>(async (_v, userId) => {
    const backlog = porDia(null);
    if (!backlog.length) throw new Error("Nada no backlog para distribuir.");
    const capacidades = dias.map((d) => ({
      dateISO: d,
      livreMinutos: Math.max(0, capacidadeDia - (cargaPorDia[d] ?? 0)),
    }));
    const { alocadas, sobraram } = distribute(
      backlog.map((t) => ({
        id: t.id,
        estimated_minutes: t.allows_break
          ? t.estimated_minutes +
            Math.max(0, Math.ceil(t.estimated_minutes / prefs.intervalMinutes) - 1) *
              prefs.breakMinutes
          : t.estimated_minutes,
        priority: t.priority,
        allows_break: t.allows_break,
      })),
      capacidades,
    );

    for (const a of alocadas) {
      const t = backlog.find((x) => x.id === a.id)!;
      await supabase
        .from("tasks")
        .update({ scheduled_date: a.dateISO, status: "agendada" })
        .eq("id", t.id);
      await syncTaskBlocks(
        { ...t, scheduled_date: a.dateISO, status: "agendada" },
        userId,
        prefs,
      );
    }
    return { alocadas: alocadas.length, sobraram: sobraram.length };
  }, ["tasks", "blocks", "blocks-range"]);

  function onDragStart(e: DragStartEvent) {
    setArrastando(tarefas.find((t) => t.id === e.active.id) ?? null);
  }

  function onDragEnd(e: DragEndEvent) {
    setArrastando(null);
    const task = tarefas.find((t) => t.id === e.active.id);
    if (!task || !e.over) return;

    const overId = String(e.over.id);
    const destino = overId.startsWith("col:")
      ? overId.slice(4)
      : tarefas.find((t) => t.id === overId)?.scheduled_date ?? BACKLOG;
    const dateISO = destino === BACKLOG ? null : destino;
    if ((task.scheduled_date ?? null) === dateISO) return;

    mover.mutate(
      { task, dateISO },
      {
        onSuccess: () =>
          toast.success(
            dateISO ? `“${task.title}” marcada para ${rotulo(dateISO)}.` : "Voltou para o backlog.",
          ),
        onError: (err) => toast.error(err instanceof Error ? err.message : "Não deu para mover."),
      },
    );
  }

  function rotulo(iso: string) {
    return `${WEEKDAYS[dias.indexOf(iso)] ?? ""} ${iso.slice(8)}`;
  }

  function renderColuna(iso: string | null) {
    const id = iso ? `col:${iso}` : `col:${BACKLOG}`;
    const lista = porDia(iso);
    const usado = iso ? (cargaPorDia[iso] ?? 0) : 0;
    const pct = iso ? Math.min(100, (usado / capacidadeDia) * 100) : 0;

    return (
      <DayColumn
        key={id}
        id={id}
        titulo={iso ? rotulo(iso) : "Backlog"}
        legenda={
          iso
            ? `${formatDuration(usado)} / ${formatDuration(capacidadeDia)}`
            : `${lista.length} tarefa(s)`
        }
        ids={lista.map((t) => t.id)}
        vazio={iso ? "Dia livre." : "Sem tarefas soltas."}
      >
        {iso && (
          <li className="mb-2 list-none">
            <Progress value={pct} className={cn(pct >= 100 && "[&>div]:bg-destructive")} />
          </li>
        )}
        {lista.map((t) => (
          <TaskCard
            key={t.id}
            task={t}
            domain={domains.find((d) => d.id === t.domain_id)}
            metaTitulo={metas.find((m) => m.id === t.goal_id)?.title}
            onMover={() => mover.mutate({ task: t, dateISO: proximoDia(t.scheduled_date) })}
            onConcluir={() => concluir.mutate(t)}
            onExcluir={() => excluir.mutate(t)}
          />
        ))}
      </DayColumn>
    );
  }

  function proximoDia(atual: string | null) {
    if (!atual) return dias[0];
    const i = dias.indexOf(atual);
    return i < 0 || i === 6 ? null : dias[i + 1];
  }

  const totalPlanejado = tarefas
    .filter((t) => t.scheduled_date)
    .reduce((s, t) => s + t.estimated_minutes, 0);

  return (
    <div className="space-y-6">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-3xl sm:text-4xl">Semana</h1>
          <p className="text-sm text-muted-foreground">
            {formatDuration(totalPlanejado)} de tarefas posicionadas
          </p>
        </div>
        <Sheet open={aberto} onOpenChange={setAberto}>
          <SheetTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4" /> Tarefa
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-[90dvh] overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Nova tarefa</SheetTitle>
              <SheetDescription>
                Diga quanto tempo ela leva — o app posiciona no dia e insere as pausas.
              </SheetDescription>
            </SheetHeader>
            <NovaTarefa
              planoId={plano?.id}
              domains={domains}
              metas={metas}
              onPronto={() => setAberto(false)}
            />
          </SheetContent>
        </Sheet>
      </header>

      <WeekTabs />

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={distribuir.isPending}
          onClick={() =>
            distribuir.mutate(undefined, {
              onSuccess: (r) => {
                const res = r as { alocadas: number; sobraram: number };
                toast.success(
                  `${res.alocadas} tarefa(s) distribuída(s)${res.sobraram ? ` · ${res.sobraram} sem espaço` : ""}.`,
                );
              },
              onError: (e) =>
                toast.info(e instanceof Error ? e.message : "Não deu para distribuir."),
            })
          }
        >
          <Sparkles className="h-4 w-4" /> Distribuir backlog
        </Button>
        <span className="text-xs text-muted-foreground">
          Pausa de {prefs.breakMinutes}min a cada {formatDuration(prefs.intervalMinutes)}
        </span>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        {isMobile ? (
          <div className="space-y-4">
            <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
              {dias.map((d, i) => {
                const pct = Math.min(100, ((cargaPorDia[d] ?? 0) / capacidadeDia) * 100);
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDiaAtivo(d)}
                    className={cn(
                      "min-w-[3.75rem] shrink-0 rounded-xl border px-2 py-1.5 text-center",
                      diaAtivo === d && "border-primary bg-primary/10",
                    )}
                  >
                    <span className="block text-xs">{WEEKDAYS[i]}</span>
                    <span className="block text-[0.65rem] text-muted-foreground">
                      {d.slice(8)}
                    </span>
                    <span className="mt-1 block h-1 rounded-full bg-muted">
                      <span
                        className={cn(
                          "block h-1 rounded-full bg-primary",
                          pct >= 100 && "bg-destructive",
                        )}
                        style={{ width: `${pct}%` }}
                      />
                    </span>
                  </button>
                );
              })}
            </div>
            {renderColuna(diaAtivo)}
            {renderColuna(null)}
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {dias.map((d) => renderColuna(d))}
            {renderColuna(null)}
          </div>
        )}

        <DragOverlay>
          {arrastando && (
            <div className="rounded-xl border bg-card p-3 text-sm shadow-lg">
              {arrastando.title}
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

function NovaTarefa({
  planoId,
  domains,
  metas,
  onPronto,
}: {
  planoId?: string;
  domains: { id: string; name: string }[];
  metas: { id: string; title: string }[];
  onPronto: () => void;
}) {
  const [titulo, setTitulo] = useState("");
  const [minutos, setMinutos] = useState(60);
  const [dominio, setDominio] = useState("");
  const [meta, setMeta] = useState("");
  const [pausa, setPausa] = useState(true);

  const criar = useSaveMutation<void>(async (_v, userId) => {
    if (!titulo.trim()) throw new Error("Dê um nome à tarefa");
    const { error } = await supabase.from("tasks").insert({
      user_id: userId,
      weekly_plan_id: planoId ?? null,
      title: titulo.trim(),
      estimated_minutes: minutos,
      domain_id: dominio || null,
      goal_id: meta || null,
      allows_break: pausa,
      status: "backlog",
    });
    if (error) throw error;
  }, ["tasks"]);

  return (
    <div className="space-y-4 px-4 pb-6">
      <div className="space-y-2">
        <Label htmlFor="t">O que precisa ser feito</Label>
        <Input id="t" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label>Quanto tempo leva</Label>
        <div className="flex flex-wrap gap-2">
          {[15, 30, 60, 90, 120, 180, 240].map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMinutos(m)}
              className={cn(
                "rounded-full border px-3 py-1 text-sm text-muted-foreground",
                minutos === m && "border-primary bg-primary text-primary-foreground",
              )}
            >
              {formatDuration(m)}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Área da vida</Label>
          <Select value={dominio} onValueChange={setDominio}>
            <SelectTrigger>
              <SelectValue placeholder="Escolher" />
            </SelectTrigger>
            <SelectContent>
              {domains.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Meta do mês (opcional)</Label>
          <Select value={meta} onValueChange={setMeta}>
            <SelectTrigger>
              <SelectValue placeholder="Nenhuma" />
            </SelectTrigger>
            <SelectContent>
              {metas.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex items-center justify-between rounded-xl border p-3">
        <div className="min-w-0 pr-3">
          <Label htmlFor="p">Consigo pausar no meio</Label>
          <p className="text-xs text-muted-foreground">
            Home office, estudo, tarefas próprias — o app insere as pausas.
          </p>
        </div>
        <Switch id="p" checked={pausa} onCheckedChange={setPausa} />
      </div>
      <Button
        className="w-full"
        disabled={!titulo.trim() || criar.isPending}
        onClick={() =>
          criar.mutate(undefined, {
            onSuccess: () => {
              setTitulo("");
              toast.success("Tarefa no backlog.");
              onPronto();
            },
            onError: (e) => toast.error(e instanceof Error ? e.message : "Não deu para criar."),
          })
        }
      >
        Adicionar ao backlog
      </Button>
    </div>
  );
}