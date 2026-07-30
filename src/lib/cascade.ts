import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { hoursBetween } from "./dates";
import { sameArea } from "./areas";
import { REFEICOES_PADRAO, gerarSemanaIdeal, pausasSugeridasPorDia } from "./ideal-week";

export const WEEK_HOURS = 168;
export const DAY_HOURS = 24;

export type IdealBlock = Tables<"ideal_week_blocks">;

export const SLEEP_DOMAIN = "Dormir";
export const WORK_DOMAIN = "Trabalho";

/** Cria (ou atualiza) as áreas-âncora Dormir e Trabalho a partir dos sliders. */
export async function ensureAnchorDomains(
  userId: string,
  sleepPerDay: number,
  workPerDay: number,
  workDays: number[],
) {
  const rows = [
    { name: SLEEP_DOMAIN, color: "#5b7fa6", hours: sleepPerDay * 7, days: [0, 1, 2, 3, 4, 5, 6] },
    { name: WORK_DOMAIN, color: "#a8763e", hours: workPerDay * workDays.length, days: workDays },
  ];
  for (const r of rows) {
    const { data: existing } = await supabase
      .from("life_domains")
      .select("id")
      .eq("user_id", userId)
      .ilike("name", r.name)
      .maybeSingle();
    if (existing) {
      const { error } = await supabase
        .from("life_domains")
        .update({
          is_anchor: true,
          default_weekly_hours: r.hours,
          preferred_days: r.days,
          is_archived: false,
        })
        .eq("id", existing.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("life_domains").insert({
        user_id: userId,
        name: r.name,
        color: r.color,
        is_anchor: true,
        default_weekly_hours: r.hours,
        preferred_days: r.days,
      });
      if (error) throw error;
    }
  }
}

const ehSono = (nome: string) => /dorm|sono|sleep/i.test(nome);

/**
 * Regenera a Semana Ideal a partir do que está salvo hoje: âncoras (settings)
 * e horas/dias por área (life_domains). É a única fonte do dia.
 */
export async function rebuildIdealWeek(userId: string) {
  const { data: settings } = await supabase
    .from("settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  const { data: domains } = await supabase
    .from("life_domains")
    .select("*")
    .eq("user_id", userId)
    .eq("is_archived", false);

  const sono = Number(settings?.sleep_hours_per_day ?? 7.5);
  const horasTrabalho = Number(settings?.work_hours_per_day ?? 0);
  const diasTrabalho = (settings?.work_days ?? [0, 1, 2, 3, 4]).map(Number);
  const refeicoesPorDia = REFEICOES_PADRAO;
  const pausasPorDia = pausasSugeridasPorDia(sono, refeicoesPorDia);

  const horasPorArea: Record<string, number> = {};
  const diasPorArea: Record<string, number[]> = {};
  const idPorNome: Record<string, string> = {};
  for (const d of domains ?? []) {
    idPorNome[d.name] = d.id;
    if (ehSono(d.name) || sameArea(d.name, WORK_DOMAIN)) continue;
    if (sameArea(d.name, "Alimentação") || sameArea(d.name, "Pausas")) continue;
    const horas = Number(d.default_weekly_hours ?? 0);
    if (horas <= 0) continue;
    horasPorArea[d.name] = horas;
    diasPorArea[d.name] = (d.preferred_days ?? [0, 1, 2, 3, 4, 5, 6]).map(Number);
  }

  const padroes = gerarSemanaIdeal({
    sono,
    horasTrabalho,
    diasTrabalho,
    refeicoesPorDia,
    pausasPorDia,
    horasPorArea,
    diasPorArea,
  });

  const acharId = (area: string) =>
    Object.entries(idPorNome).find(([nome]) => sameArea(nome, area))?.[1] ?? null;

  await supabase.from("ideal_week_blocks").delete().eq("user_id", userId);
  if (!padroes.length) return 0;
  const { error } = await supabase.from("ideal_week_blocks").insert(
    padroes.map((p) => ({
      user_id: userId,
      day_of_week: p.dayOfWeek,
      start_time: p.startTime,
      end_time: p.endTime,
      title: p.title,
      domain_id: acharId(p.area),
    })),
  );
  if (error) throw error;
  return padroes.length;
}

/**
 * Apaga os blocos que o app gerou automaticamente no dia (sem tarefa ligada e
 * ainda não concluídos) e recria o dia a partir da Semana Ideal.
 */
export async function resetDayFromTemplate(userId: string, dateISO: string) {
  const { error } = await supabase
    .from("time_blocks")
    .delete()
    .eq("user_id", userId)
    .eq("date", dateISO)
    .is("task_id", null)
    .eq("completed", false);
  if (error) throw error;
  return generateDayFromTemplate(userId, dateISO);
}

/** Gera os blocos reais de um dia a partir do template da semana ideal. */
export async function generateDayFromTemplate(userId: string, dateISO: string) {
  const dow = (new Date(`${dateISO}T00:00:00`).getDay() + 6) % 7;
  const { data: template, error } = await supabase
    .from("ideal_week_blocks")
    .select("*")
    .eq("user_id", userId)
    .eq("day_of_week", dow);
  if (error) throw error;
  if (!template?.length) return 0;

  const { data: existentes } = await supabase
    .from("time_blocks")
    .select("ideal_block_id")
    .eq("user_id", userId)
    .eq("date", dateISO);
  const jaGerados = new Set((existentes ?? []).map((b) => b.ideal_block_id).filter(Boolean));

  const novos = template
    .filter((t) => !jaGerados.has(t.id))
    .map((t) => ({
      user_id: userId,
      date: dateISO,
      title: t.title,
      start_time: t.start_time,
      end_time: t.end_time,
      domain_id: t.domain_id,
      goal_id: t.goal_id,
      is_focus_block: t.is_focus_block,
      ideal_block_id: t.id,
      status: "planejado",
    }));
  if (!novos.length) return 0;
  const { error: insErr } = await supabase.from("time_blocks").insert(novos);
  if (insErr) throw insErr;
  return novos.length;
}

type Intervalo = { start_time: string; end_time: string; id?: string };

/** Retorna os ids/índices que se sobrepõem a outro bloco. */
export function findOverlaps<T extends Intervalo>(blocks: T[]) {
  const conflitos = new Set<T>();
  const ordenados = [...blocks].sort((a, b) => a.start_time.localeCompare(b.start_time));
  for (let i = 1; i < ordenados.length; i++) {
    if (ordenados[i].start_time < ordenados[i - 1].end_time) {
      conflitos.add(ordenados[i]);
      conflitos.add(ordenados[i - 1]);
    }
  }
  return conflitos;
}

export function totalHours(blocks: Intervalo[]) {
  return blocks.reduce((s, b) => s + hoursBetween(b.start_time, b.end_time), 0);
}