import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type Domain = Tables<"life_domains">;
type Budget = Tables<"time_budgets">;
type Task = Tables<"tasks">;

/** Minutos por dia de uma área, dado o total semanal e os dias escolhidos. */
export function minutesPerDay(weeklyHours: number, days: number[]) {
  const n = days.length || 1;
  return Math.round((weeklyHours * 60) / n);
}

/**
 * O checklist do dia nasce do orçamento da semana: cada área que escolheu
 * este dia da semana vira um item, com a fatia diária de horas.
 * É idempotente — só cria o que ainda não existe para a data.
 */
export async function ensureDayTasksFromBudget(args: {
  dateISO: string;
  weekday: number;
  userId: string;
  domains: Domain[];
  budgets: Budget[];
  tasks: Task[];
}) {
  const { dateISO, weekday, userId, domains, budgets, tasks } = args;

  // Limpa duplicatas da mesma área no mesmo dia (uma área = um item no dia).
  const vistos = new Set<string>();
  const duplicadas: string[] = [];
  for (const t of tasks) {
    if (!t.domain_id) continue;
    if (vistos.has(t.domain_id)) duplicadas.push(t.id);
    else vistos.add(t.domain_id);
  }
  if (duplicadas.length) await supabase.from("tasks").delete().in("id", duplicadas);

  const linhas = domains
    .filter((d) => !d.is_anchor)
    .map((d) => {
      const b = budgets.find((x) => x.domain_id === d.id);
      const horas = Number(b?.planned_hours ?? d.default_weekly_hours ?? 0);
      const dias = (d.preferred_days ?? []).map(Number);
      return { d, horas, dias };
    })
    .filter(
      ({ d, horas, dias }) =>
        horas > 0 &&
        dias.includes(weekday) &&
        !tasks.some((t) => t.domain_id === d.id),
    )
    .map(({ d, horas, dias }) => ({
      user_id: userId,
      title: d.name,
      domain_id: d.id,
      scheduled_date: dateISO,
      estimated_minutes: minutesPerDay(horas, dias),
      status: "agendada" as const,
    }));

  if (!linhas.length) return 0;
  const { error } = await supabase.from("tasks").insert(linhas);
  if (error) throw error;
  return linhas.length;
}
