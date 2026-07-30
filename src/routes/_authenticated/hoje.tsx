import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  useDailyPlan,
  useDomains,
  useHabitLogs,
  useHabits,
  useProfile,
  useSaveMutation,
  useSettings,
  useTasksByDate,
  useTimeBudgets,
  useWeeklyPlan,
} from "@/lib/data";
import { formatLongDate, todayISO } from "@/lib/dates";
import { ensureDayTasksFromBudget } from "@/lib/day-fill";
import { quoteOfTheDay } from "@/lib/quotes";
import { BreakBar } from "@/components/break-bar";
import { DailyChecklist, type ChecklistItem } from "@/components/daily-checklist";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";

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
  const tarefasQuery = useTasksByDate(hoje);
  const tarefasHoje = tarefasQuery.data ?? [];
  const { data: plan } = useDailyPlan(hoje);
  const { data: weekly } = useWeeklyPlan();
  const { data: budgets = [] } = useTimeBudgets(weekly?.id);
  const { data: habits = [] } = useHabits();
  const { data: logs = [] } = useHabitLogs(hoje, hoje);
  const [intencao, setIntencao] = useState("");
  const preenchido = useRef<string | null>(null);

  useEffect(() => {
    if (profile && !profile.onboarding_completed) navigate({ to: "/onboarding", replace: true });
  }, [profile, navigate]);

  useEffect(() => {
    setIntencao(plan?.intention ?? "");
  }, [plan?.intention]);

  const salvarIntencao = useSaveMutation<string>(async (texto, userId) => {
    const { error } = await supabase
      .from("daily_plans")
      .upsert({ user_id: userId, date: hoje, intention: texto }, { onConflict: "user_id,date" });
    if (error) throw error;
  }, ["daily-plan"]);

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

  const alternarTarefa = useSaveMutation<{ id: string; done: boolean }>(async ({ id, done }) => {
    const { error } = await supabase
      .from("tasks")
      .update({ status: done ? "feita" : "agendada" })
      .eq("id", id);
    if (error) throw error;
    await supabase
      .from("time_blocks")
      .update({ completed: done, status: done ? "feito" : "planejado" })
      .eq("task_id", id);
  }, ["tasks-day", "tasks", "blocks", "blocks-range"]);

  // O checklist nasce do orçamento da semana: cada área marcada para hoje vira item.
  const preencherDia = useSaveMutation<void>(
    async (_v, userId) =>
      ensureDayTasksFromBudget({
        dateISO: hoje,
        weekday: diaSemana,
        userId,
        domains,
        budgets,
        tasks: tarefasHoje,
      }),
    ["tasks-day", "tasks"],
  );

  useEffect(() => {
    if (!weekly || domains.length === 0 || !tarefasQuery.isSuccess) return;
    const chave = `${hoje}:${budgets.length}:${domains.length}`;
    if (preenchido.current === chave) return;
    preenchido.current = chave;
    preencherDia.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hoje, weekly, domains, budgets, tarefasQuery.isSuccess]);

  const habitosHoje = habits.filter((h) => h.frequency.includes(diaSemana));
  const planejado = budgets.reduce((s, b) => s + Number(b.planned_hours), 0);
  const frase = quoteOfTheDay(hoje, !!profile?.spiritual_mode);

  const itens: ChecklistItem[] = [
    ...tarefasHoje.map((t) => ({
      id: t.id,
      label: t.title,
      done: t.status === "feita",
      minutes: t.estimated_minutes,
      color: domains.find((d) => d.id === t.domain_id)?.color,
      hint: t.allows_break ? undefined : "sem pausa no meio",
      onToggle: (done: boolean) => alternarTarefa.mutate({ id: t.id, done }),
    })),
    ...habitosHoje.map((h) => ({
      id: h.id,
      label: h.name,
      done: !!logs.find((l) => l.habit_id === h.id)?.completed,
      color: domains.find((d) => d.id === h.domain_id)?.color,
      hint: h.type === "evitar" ? "hábito a evitar" : "hábito",
      onToggle: (done: boolean) => alternarHabito.mutate({ habitId: h.id, completed: done }),
    })),
  ];

  return (
    <div className="space-y-8 pb-20">
      <header>
        <p className="text-sm text-muted-foreground">{formatLongDate(hoje)}</p>
        <h1 className="text-4xl">Hoje</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {NOME_DIA} · o checklist vem do que você reservou na Semana.
        </p>
      </header>

      <section className="rounded-2xl border-l-4 border-l-primary bg-card p-5">
        <p className="text-lg leading-relaxed">“{frase.text}”</p>
        <p className="mt-2 text-sm text-muted-foreground">— {frase.author}</p>
      </section>

      <section className="rounded-2xl border bg-card p-5">
        <h2 className="text-xl">
          {profile?.spiritual_mode ? "Comece pela Palavra" : "Intenção do dia"}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {profile?.spiritual_mode
            ? "Uma reflexão ou versículo para ancorar o dia."
            : "Uma frase-âncora para o dia."}
        </p>
        <Textarea
          className="mt-3"
          rows={3}
          value={intencao}
          placeholder="Hoje eu quero…"
          onChange={(e) => setIntencao(e.target.value)}
        />
        <Button
          className="mt-3"
          variant="outline"
          disabled={salvarIntencao.isPending}
          onClick={() =>
            salvarIntencao.mutate(intencao, {
              onSuccess: () => toast.success("Intenção guardada."),
              onError: () => toast.error("Não foi possível salvar."),
            })
          }
        >
          Salvar
        </Button>
      </section>

      <DailyChecklist items={itens} />

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
              {planejado.toFixed(1)}h comprometidas nesta semana.
            </p>
          </div>
        )}
      </section>

      <BreakBar
        cycleMinutes={settings?.break_interval_minutes ?? 120}
        breakMinutes={settings?.break_duration_minutes ?? 15}
      />
    </div>
  );
}