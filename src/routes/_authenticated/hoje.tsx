import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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
  useTimeBlocks,
  useTimeBudgets,
  useWeeklyPlan,
} from "@/lib/data";
import { formatLongDate, hoursBetween, shortTime, todayISO } from "@/lib/dates";
import { FocusTimer } from "@/components/focus-timer";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";

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
  const navigate = useNavigate();
  const { data: profile } = useProfile();
  const { data: settings } = useSettings();
  const { data: domains = [] } = useDomains();
  const { data: blocks = [] } = useTimeBlocks(hoje);
  const { data: plan } = useDailyPlan(hoje);
  const { data: weekly } = useWeeklyPlan();
  const { data: budgets = [] } = useTimeBudgets(weekly?.id);
  const { data: habits = [] } = useHabits();
  const { data: logs = [] } = useHabitLogs(hoje, hoje);
  const [intencao, setIntencao] = useState("");

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

  const diaSemana = (new Date().getDay() + 6) % 7;
  const habitosHoje = habits.filter((h) => h.frequency.includes(diaSemana));
  const planejado = budgets.reduce((s, b) => s + Number(b.planned_hours), 0);
  const agora = new Date().toTimeString().slice(0, 5);
  const proximo = blocks.find((b) => shortTime(b.start_time) > agora);
  const horasHoje = blocks.reduce((s, b) => s + hoursBetween(b.start_time, b.end_time), 0);

  return (
    <div className="space-y-8">
      <header>
        <p className="text-sm text-muted-foreground">{formatLongDate(hoje)}</p>
        <h1 className="text-4xl">Hoje</h1>
      </header>

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

      <section className="rounded-2xl border bg-card p-5">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xl">Blocos de hoje</h2>
          <Link to="/diaria" className="text-sm text-primary underline-offset-4 hover:underline">
            Editar agenda
          </Link>
        </div>
        {blocks.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Nenhum bloco ainda. Comece pela agenda diária.
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {blocks.map((b) => {
              const dom = domains.find((d) => d.id === b.domain_id);
              return (
                <li
                  key={b.id}
                  className={`flex items-center gap-3 rounded-xl border-l-4 bg-muted/40 px-3 py-2 ${
                    proximo?.id === b.id ? "ring-1 ring-primary" : ""
                  }`}
                  style={{ borderLeftColor: dom?.color ?? "var(--border)" }}
                >
                  <span className="w-24 shrink-0 font-mono text-xs text-muted-foreground">
                    {shortTime(b.start_time)}–{shortTime(b.end_time)}
                  </span>
                  <span className="flex-1 text-sm">{b.title}</span>
                  {b.is_focus_block && <span className="text-xs text-primary">foco</span>}
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          {horasHoje.toFixed(1)}h agendadas hoje.
        </p>
      </section>

      <FocusTimer breakMinutes={settings?.break_interval_minutes ?? 120} />

      {habitosHoje.length > 0 && (
        <section className="rounded-2xl border bg-card p-5">
          <h2 className="text-xl">Hábitos de hoje</h2>
          <ul className="mt-4 space-y-3">
            {habitosHoje.map((h) => {
              const log = logs.find((l) => l.habit_id === h.id);
              return (
                <li key={h.id} className="flex items-center gap-3">
                  <Checkbox
                    checked={!!log?.completed}
                    onCheckedChange={(v) =>
                      alternarHabito.mutate({ habitId: h.id, completed: !!v })
                    }
                  />
                  <span className="text-sm">{h.name}</span>
                  {h.type === "evitar" && (
                    <span className="text-xs text-muted-foreground">(evitar)</span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="rounded-2xl border bg-card p-5">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xl">Orçamento da semana</h2>
          <Link to="/semanal" className="text-sm text-primary underline-offset-4 hover:underline">
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

      <Button asChild variant="secondary" className="w-full">
        <Link to="/revisao">Fazer o check-in do dia</Link>
      </Button>
    </div>
  );
}