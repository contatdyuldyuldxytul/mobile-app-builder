import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { findSlot, sliceWithBreaks, toMinutes, toTime } from "./scheduler";

export type Task = Tables<"tasks">;

export type BreakPrefs = {
  intervalMinutes: number;
  breakMinutes: number;
  dayStart: string;
  dayEnd: string;
};

/**
 * Mantém a agenda em dia com a tarefa: apaga os blocos antigos dela e, se ela
 * tiver um dia marcado, posiciona-a no primeiro intervalo livre, já fatiada
 * com as pausas de descanso.
 */
export async function syncTaskBlocks(task: Task, userId: string, prefs: BreakPrefs) {
  await supabase.from("time_blocks").delete().eq("task_id", task.id);
  if (!task.scheduled_date) return { ok: true as const };

  const { data: ocupados } = await supabase
    .from("time_blocks")
    .select("start_time,end_time")
    .eq("user_id", userId)
    .eq("date", task.scheduled_date);

  const duracaoTotal = task.allows_break
    ? task.estimated_minutes +
      Math.max(0, Math.ceil(task.estimated_minutes / prefs.intervalMinutes) - 1) * prefs.breakMinutes
    : task.estimated_minutes;

  const slot = findSlot(ocupados ?? [], duracaoTotal, prefs.dayStart, prefs.dayEnd);
  if (!slot) return { ok: false as const, reason: "sem-espaco" as const };

  const fatias = sliceWithBreaks(slot.start_time, task.estimated_minutes, {
    allowsBreak: task.allows_break,
    intervalMinutes: prefs.intervalMinutes,
    breakMinutes: prefs.breakMinutes,
  });

  const linhas = fatias.map((f) => ({
    user_id: userId,
    task_id: task.id,
    date: task.scheduled_date!,
    title: f.kind === "pausa" ? "Pausa" : task.title,
    start_time: f.start_time,
    end_time: f.end_time,
    domain_id: f.kind === "pausa" ? null : task.domain_id,
    goal_id: f.kind === "pausa" ? null : task.goal_id,
    block_kind: f.kind,
    allows_break: task.allows_break,
    status: "planejado",
  }));

  const { error } = await supabase.from("time_blocks").insert(linhas);
  if (error) throw error;
  return { ok: true as const, start: slot.start_time, end: toTime(toMinutes(slot.start_time) + duracaoTotal) };
}

export function breakPrefsFrom(
  settings: Tables<"settings"> | null | undefined,
  profile: Tables<"profiles"> | null | undefined,
) {
  return {
    intervalMinutes: settings?.break_interval_minutes ?? 120,
    breakMinutes: settings?.break_duration_minutes ?? 15,
    dayStart: profile?.day_start?.slice(0, 5) ?? "06:00",
    dayEnd: profile?.day_end?.slice(0, 5) ?? "22:00",
  } satisfies BreakPrefs;
}