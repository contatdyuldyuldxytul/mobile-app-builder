import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { hoursBetween } from "./dates";
import { sameArea } from "./areas";
import {
  MINUTOS_REFEICOES_DIA,
  REFEICOES_HORARIOS,
  gerarSemanaIdealDetalhado,
  minutosRefeicoesDia,
  pausasSugeridasPorDia,
  type Periodo,
} from "./ideal-week";

export const WEEK_HOURS = 168;
export const DAY_HOURS = 24;

/**
 * Quantas horas por dia sobram de verdade para as áreas da vida (trabalho
 * incluído), depois de tirar sono, refeições e as pausas de 2 em 2 horas.
 * É o teto do orçamento: acima disso o dia não existe.
 */
export function capacidadeAcordadaPorDia(sonoHoras: number, pausaMinutos = 15) {
  const refeicoes = MINUTOS_REFEICOES_DIA / 60;
  const pausas = pausasSugeridasPorDia(sonoHoras, refeicoes, pausaMinutos);
  return Math.max(0, DAY_HOURS - sonoHoras - refeicoes - pausas);
}

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
    { name: SLEEP_DOMAIN, color: "#0D1D37", hours: sleepPerDay * 7, days: [0, 1, 2, 3, 4, 5, 6] },
    { name: WORK_DOMAIN, color: "#369792", hours: workPerDay * workDays.length, days: workDays },
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
  const duracaoRefeicao = {
    cafe: Number(settings?.meal_breakfast_minutes ?? 20),
    almoco: Number(settings?.meal_lunch_minutes ?? 45),
    lanche: Number(settings?.meal_snack_minutes ?? 15),
    jantar: Number(settings?.meal_dinner_minutes ?? 40),
  };
  const refeicoesPorDia = minutosRefeicoesDia(duracaoRefeicao) / 60;
  const pausaMinutos = Number(settings?.break_duration_minutes ?? 15);
  const pausasPorDia = pausasSugeridasPorDia(sono, refeicoesPorDia, pausaMinutos);
  const acordarTxt = (settings?.wake_time ?? "06:00").slice(0, 5);
  const [ah, am] = acordarTxt.split(":").map(Number);
  const acordar = ah * 60 + (am || 0);
  const cicloFoco = Number(settings?.focus_cycle_minutes ?? 120);
  const refeicoes = {
    cafe: (settings?.breakfast_time ?? REFEICOES_HORARIOS.cafe).slice(0, 5),
    almoco: (settings?.lunch_time ?? REFEICOES_HORARIOS.almoco).slice(0, 5),
    lanche: (settings?.snack_time ?? REFEICOES_HORARIOS.lanche).slice(0, 5),
    jantar: (settings?.dinner_time ?? REFEICOES_HORARIOS.jantar).slice(0, 5),
  };

  const horasPorArea: Record<string, number> = {};
  const diasPorArea: Record<string, number[]> = {};
  const periodoPorArea: Record<string, Periodo> = {};
  const idPorNome: Record<string, string> = {};
  for (const d of domains ?? []) {
    idPorNome[d.name] = d.id;
    if (ehSono(d.name) || sameArea(d.name, WORK_DOMAIN)) continue;
    if (sameArea(d.name, "Alimentação") || sameArea(d.name, "Pausas")) continue;
    const horas = Number(d.default_weekly_hours ?? 0);
    if (horas <= 0) continue;
    horasPorArea[d.name] = horas;
    diasPorArea[d.name] = (d.preferred_days ?? [0, 1, 2, 3, 4, 5, 6]).map(Number);
    periodoPorArea[d.name] = ((d as { preferred_period?: string }).preferred_period ??
      "qualquer") as Periodo;
  }

  const { padroes, naoCoube } = gerarSemanaIdealDetalhado({
    sono,
    horasTrabalho,
    diasTrabalho,
    refeicoesPorDia,
    pausasPorDia,
    refeicoes,
    pausaMinutos,
    acordar,
    cicloFoco,
    duracaoRefeicao,
    horasPorArea,
    diasPorArea,
    periodoPorArea,
  });

  const acharId = (area: string) =>
    Object.entries(idPorNome).find(([nome]) => sameArea(nome, area))?.[1] ?? null;

  await supabase.from("ideal_week_blocks").delete().eq("user_id", userId);
  if (!padroes.length) return { total: 0, naoCoube };
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
  return { total: padroes.length, naoCoube };
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
    .map((t) => {
      const ehPausa = /pausa|descanso r[áa]pido/i.test(t.title);
      return {
        user_id: userId,
        date: dateISO,
        title: t.title,
        start_time: t.start_time,
        end_time: t.end_time,
        domain_id: t.domain_id,
        goal_id: t.goal_id,
        is_focus_block: t.is_focus_block,
        ideal_block_id: t.id,
        block_kind: (ehPausa ? "pausa" : "tarefa") as "pausa" | "tarefa",
        allows_break: !ehPausa,
        status: "planejado",
      };
    });
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
