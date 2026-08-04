import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
  ensureBreaks,
  dedupeExact,
  mergeBlocks,
  pruneLonePauses,
  sanearDia,
  hhmm,
  isSleepDomain,
  planMoveToBand,
  moveBlockToBand,
  saveBlockTime,
  snap,
  splitBlock,
  tidyDay,
  type Block,
} from "@/lib/day-schedule";
import { celebrate } from "@/lib/celebrate";
import { registrarPlacarDoDia } from "@/lib/challenges";
import { generateDayFromTemplate, rebuildIdealWeek, resetDayFromTemplate } from "@/lib/cascade";
import { useIdealWeek } from "@/lib/data";
import { formatDuration, findSlot, toMinutes, toTime } from "@/lib/scheduler";
import { quoteOfTheDay } from "@/lib/quotes";
import { BreakBar } from "@/components/break-bar";
import { DayChecklist } from "@/components/day-checklist";
import { ProgressRing } from "@/components/progress-ring";
import { HeroHoje } from "@/components/hero-hoje";
import { Personagem } from "@/components/personagem";
import { useGuardioes } from "@/lib/guardioes";
import { useGuardiaoAnim } from "@/lib/guardiao-trigger";
import { GuardiaoOverlay } from "@/components/guardiao-overlay";
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
import { horarioCabeNoPeriodo } from "@/lib/ideal-week";

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
  const qc = useQueryClient();
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
  const leitura = useGuardioes();
  const idealQuery = useIdealWeek();
  const templateDoDia = useMemo(
    () => (idealQuery.data ?? []).filter((t) => t.day_of_week === diaSemana),
    [idealQuery.data, diaSemana],
  );
  const preenchido = useRef<string | null>(null);
  const [novo, setNovo] = useState<{ startMin: number } | null>(null);
  const [editando, setEditando] = useState<Block | null>(null);
  /** Pergunta "só hoje ou sempre" quando o bloco veio da semana ideal. */
  const [escopo, setEscopo] = useState<{
    titulo: string;
    aplicar: (sempre: boolean) => void;
  } | null>(null);
  const amanha = useMemo(() => {
    const d = new Date(`${hoje}T00:00:00`);
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  }, [hoje]);

  const dayStart = hhmm(profile?.day_start ?? "06:00");
  const dayEnd = hhmm(profile?.day_end ?? "22:00");
  const breakInterval = settings?.break_interval_minutes ?? 120;
  const breakMinutes = settings?.break_duration_minutes ?? 15;

  /** Só pergunta o escopo quando o bloco nasceu da semana ideal. */
  function comEscopo(b: Block, titulo: string, aplicar: (sempre: boolean) => void) {
    if (!b.ideal_block_id) {
      aplicar(false);
      return;
    }
    setEscopo({ titulo, aplicar });
  }

  /** Copia o horário atual do bloco do dia para o bloco da semana ideal. */
  async function sincronizarTemplate(blockId: string, idealId: string) {
    const { data } = await supabase
      .from("time_blocks")
      .select("start_time,end_time")
      .eq("id", blockId)
      .maybeSingle();
    if (!data) return;
    await supabase
      .from("ideal_week_blocks")
      .update({ start_time: data.start_time, end_time: data.end_time })
      .eq("id", idealId);
    qc.invalidateQueries({ queryKey: ["ideal-week"] });
  }

  /** Aviso curto com a opção de voltar atrás — guarda só a última ação. */
  function comDesfazer(mensagem: string, desfazer: () => Promise<void> | void) {
    toast.success(mensagem, {
      action: {
        label: "Desfazer",
        onClick: () => {
          void Promise.resolve(desfazer()).then(() => {
            qc.invalidateQueries({ queryKey: ["blocks"] });
            qc.invalidateQueries({ queryKey: ["blocks-range"] });
          });
        },
      },
    });
  }

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

  const chaveDia = useMemo(() => ["blocks", hoje] as const, [hoje]);

  /** Atualiza o cache do dia na hora — a tela não espera o banco. */
  function aplicarLocal(fn: (b: Block[]) => Block[]) {
    const antes = qc.getQueryData<Block[]>(chaveDia) ?? [];
    qc.setQueryData<Block[]>(chaveDia, fn(antes));
    return antes;
  }

  const alternarBloco = useMutation({
    mutationFn: async ({ b, done }: { b: Block; done: boolean }) => {
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
    },
    onMutate: ({ b, done }) =>
      aplicarLocal((lista) => lista.map((x) => (x.id === b.id ? { ...x, completed: done } : x))),
    onError: (_e, _v, antes) => {
      if (antes) qc.setQueryData(chaveDia, antes);
      toast.error("Não deu para salvar. Tente de novo.");
    },
  });

  const moverBloco = useSaveMutation<{ b: Block; ini: number; fim: number }>(
    async ({ b, ini, fim }) => saveBlockTime(b, ini, fim, dayStart, dayEnd, blocos),
    ["blocks", "blocks-range"],
  );

  type Movimento = { id: string; bandStart: number; bandEnd: number; beforeId?: string | null };

  const mover = useMutation({
    mutationFn: async (m: Movimento) =>
      moveBlockToBand(blocos, m.id, m.bandStart, m.bandEnd, m.beforeId),
    onMutate: (m) =>
      aplicarLocal((lista) => {
        const plano = planMoveToBand(lista, m.id, m.bandStart, m.bandEnd, m.beforeId);
        return lista.map((b) => {
          const p = plano.find((x: { id: string }) => x.id === b.id);
          return p ? { ...b, start_time: toTime(p.ini), end_time: toTime(p.fim) } : b;
        });
      }),
    onError: (_e, _v, antes) => {
      if (antes) qc.setQueryData(chaveDia, antes);
      toast.error("Não deu para mover.");
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["blocks"] }),
  });

  const unificar = useSaveMutation<string[]>(
    async (ids) => mergeBlocks(blocos, ids),
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

  const excluirBloco = useMutation({
    mutationFn: async (b: Block) => {
      const { error } = await supabase.from("time_blocks").delete().eq("id", b.id);
      if (error) throw error;
    },
    onMutate: (b) => aplicarLocal((lista) => lista.filter((x) => x.id !== b.id)),
    onError: (_e, _v, antes) => {
      if (antes) qc.setQueryData(chaveDia, antes);
      toast.error("Não deu para excluir.");
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["blocks"] }),
  });

  const criarBloco = useSaveMutation<{
    titulo: string;
    domainId: string | null;
    startMin: number;
    minutos: number;
  }>(
    async ({ titulo, domainId, startMin, minutos }, userId) => {
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
    },
    ["blocks", "blocks-range"],
  );

  const editarBloco = useSaveMutation<{
    b: Block;
    titulo: string;
    domainId: string | null;
    inicio: number;
    fim: number;
    completed: boolean;
    sempre: boolean;
  }>(async ({ b, titulo, domainId, inicio, fim, completed, sempre }) => {
    const atualizacao = {
      title: titulo,
      domain_id: domainId,
      start_time: toTime(inicio),
      end_time: toTime(fim),
      completed,
      status: completed ? "feito" : "planejado",
    };
    const { error } = await supabase.from("time_blocks").update(atualizacao).eq("id", b.id);
    if (error) throw error;
    if (sempre) {
      const ideal = {
        title: titulo,
        domain_id: domainId,
        start_time: toTime(inicio),
        end_time: toTime(fim),
      };
      if (b.ideal_block_id) {
        const { error: idealError } = await supabase
          .from("ideal_week_blocks")
          .update(ideal)
          .eq("id", b.ideal_block_id);
        if (idealError) throw idealError;
      } else {
        const { data: criado, error: idealError } = await supabase
          .from("ideal_week_blocks")
          .insert({ ...ideal, user_id: b.user_id, day_of_week: diaSemana })
          .select("id")
          .single();
        if (idealError) throw idealError;
        const { error: vinculoError } = await supabase
          .from("time_blocks")
          .update({ ideal_block_id: criado.id })
          .eq("id", b.id);
        if (vinculoError) throw vinculoError;
      }
    }
  }, ["blocks", "blocks-range", "ideal-week"]);

  /** Manda uma atividade para amanhã, no mesmo horário. */
  const moverAmanha = useSaveMutation<Block>(async (b) => {
    const { error } = await supabase.from("time_blocks").update({ date: amanha }).eq("id", b.id);
    if (error) throw error;
  }, ["blocks", "blocks-range"]);

  /** Copia a atividade para o próximo espaço livre do dia. */
  const duplicarBloco = useSaveMutation<Block>(async (b, userId) => {
    const minutos = toMinutes(hhmm(b.end_time)) - toMinutes(hhmm(b.start_time));
    const ocupados = blocos.map((x) => ({
      start_time: hhmm(x.start_time),
      end_time: hhmm(x.end_time),
    }));
    const slot = findSlot(ocupados, minutos, dayStart, dayEnd);
    if (!slot) throw new Error("O dia está cheio — mova algo antes.");
    const { data, error } = await supabase
      .from("time_blocks")
      .insert({
        user_id: userId,
        date: hoje,
        title: b.title,
        domain_id: b.domain_id,
        start_time: slot.start_time,
        end_time: toTime(toMinutes(slot.start_time) + minutos),
        block_kind: "tarefa",
        status: "planejado",
      })
      .select("id")
      .single();
    if (error) throw error;
    return data.id as string;
  }, ["blocks", "blocks-range"]);

  /** Empurra para amanhã tudo que ficou por fazer. */
  const empurrarPendentes = useSaveMutation<void>(async () => {
    const ids = blocos.filter((b) => b.block_kind !== "pausa" && !b.completed).map((b) => b.id);
    if (!ids.length) return [] as string[];
    const { error } = await supabase.from("time_blocks").update({ date: amanha }).in("id", ids);
    if (error) throw error;
    return ids;
  }, ["blocks", "blocks-range"]);

  /** Lê os blocos do dia direto do banco — usado entre as etapas da montagem. */
  async function lerBlocos(userId: string) {
    const { data } = await supabase
      .from("time_blocks")
      .select("*")
      .eq("user_id", userId)
      .eq("date", hoje);
    return (data ?? []) as Block[];
  }

  /**
   * Monta o dia inteiro: template da Semana Ideal → o que faltar do orçamento
   * → pausas a cada ciclo de foco. Idempotente.
   */
  async function montarDia(userId: string) {
    // Semana Ideal antiga (pausa no meio do colchete) é refeita antes de virar dia.
    const { data: tmpl } = await supabase
      .from("ideal_week_blocks")
      .select("start_time,end_time,title,domain_id,day_of_week")
      .eq("user_id", userId);
    const foraDaGrade = (tmpl ?? []).some(
      (t) =>
        /pausa/i.test(t.title ?? "") && toMinutes(hhmm(t.start_time)) % breakInterval !== 0,
    );
    const atravessaColchete = (tmpl ?? []).some((t) => {
      if (/pausa/i.test(t.title ?? "")) return false;
      const ini = toMinutes(hhmm(t.start_time));
      const fim = toMinutes(hhmm(t.end_time));
      return fim > (Math.floor(ini / breakInterval) + 1) * breakInterval;
    });
    const templateIncompleto = domains.some((d) => {
      if (d.is_archived || isSleepDomain(d) || ehAreaAutomatica(d)) return false;
      if (Number(d.default_weekly_hours ?? 0) <= 0) return false;
      const dias = (d.preferred_days ?? []).map(Number);
      if (!dias.includes(diaSemana)) return false;
      return !(tmpl ?? []).some((t) => t.domain_id === d.id && t.day_of_week === diaSemana);
    });
    if (foraDaGrade || atravessaColchete || templateIncompleto) {
      await rebuildIdealWeek(userId);
      await resetDayFromTemplate(userId, hoje);
    }
    // 0. Faxina: o que ficou fora do padrão (duração zero, fora do dia ou
    //    menos de 30 min) sai antes de qualquer coisa.
    const antes = await lerBlocos(userId);
    const areas = new Map(domains.map((d) => [d.id, d]));
    const foraDoPeriodo = antes
      .filter((b) => !b.completed && !b.task_id && b.block_kind !== "pausa" && b.domain_id)
      .filter((b) => {
        const area = b.domain_id ? areas.get(b.domain_id) : undefined;
        if (!area || !area.preferred_period || area.preferred_period === "qualquer") return false;
        return !horarioCabeNoPeriodo(
          area.preferred_period,
          toMinutes(hhmm(b.start_time)),
          toMinutes(hhmm(b.end_time)),
          toMinutes(dayStart),
          toMinutes(dayEnd),
        );
      })
      .map((b) => b.id);
    if (foraDoPeriodo.length) await supabase.from("time_blocks").delete().in("id", foraDoPeriodo);

    const automaticosQueAtravessam = antes
      .filter((b) => !foraDoPeriodo.includes(b.id))
      .filter((b) => !b.completed && !b.task_id && b.block_kind !== "pausa")
      .filter((b) => {
        const ini = toMinutes(hhmm(b.start_time));
        const fim = toMinutes(hhmm(b.end_time));
        return fim > (Math.floor(ini / breakInterval) + 1) * breakInterval;
      })
      .map((b) => b.id);
    if (automaticosQueAtravessam.length) {
      await supabase.from("time_blocks").delete().in("id", automaticosQueAtravessam);
    }
    await sanearDia(await lerBlocos(userId), dayStart, dayEnd, breakInterval);
    await generateDayFromTemplate(userId, hoje);
    await sanearDia(await lerBlocos(userId), dayStart, dayEnd, breakInterval);
    // 1. O descanso é reservado antes de tudo: as pausas de 2 em 2 horas
    //    nascem primeiro para que nenhuma atividade ocupe o lugar delas.
    const doTemplate = await lerBlocos(userId);
    const p = await ensureBreaks({
      blocks: doTemplate,
      dateISO: hoje,
      userId,
      interval: breakInterval,
      breakMinutes,
      dayEnd,
      dayStart,
      exigirAtividade: false,
    });
    // 2. As áreas do orçamento se encaixam em volta das pausas já reservadas.
    const atuais = await lerBlocos(userId);
    const r = await ensureDayBlocks({
      dateISO: hoje,
      weekday: diaSemana,
      userId,
      domains,
      budgets,
      blocks: atuais,
      dayStart,
      dayEnd,
      breakInterval,
      breakMinutes,
    });
    // 3. Pausa que ficou entre dois vazios não descansa de nada: sai.
    const comOrcamento = await lerBlocos(userId);
    await pruneLonePauses(comOrcamento);
    await dedupeExact(await lerBlocos(userId));
    return { criados: r.criados, naoCoube: r.naoCoube, pausas: p.criadas };
  }

  // O dia nasce da Semana Ideal e é completado com o orçamento e as pausas.
  const preencherDia = useSaveMutation<void>(
    async (_v, userId) => montarDia(userId),
    ["blocks", "blocks-range"],
  );

  const refazerDia = useSaveMutation<void>(
    async (_v, userId) => {
      await resetDayFromTemplate(userId, hoje);
      return montarDia(userId);
    },
    ["blocks", "blocks-range"],
  );

  // Só sob demanda: completa o dia com o que sobrou do orçamento da semana.
  const completarComOrcamento = useSaveMutation<void>(
    async (_v, userId) => montarDia(userId),
    ["blocks", "blocks-range"],
  );

  useEffect(() => {
    if (!blocosQuery.isSuccess || !idealQuery.isSuccess) return;
    if (templateDoDia.length === 0 && domains.length === 0) return;
    const chave = `${hoje}:${templateDoDia.map((t) => t.id).join(",")}:${domains.length}`;
    if (preenchido.current === chave) return;
    preenchido.current = chave;
    preencherDia.mutate(undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hoje, templateDoDia, domains.length, blocosQuery.isSuccess, idealQuery.isSuccess]);

  const habitosHoje = habits.filter((h) => h.frequency.includes(diaSemana));
  const frase = quoteOfTheDay(hoje, !!profile?.spiritual_mode);
  const sono = domains.find(isSleepDomain);
  const horasSono = Number(settings?.sleep_hours_per_day ?? 8);

  // Guardiões: os gatilhos são reavaliados quando o dia muda de estado.
  const guardiaoAnim = useGuardiaoAnim();
  useEffect(() => {
    if (!blocosQuery.isSuccess) return;
    void guardiaoAnim.dispararDoDia();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hoje, blocosQuery.isSuccess, blocos]);

  const minutosTotal = blocos
    .filter((b) => b.block_kind !== "pausa")
    .reduce((s, b) => s + (toMinutes(hhmm(b.end_time)) - toMinutes(hhmm(b.start_time))), 0);
  const minutosFeitos = blocos
    .filter((b) => b.block_kind !== "pausa" && b.completed)
    .reduce((s, b) => s + (toMinutes(hhmm(b.end_time)) - toMinutes(hhmm(b.start_time))), 0);
  const pct = minutosTotal ? (minutosFeitos / minutosTotal) * 100 : 0;
  const atividades = blocos.filter((b) => b.block_kind !== "pausa");
  const feitas = atividades.filter((b) => b.completed).length;
  const restantes = atividades.length - feitas;

  function concluir(b: Block, done: boolean) {
    alternarBloco.mutate(
      { b, done },
      {
        onSuccess: () => {
          // O placar dos desafios acompanha o quanto do dia você cumpriu.
          const atuais = qc.getQueryData<Block[]>(chaveDia) ?? blocos;
          const tarefas = atuais.filter((x) => x.block_kind !== "pausa");
          const dur = (x: Block) => toMinutes(hhmm(x.end_time)) - toMinutes(hhmm(x.start_time));
          const total = tarefas.reduce((s, x) => s + dur(x), 0);
          const feitosMin = tarefas.filter((x) => x.completed).reduce((s, x) => s + dur(x), 0);
          supabase.auth.getUser().then(({ data }) => {
            if (!data.user) return;
            void registrarPlacarDoDia(
              data.user.id,
              hoje,
              total ? (feitosMin / total) * 100 : 0,
              feitosMin,
            ).then(() => qc.invalidateQueries({ queryKey: ["challenge-board"] }));
          });
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
      </header>

      <HeroHoje frase={frase} />

      {leitura.estrela && (
        <section className="flex items-center gap-4 rounded-2xl border border-primary/30 bg-primary/5 p-5">
          <Personagem id="estrela" nome="Estrela" estado="radiante" tamanho="md" />
          <div className="min-w-0">
            <h2 className="text-xl">{leitura.estrela.titulo}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{leitura.estrela.frase}</p>
          </div>
        </section>
      )}

      <section className="flex items-center gap-5 rounded-2xl border bg-card p-5">
        <ProgressRing pct={pct} />
        <div className="min-w-0">
          <h2 className="text-xl">Progresso do dia</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {feitas} concluída{feitas === 1 ? "" : "s"} · {restantes} restante
            {restantes === 1 ? "" : "s"}
          </p>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            {formatDuration(minutosFeitos)} de {formatDuration(minutosTotal)}
          </p>
        </div>
      </section>

      <section className="flex items-center gap-4 rounded-2xl border bg-card p-5">
        <Personagem
          id={leitura.destaque.id}
          nome={leitura.destaque.nome}
          estado={leitura.destaque.estado}
          sobrecarregado={leitura.destaque.sobrecarregado}
          tamanho="md"
        />
        <div className="min-w-0">
          <h2 className="text-xl">{leitura.destaque.nome}</h2>
          <p className="text-[0.68rem] uppercase tracking-wide text-muted-foreground">
            {leitura.destaque.principio}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{leitura.destaque.frase}</p>
        </div>
      </section>

      {templateDoDia.length === 0 ? (
        <p className="rounded-xl border border-dashed bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          Sua semana ideal ainda não cobre {NOME_DIA.toLowerCase()}. Reserve horas na{" "}
          <Link to="/semana" className="text-primary underline-offset-4 hover:underline">
            Semana
          </Link>{" "}
          e o dia se monta sozinho.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={refazerDia.isPending}
            onClick={() =>
              refazerDia.mutate(undefined, {
                onSuccess: () => toast.success("Dia refeito a partir da sua semana ideal."),
              })
            }
          >
            Refazer o dia
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={completarComOrcamento.isPending}
            onClick={() =>
              completarComOrcamento.mutate(undefined, {
                onSuccess: (r) => {
                  const res = r as { criados: number; naoCoube: string[] };
                  toast.success(
                    res.criados
                      ? `${res.criados} bloco(s) adicionados do orçamento.`
                      : "Nada faltando: seu dia já reflete o orçamento.",
                  );
                },
              })
            }
          >
            Completar com o orçamento
          </Button>
        </div>
      )}

      <DayChecklist
        blocks={blocos}
        domains={domains}
        dayStart={dayStart}
        onToggle={concluir}
        onMove={(m) => {
          const bloco = blocos.find((b) => b.id === m.id);
          const antesIni = bloco?.start_time;
          const antesFim = bloco?.end_time;
          if (!bloco) return;
          const area = domains.find((d) => d.id === bloco.domain_id);
          const duracao = toMinutes(hhmm(bloco.end_time)) - toMinutes(hhmm(bloco.start_time));
          if (
            area &&
            !horarioCabeNoPeriodo(
              area.preferred_period,
              m.bandStart,
              Math.min(m.bandStart + duracao, m.bandEnd),
              toMinutes(dayStart),
              toMinutes(dayEnd),
            )
          ) {
            toast.error(`${area.name} não pode sair do período escolhido.`);
            return;
          }
          comEscopo(bloco, "Mover esta atividade", (sempre) => {
            mover.mutate(m, {
              onSuccess: async () => {
                if (sempre && bloco.ideal_block_id)
                  await sincronizarTemplate(bloco.id, bloco.ideal_block_id);
                comDesfazer(sempre ? "Movido sempre." : "Movido só hoje.", async () => {
                  await supabase
                    .from("time_blocks")
                    .update({ start_time: antesIni, end_time: antesFim })
                    .eq("id", bloco.id);
                  if (sempre && bloco.ideal_block_id)
                    await supabase
                      .from("ideal_week_blocks")
                      .update({ start_time: antesIni, end_time: antesFim })
                      .eq("id", bloco.ideal_block_id);
                });
              },
            });
          });
        }}
        onMerge={(ids) =>
          unificar.mutate(ids, {
            onSuccess: () => toast.success("Atividades unificadas."),
            onError: () => toast.error("Não deu para unificar."),
          })
        }
        onResize={(b, minutos) => {
          const ini = toMinutes(hhmm(b.start_time));
          const limiteColchete = (Math.floor(ini / breakInterval) + 1) * breakInterval;
          const duracaoValida = Math.max(30, Math.min(minutos, limiteColchete - ini));
          const fimAntes = b.end_time;
          comEscopo(b, "Mudar a duração", (sempre) => {
            moverBloco.mutate(
              { b, ini, fim: ini + duracaoValida },
              {
                onSuccess: async () => {
                  if (sempre && b.ideal_block_id)
                    await sincronizarTemplate(b.id, b.ideal_block_id);
                    comDesfazer(`${b.title}: ${formatDuration(duracaoValida)}.`, async () => {
                    await supabase
                      .from("time_blocks")
                      .update({ end_time: fimAntes })
                      .eq("id", b.id);
                    if (sempre && b.ideal_block_id)
                      await supabase
                        .from("ideal_week_blocks")
                        .update({ end_time: fimAntes })
                        .eq("id", b.ideal_block_id);
                  });
                },
                onError: () => toast.error("Não deu para mudar a duração."),
              },
            );
          });
        }}
        onSplit={(b) =>
          dividirBloco.mutate(b, {
            onSuccess: () => toast.success("Dividido ao meio, na mesma faixa de horário."),
            onError: (e) => toast.error(e instanceof Error ? e.message : "Não deu para dividir."),
          })
        }
        onDelete={(b) =>
          comEscopo(b, "Excluir esta atividade", (sempre) => {
            excluirBloco.mutate(b, {
              onSuccess: async () => {
                if (sempre && b.ideal_block_id)
                  await supabase.from("ideal_week_blocks").delete().eq("id", b.ideal_block_id);
                comDesfazer(sempre ? "Excluído sempre." : "Excluído só hoje.", async () => {
                  await supabase.from("time_blocks").insert({
                    user_id: b.user_id,
                    date: b.date,
                    title: b.title,
                    domain_id: b.domain_id,
                    start_time: b.start_time,
                    end_time: b.end_time,
                    block_kind: b.block_kind,
                    status: b.status,
                    completed: b.completed,
                  });
                });
              },
            });
          })
        }
        onTomorrow={(b) =>
          moverAmanha.mutate(b, {
            onSuccess: () =>
              comDesfazer(`${b.title} foi para amanhã.`, async () => {
                await supabase.from("time_blocks").update({ date: hoje }).eq("id", b.id);
              }),
            onError: () => toast.error("Não deu para adiar."),
          })
        }
        onDuplicate={(b) =>
          duplicarBloco.mutate(b, {
            onSuccess: (id) =>
              comDesfazer("Atividade duplicada.", async () => {
                await supabase
                  .from("time_blocks")
                  .delete()
                  .eq("id", id as string);
              }),
            onError: (e) => toast.error(e instanceof Error ? e.message : "Não deu para duplicar."),
          })
        }
        onPushPending={() =>
          empurrarPendentes.mutate(undefined, {
            onSuccess: (ids) => {
              const lista = (ids as string[]) ?? [];
              if (!lista.length) {
                toast.info("Nada pendente por aqui.");
                return;
              }
              comDesfazer(`${lista.length} atividade(s) foram para amanhã.`, async () => {
                await supabase.from("time_blocks").update({ date: hoje }).in("id", lista);
              });
            },
            onError: () => toast.error("Não deu para empurrar."),
          })
        }
        onAdd={() => {
          const agora = new Date();
          const min = agora.getHours() * 60 + agora.getMinutes();
          setNovo({ startMin: snap(Math.max(toMinutes(dayStart), min)) });
        }}
        onTidy={() =>
          arrumarDia.mutate(undefined, {
            onSuccess: (n) =>
              toast.success(n ? `${n} bloco(s) reacomodado(s).` : "Seu dia já está organizado."),
          })
        }
        onEdit={setEditando}
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
          <p className="mt-3 text-sm text-muted-foreground">Você ainda não orçou esta semana.</p>
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
              {budgets.reduce((s, b) => s + Number(b.planned_hours), 0).toFixed(1)}h comprometidas
              nesta semana.
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

      <EditarBloco
        bloco={editando}
        domains={domains}
        blocos={blocos}
        dayStart={dayStart}
        dayEnd={dayEnd}
        onFechar={() => setEditando(null)}
        salvando={editarBloco.isPending}
        onSalvar={(v) =>
          editarBloco.mutate(v, {
            onError: () => toast.error("Não deu para salvar a atividade."),
          })
        }
        onDuplicate={(b) => duplicarBloco.mutate(b, { onSuccess: () => toast.success("Atividade duplicada.") })}
        onTomorrow={(b) => moverAmanha.mutate(b, { onSuccess: () => setEditando(null) })}
        onSplit={(b) => dividirBloco.mutate(b, { onSuccess: () => setEditando(null) })}
        onDelete={(b) => excluirBloco.mutate(b, { onSuccess: () => setEditando(null) })}
      />

      <Sheet open={!!escopo} onOpenChange={(v) => !v && setEscopo(null)}>
        <SheetContent side="bottom">
          <SheetHeader>
            <SheetTitle>{escopo?.titulo}</SheetTitle>
            <SheetDescription>
              Esta atividade vem da sua semana ideal. Vale só para hoje ou para sempre?
            </SheetDescription>
          </SheetHeader>
          <div className="flex gap-2 px-4 pb-6">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                escopo?.aplicar(false);
                setEscopo(null);
              }}
            >
              Só hoje
            </Button>
            <Button
              className="flex-1"
              onClick={() => {
                escopo?.aplicar(true);
                setEscopo(null);
              }}
            >
              Sempre
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <GuardiaoOverlay guardiao={guardiaoAnim.atual} onClose={guardiaoAnim.fechar} />
    </div>
  );
}

type EdicaoBloco = {
  b: Block;
  titulo: string;
  domainId: string | null;
  inicio: number;
  fim: number;
  completed: boolean;
  sempre: boolean;
};

function EditarBloco({
  bloco,
  domains,
  blocos,
  dayStart,
  dayEnd,
  onFechar,
  onSalvar,
  salvando,
  onDuplicate,
  onTomorrow,
  onSplit,
  onDelete,
}: {
  bloco: Block | null;
  domains: { id: string; name: string; preferred_period: string }[];
  blocos: Block[];
  dayStart: string;
  dayEnd: string;
  onFechar: () => void;
  onSalvar: (v: EdicaoBloco) => void;
  salvando: boolean;
  onDuplicate: (b: Block) => void;
  onTomorrow: (b: Block) => void;
  onSplit: (b: Block) => void;
  onDelete: (b: Block) => void;
}) {
  const [titulo, setTitulo] = useState("");
  const [dominio, setDominio] = useState("");
  const [inicio, setInicio] = useState("06:00");
  const [fim, setFim] = useState("07:00");
  const [concluido, setConcluido] = useState(false);
  const [sempre, setSempre] = useState(false);
  const [erro, setErro] = useState("");
  const hidratando = useRef(true);

  useEffect(() => {
    if (!bloco) return;
    setTitulo(bloco.title);
    setDominio(bloco.domain_id ?? "");
    setInicio(hhmm(bloco.start_time));
    setFim(hhmm(bloco.end_time));
    setConcluido(bloco.completed);
    setSempre(false);
    setErro("");
    hidratando.current = true;
  }, [bloco]);

  function salvar() {
    if (!bloco) return;
    const ini = toMinutes(inicio);
    const end = toMinutes(fim);
    const area = domains.find((d) => d.id === dominio);
    if (!titulo.trim()) return setErro("Dê um nome para a atividade.");
    const refeicao = /caf[ée]|almo[çc]o|lanche|jantar|refei/i.test(bloco.title);
    if (!refeicao && end - ini < 30)
      return setErro("A atividade precisa durar pelo menos 30 minutos.");
    if (ini < toMinutes(dayStart) || end > toMinutes(dayEnd))
      return setErro(`Escolha um horário entre ${dayStart} e ${dayEnd}.`);
    if (end > (Math.floor(ini / 120) + 1) * 120)
      return setErro("A atividade precisa terminar dentro do mesmo colchete de 2 horas.");
    if (area && !horarioCabeNoPeriodo(area.preferred_period, ini, end, toMinutes(dayStart), toMinutes(dayEnd)))
      return setErro(`${area.name} está configurada para o período ${area.preferred_period}.`);
    const conflito = blocos.some(
      (b) =>
        b.id !== bloco.id &&
        ini < toMinutes(hhmm(b.end_time)) &&
        end > toMinutes(hhmm(b.start_time)),
    );
    if (conflito) return setErro("Esse horário já está ocupado por outra atividade ou pausa.");
    onSalvar({
      b: bloco,
      titulo: titulo.trim(),
      domainId: dominio || null,
      inicio: ini,
      fim: end,
      completed: concluido,
      sempre,
    });
  }

  useEffect(() => {
    if (!bloco) return;
    if (hidratando.current) {
      hidratando.current = false;
      return;
    }
    const id = window.setTimeout(salvar, 650);
    return () => window.clearTimeout(id);
    // salvar usa o estado atual do formulário; o debounce reinicia a cada campo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [titulo, dominio, inicio, fim, concluido, sempre, bloco]);

  return (
    <Sheet open={!!bloco} onOpenChange={(v) => !v && onFechar()}>
      <SheetContent side="bottom" className="max-h-[92dvh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Editar atividade</SheetTitle>
          <SheetDescription>Altere o horário e os detalhes deste bloco.</SheetDescription>
        </SheetHeader>
        <div className="space-y-4 px-4 pb-6">
          <div className="space-y-2">
            <Label htmlFor="e-titulo">Atividade</Label>
            <Input id="e-titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Área da vida</Label>
            <Select value={dominio} onValueChange={setDominio}>
              <SelectTrigger><SelectValue placeholder="Sem área" /></SelectTrigger>
              <SelectContent>
                {domains.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="e-inicio">Começa</Label>
              <Input id="e-inicio" type="time" step={900} value={inicio} onChange={(e) => setInicio(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="e-fim">Termina</Label>
              <Input id="e-fim" type="time" step={900} value={fim} onChange={(e) => setFim(e.target.value)} />
            </div>
          </div>
          <label className="flex items-center gap-3 rounded-xl border p-3 text-sm">
            <Checkbox checked={concluido} onCheckedChange={(v) => setConcluido(v === true)} />
            Atividade concluída
          </label>
          <label className="flex items-center gap-3 rounded-xl border p-3 text-sm">
            <Checkbox checked={sempre} onCheckedChange={(v) => setSempre(v === true)} />
            Definir esta atividade sempre para este horário
          </label>
          {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {salvando ? "Salvando…" : erro ? "Revise os campos acima." : "Alterações salvas automaticamente."}
          </p>
          {bloco && (
            <div className="grid grid-cols-2 gap-2 border-t pt-4">
              <Button variant="outline" onClick={() => onDuplicate(bloco)}>Duplicar</Button>
              <Button variant="outline" onClick={() => onTomorrow(bloco)}>Adiar</Button>
              <Button variant="outline" onClick={() => onSplit(bloco)}>Dividir</Button>
              <Button variant="outline" className="text-destructive" onClick={() => onDelete(bloco)}>Excluir</Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
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
