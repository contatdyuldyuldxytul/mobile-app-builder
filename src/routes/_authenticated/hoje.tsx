import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  useDomains,
  useHabitLogs,
  useHabits,
  useProfile,
  useSaveMutation,
  useSettings,
  useTimeBlocks,
  useTimeBudgets,
  useWeeklyPlan,
} from "@/lib/data";
import { formatLongDate, todayISO } from "@/lib/dates";
import {
  ensureDayBlocks,
  hhmm,
  isSleepDomain,
  saveBlockTime,
  splitBlock,
  tidyDay,
  type Block,
} from "@/lib/day-schedule";
import { celebrate } from "@/lib/celebrate";
import { generateDayFromTemplate, resetDayFromTemplate } from "@/lib/cascade";
import { useIdealWeek } from "@/lib/data";
import { formatDuration, findSlot, toMinutes, toTime } from "@/lib/scheduler";
import { quoteOfTheDay } from "@/lib/quotes";
import { BreakBar } from "@/components/break-bar";
import { DayTimeline } from "@/components/day-timeline";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
} from "@/components/ui/sheet";
import { Moon } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/hoje")({
  head: () => ({
    meta: [
      { title: "Hoje — Redima" },
      { name: "description", content: "Sua intenção, seus blocos de tempo e o foco de hoje." },
      { property: "og:title", content: "Hoje — Redima" },
      { property: "og:description", content: "Intenção, blocos e foco do dia." },
    ],
  }),
  component: Hoje,
});

function Hoje() {
  const hoje = todayISO();
  const diaSemana = (new Date().getDay() + 6) % 7;
  const NOME_DIA = [
    "Segunda-feira",
    "Terça-feira",
    "Quarta-feira",
    "Quinta-feira",
    "Sexta-feira",
    "Sábado",
    "Domingo",
  ][diaSemana];
  const navigate = useNavigate();
  const { data: profile } = useProfile();
  const { data: settings } = useSettings();
  const { data: domains = [] } = useDomains();
  const blocosQuery = useTimeBlocks(hoje);
  const blocos = useMemo(
    () => [...(blocosQuery.data ?? [])].sort((a, b) => a.start_time.localeCompare(b.start_time)),
    [blocosQuery.data],
  );
  const { data: weekly } = useWeeklyPlan();
  const { data: budgets = [] } = useTimeBudgets(weekly?.id);
  const { data: habits = [] } = useHabits();
  const { data: logs = [] } = useHabitLogs(hoje, hoje);
  const idealQuery = useIdealWeek();
  const templateDoDia = useMemo(
    () => (idealQuery.data ?? []).filter((t) => t.day_of_week === diaSemana),
    [idealQuery.data, diaSemana],
  );
  const preenchido = useRef<string | null>(null);
  const [novo, setNovo] = useState<{ startMin: number } | null>(null);

  const dayStart = hhmm(profile?.day_start ?? "06:00");
  const dayEnd = hhmm(profile?.day_end ?? "22:00");
  const breakInterval = settings?.break_interval_minutes ?? 120;
  const breakMinutes = settings?.break_duration_minutes ?? 15;

  useEffect(() => {
    if (profile && !profile.onboarding_completed) navigate({ to: "/onboarding", replace: true });
  }, [profile, navigate]);

  const alternarHabito = useSaveMutation<{ habitId: string; completed: boolean }>(
    async ({ habitId, completed }, userId) => {
      const { error } = await supabase
        .from("habit_logs")
        .upsert(
          { user_id: userId, habit_id: habitId, date: hoje, completed },
          { onConflict: "habit_id,date" },
        );
      if (error) throw error;
    },
    ["habit-logs"],
  );

  const alternarBloco = useSaveMutation<{ b: Block; done: boolean }>(async ({ b, done }) => {
    const { error } = await supabase
      .from("time_blocks")
      .update({ completed: done, status: done ? "feito" : "planejado" })
      .eq("id", b.id);
    if (error) throw error;
    if (b.task_id) {
      await supabase
        .from("tasks")
        .update({ status: done ? "feita" : "agendada" })
        .eq("id", b.task_id);
    }
  }, ["blocks", "blocks-range", "tasks", "tasks-day"]);

  const moverBloco = useSaveMutation<{ b: Block; ini: number; fim: number }>(
    async ({ b, ini, fim }) => saveBlockTime(b, ini, fim, dayStart, dayEnd, blocos),
    ["blocks", "blocks-range"],
  );

  const arrumarDia = useSaveMutation<void>(
    async () => tidyDay(blocos, dayStart, dayEnd),
    ["blocks", "blocks-range"],
  );

  const dividirBloco = useSaveMutation<Block>(
    async (b, userId) => splitBlock(b, blocos, userId, dayStart, dayEnd),
    ["blocks", "blocks-range"],
  );

  const excluirBloco = useSaveMutation<Block>(async (b) => {
    const { error } = await supabase.from("time_blocks").delete().eq("id", b.id);
    if (error) throw error;
  }, ["blocks", "blocks-range"]);

  const criarBloco = useSaveMutation<{
    titulo: string;
    domainId: string | null;
    startMin: number;
    minutos: number;
  }>(async ({ titulo, domainId, startMin, minutos }, userId) => {
    const { error } = await supabase.from("time_blocks").insert({
      user_id: userId,
      date: hoje,
      title: titulo,
      domain_id: domainId,
      start_time: toTime(startMin),
      end_time: toTime(startMin + minutos),
      block_kind: "tarefa",
      status: "planejado",
    });
    if (error) throw error;
  }, ["blocks", "blocks-range"]);

  // O dia nasce da Semana Ideal: cópia fiel do template daquele dia da semana.
  const preencherDia = useSaveMutation<void>(
    async (_v, userId) => generateDayFromTemplate(userId, hoje),
    ["blocks", "blocks-range"],
  );

  const refazerDia = useSaveMutation<void>(
    async (_v, userId) => resetDayFromTemplate(userId, hoje),
    ["blocks", "blocks-range"],
  );

  // Só sob demanda: completa o dia com o que sobrou do orçamento da semana.
  const completarComOrcamento = useSaveMutation<void>(
    async (_v, userId) =>
      ensureDayBlocks({
        dateISO: hoje,
        weekday: diaSemana,
        userId,
        domains,
        budgets,
        blocks: blocos,
        dayStart,
        dayEnd,
        breakInterval,
        breakMinutes,
      }),
    ["blocks", "blocks-range"],
  );

  const [naoCoube, setNaoCoube] = useState<string[]>([]);

  useEffect(() => {
    if (!blocosQuery.isSuccess || !idealQuery.isSuccess) return;
    if (templateDoDia.length === 0) return;
    const chave = `${hoje}:${templateDoDia.map((t) => t.id).join(",")}`;
    if (preenchido.current === chave) return;
    preenchido.current = chave;
    preencherDia.mutate(undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hoje, templateDoDia, blocosQuery.isSuccess, idealQuery.isSuccess]);

  const habitosHoje = habits.filter((h) => h.frequency.includes(diaSemana));
  const frase = quoteOfTheDay(hoje, !!profile?.spiritual_mode);
  const sono = domains.find(isSleepDomain);
  const horasSono = Number(settings?.sleep_hours_per_day ?? 8);

  const minutosTotal = blocos
    .filter((b) => b.block_kind !== "pausa")
    .reduce((s, b) => s + (toMinutes(hhmm(b.end_time)) - toMinutes(hhmm(b.start_time))), 0);
  const minutosFeitos = blocos
    .filter((b) => b.block_kind !== "pausa" && b.completed)
    .reduce((s, b) => s + (toMinutes(hhmm(b.end_time)) - toMinutes(hhmm(b.start_time))), 0);
  const pct = minutosTotal ? (minutosFeitos / minutosTotal) * 100 : 0;

  function concluir(b: Block, done: boolean) {
    alternarBloco.mutate(
      { b, done },
      {
        onSuccess: () => {
          if (!done) return;
          const restantes = blocos.filter(
            (x) => x.block_kind !== "pausa" && !x.completed && x.id !== b.id,
          ).length;
          celebrate(restantes === 0 ? "big" : "small");
          if (restantes === 0) toast.success("Dia fechado. Você honrou o que combinou. 🎉");
        },
      },
    );
  }

  return (
    <div className="space-y-8 pb-20">
      <header>
        <p className="text-sm text-muted-foreground">{formatLongDate(hoje)}</p>
        <h1 className="text-4xl">Hoje</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {NOME_DIA} · seu dia montado a partir do que você reservou na Semana.
        </p>
      </header>

      <section className="rounded-2xl border-l-4 border-l-primary bg-card p-5">
        <p className="text-lg leading-relaxed">“{frase.text}”</p>
        <p className="mt-2 text-sm text-muted-foreground">— {frase.author}</p>
      </section>

      <section className="rounded-2xl border bg-card p-5">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xl">Progresso do dia</h2>
          <span className="font-mono text-sm text-muted-foreground">
            {formatDuration(minutosFeitos)} / {formatDuration(minutosTotal)}
          </span>
        </div>
        <Progress className="mt-3 transition-all duration-500" value={pct} />
      </section>

      {naoCoube.length > 0 && (
        <p className="rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm">
          {naoCoube.join(", ")} não coube no dia. Ajuste as horas na{" "}
          <Link to="/semana" className="text-primary underline-offset-4 hover:underline">
            Semana
          </Link>
          .
        </p>
      )}

      <DayTimeline
        blocks={blocos}
        domains={domains}
        dayStart={dayStart}
        dayEnd={dayEnd}
        onMove={(b, ini, fim) => moverBloco.mutate({ b, ini, fim })}
        onToggle={concluir}
        onSplit={(b) =>
          dividirBloco.mutate(b, {
            onSuccess: () => toast.success("Dividido — a outra metade foi para o próximo espaço."),
            onError: (e) => toast.error(e instanceof Error ? e.message : "Não deu para dividir."),
          })
        }
        onDelete={(b) => excluirBloco.mutate(b)}
        onAddAt={(startMin) => setNovo({ startMin })}
        onTidy={() =>
          arrumarDia.mutate(undefined, {
            onSuccess: (n) =>
              toast.success(n ? `${n} bloco(s) reacomodado(s).` : "Seu dia já está organizado."),
          })
        }
      />

      {sono && (
        <section className="flex items-center gap-3 rounded-2xl border border-dashed bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          <Moon className="h-4 w-4 shrink-0" />
          <span className="min-w-0">
            Noite reservada: {horasSono}h de sono a partir das {dayEnd}. Fora da grade, é descanso.
          </span>
        </section>
      )}

      {habitosHoje.length > 0 && (
        <section className="rounded-2xl border bg-card p-5">
          <h2 className="text-xl">Hábitos de hoje</h2>
          <ul className="mt-3 space-y-2">
            {habitosHoje.map((h) => {
              const feito = !!logs.find((l) => l.habit_id === h.id)?.completed;
              return (
                <li
                  key={h.id}
                  className="flex items-center gap-3 rounded-xl border-l-4 bg-muted/40 px-3 py-2.5"
                  style={{
                    borderLeftColor:
                      domains.find((d) => d.id === h.domain_id)?.color ?? "var(--border)",
                  }}
                >
                  <Checkbox
                    id={h.id}
                    checked={feito}
                    onCheckedChange={(v) => {
                      alternarHabito.mutate({ habitId: h.id, completed: !!v });
                      if (v) celebrate("small");
                    }}
                  />
                  <label
                    htmlFor={h.id}
                    className={cn(
                      "min-w-0 flex-1 cursor-pointer truncate text-sm",
                      feito && "text-muted-foreground line-through",
                    )}
                  >
                    {h.name}
                  </label>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="rounded-2xl border bg-card p-5">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xl">Orçamento da semana</h2>
          <Link to="/semana" className="text-sm text-primary underline-offset-4 hover:underline">
            Ajustar
          </Link>
        </div>
        {budgets.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Você ainda não orçou esta semana.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {budgets.map((b) => {
              const dom = domains.find((d) => d.id === b.domain_id);
              const pct = Number(b.planned_hours)
                ? (Number(b.actual_hours) / Number(b.planned_hours)) * 100
                : 0;
              return (
                <div key={b.id}>
                  <div className="flex justify-between text-sm">
                    <span>{dom?.name ?? "—"}</span>
                    <span className="text-muted-foreground">
                      {Number(b.actual_hours).toFixed(1)}h de {Number(b.planned_hours).toFixed(1)}h
                    </span>
                  </div>
                  <Progress className="mt-1" value={Math.min(100, pct)} />
                </div>
              );
            })}
            <p className="text-xs text-muted-foreground">
              {budgets
                .reduce((s, b) => s + Number(b.planned_hours), 0)
                .toFixed(1)}
              h comprometidas nesta semana.
            </p>
          </div>
        )}
      </section>

      <BreakBar
        cycleMinutes={settings?.break_interval_minutes ?? 120}
        breakMinutes={settings?.break_duration_minutes ?? 15}
      />

      <NovoBloco
        aberto={!!novo}
        startMin={novo?.startMin ?? toMinutes(dayStart)}
        domains={domains}
        blocos={blocos}
        dayStart={dayStart}
        dayEnd={dayEnd}
        onFechar={() => setNovo(null)}
        onCriar={(v) =>
          criarBloco.mutate(v, {
            onSuccess: () => {
              setNovo(null);
              toast.success("Bloco no seu dia.");
            },
            onError: () => toast.error("Não deu para criar o bloco."),
          })
        }
      />
    </div>
  );
}

function NovoBloco({
  aberto,
  startMin,
  domains,
  blocos,
  dayStart,
  dayEnd,
  onFechar,
  onCriar,
}: {
  aberto: boolean;
  startMin: number;
  domains: { id: string; name: string }[];
  blocos: Block[];
  dayStart: string;
  dayEnd: string;
  onFechar: () => void;
  onCriar: (v: {
    titulo: string;
    domainId: string | null;
    startMin: number;
    minutos: number;
  }) => void;
}) {
  const [titulo, setTitulo] = useState("");
  const [dominio, setDominio] = useState("");
  const [minutos, setMinutos] = useState(60);
  const [hora, setHora] = useState(toTime(startMin));

  useEffect(() => {
    if (aberto) setHora(toTime(startMin));
  }, [aberto, startMin]);

  const nome = titulo.trim() || domains.find((d) => d.id === dominio)?.name || "";

  function sugerir() {
    const ocupados = blocos.map((b) => ({
      start_time: hhmm(b.start_time),
      end_time: hhmm(b.end_time),
    }));
    const slot = findSlot(ocupados, minutos, dayStart, dayEnd);
    if (slot) setHora(slot.start_time);
    else toast.info("O dia está cheio — mova algo antes.");
  }

  return (
    <Sheet open={aberto} onOpenChange={(v) => !v && onFechar()}>
      <SheetContent side="bottom" className="max-h-[90dvh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Novo bloco</SheetTitle>
          <SheetDescription>Escolha a hora, a área e quanto tempo dura.</SheetDescription>
        </SheetHeader>
        <div className="space-y-4 px-4 pb-6">
          <div className="space-y-2">
            <Label htmlFor="b-titulo">O que você vai fazer</Label>
            <Input
              id="b-titulo"
              value={titulo}
              placeholder="Ex.: Tempo com a família"
              onChange={(e) => setTitulo(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="b-hora">Começa às</Label>
              <Input
                id="b-hora"
                type="time"
                step={900}
                value={hora}
                onChange={(e) => setHora(e.target.value)}
              />
            </div>
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
          </div>
          <div className="space-y-2">
            <Label>Duração</Label>
            <div className="flex flex-wrap gap-2">
              {[15, 30, 45, 60, 90, 120, 180].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMinutos(m)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-sm text-muted-foreground transition-transform active:scale-95",
                    minutos === m && "border-primary bg-primary text-primary-foreground",
                  )}
                >
                  {formatDuration(m)}
                </button>
              ))}
            </div>
          </div>
          <Button variant="outline" className="w-full" onClick={sugerir}>
            Encaixar no próximo espaço livre
          </Button>
          <Button
            className="w-full"
            disabled={!nome}
            onClick={() => {
              onCriar({
                titulo: nome,
                domainId: dominio || null,
                startMin: toMinutes(hora),
                minutos,
              });
              setTitulo("");
            }}
          >
            Adicionar ao dia
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}