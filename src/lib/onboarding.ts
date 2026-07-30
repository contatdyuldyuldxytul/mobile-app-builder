import { supabase } from "@/integrations/supabase/client";
import { areaColor, sameArea } from "./areas";
import { ensureAnchorDomains } from "./cascade";
import { toISODate, weekStart } from "./dates";
import type { RoutinePattern } from "./routine-detect";

export type OnboardingPayload = {
  sono: number;
  horasTrabalho: number;
  diasTrabalho: number[];
  areas: string[];
  horasPorArea: Record<string, number>;
  padroes: RoutinePattern[];
  rituais: { morning: string; evening: string; breaks: boolean };
};

/** Cria as áreas escolhidas sem duplicar as que já existem. Devolve nome → id. */
async function upsertAreas(userId: string, areas: string[], horas: Record<string, number>) {
  const { data: existentes, error } = await supabase
    .from("life_domains")
    .select("id, name")
    .eq("user_id", userId);
  if (error) throw error;

  const mapa: Record<string, string> = {};
  for (const [i, nome] of areas.entries()) {
    const jaExiste = (existentes ?? []).find((d) => sameArea(d.name, nome));
    const semanais = Math.max(0, horas[nome] ?? 0);
    if (jaExiste) {
      const { error: eUp } = await supabase
        .from("life_domains")
        .update({ default_weekly_hours: semanais, is_archived: false })
        .eq("id", jaExiste.id);
      if (eUp) throw eUp;
      mapa[nome] = jaExiste.id;
      continue;
    }
    const { data, error: eIns } = await supabase
      .from("life_domains")
      .insert({
        user_id: userId,
        name: nome,
        color: areaColor(nome),
        sort_order: i,
        default_weekly_hours: semanais,
      })
      .select("id")
      .single();
    if (eIns) throw eIns;
    mapa[nome] = data.id;
  }
  return mapa;
}

/** Grava tudo o que o onboarding decidiu: âncoras, áreas, orçamento e semana ideal. */
export async function saveOnboarding(userId: string, p: OnboardingPayload) {
  const { error: eSet } = await supabase.from("settings").upsert(
    {
      user_id: userId,
      sleep_hours_per_day: p.sono,
      work_hours_per_day: p.horasTrabalho,
      work_days: p.diasTrabalho,
      anchors_configured: true,
      morning_checkin_time: p.rituais.morning,
      evening_checkin_time: p.rituais.evening,
      break_reminders_enabled: p.rituais.breaks,
    },
    { onConflict: "user_id" },
  );
  if (eSet) throw eSet;

  await ensureAnchorDomains(userId, p.sono, p.horasTrabalho, p.diasTrabalho);

  const areasSemAncoras = p.areas.filter((a) => !sameArea(a, "Trabalho"));
  const idsPorArea = await upsertAreas(userId, areasSemAncoras, p.horasPorArea);

  // Trabalho vira a âncora já criada — pega o id dela para os blocos.
  const { data: todosDominios } = await supabase
    .from("life_domains")
    .select("id, name")
    .eq("user_id", userId);
  for (const d of todosDominios ?? []) {
    const nome = p.areas.find((a) => sameArea(a, d.name));
    if (nome && !idsPorArea[nome]) idsPorArea[nome] = d.id;
  }

  // Orçamento da semana atual a partir das horas escolhidas.
  const iso = toISODate(weekStart());
  let { data: plano } = await supabase
    .from("weekly_plans")
    .select("id")
    .eq("user_id", userId)
    .eq("week_start_date", iso)
    .maybeSingle();
  if (!plano) {
    const { data: criado, error } = await supabase
      .from("weekly_plans")
      .insert({ user_id: userId, week_start_date: iso })
      .select("id")
      .single();
    if (error) throw error;
    plano = criado;
  }

  for (const [nome, horas] of Object.entries(p.horasPorArea)) {
    const domainId = idsPorArea[nome];
    if (!domainId || horas <= 0) continue;
    const { data: existente } = await supabase
      .from("time_budgets")
      .select("id")
      .eq("weekly_plan_id", plano.id)
      .eq("domain_id", domainId)
      .maybeSingle();
    if (existente) {
      await supabase
        .from("time_budgets")
        .update({ planned_hours: horas })
        .eq("id", existente.id);
    } else {
      const { error } = await supabase.from("time_budgets").insert({
        user_id: userId,
        weekly_plan_id: plano.id,
        domain_id: domainId,
        planned_hours: horas,
      });
      if (error) throw error;
    }
  }

  // Semana ideal: um bloco por padrão confirmado.
  await supabase.from("ideal_week_blocks").delete().eq("user_id", userId);
  const blocos = p.padroes.map((padrao) => ({
    user_id: userId,
    day_of_week: padrao.dayOfWeek,
    start_time: padrao.startTime,
    end_time: padrao.endTime,
    title: padrao.title,
    domain_id: idsPorArea[padrao.area] ?? null,
  }));
  if (blocos.length) {
    const { error } = await supabase.from("ideal_week_blocks").insert(blocos);
    if (error) throw error;
  }

  // Guarda os padrões detectados para futuras releituras da agenda.
  await supabase.from("routine_patterns").delete().eq("user_id", userId);
  if (p.padroes.length) {
    await supabase.from("routine_patterns").insert(
      p.padroes.map((padrao) => ({
        user_id: userId,
        title: padrao.title,
        day_of_week: padrao.dayOfWeek,
        start_time: padrao.startTime,
        end_time: padrao.endTime,
        occurrences: padrao.occurrences,
        suggested_area: padrao.area,
        confidence: padrao.confidence,
        domain_id: idsPorArea[padrao.area] ?? null,
      })),
    );
  }

  const { error: eProf } = await supabase
    .from("profiles")
    .update({ onboarding_completed: true })
    .eq("id", userId);
  if (eProf) throw eProf;
}

/** Sem agenda conectada: propõe blocos a partir do orçamento escolhido. */
export function patternsFromBudget(horasPorArea: Record<string, number>): RoutinePattern[] {
  const padroes: RoutinePattern[] = [];
  const diasPorArea: Record<string, number[]> = {};
  const inicioPorDia: Record<number, number> = {};

  for (const [area, horas] of Object.entries(horasPorArea)) {
    if (horas <= 0) continue;
    const dias = diasPorArea[area] ?? [0, 1, 2, 3, 4, 5, 6];
    const porDia = horas / dias.length;
    if (porDia < 0.25) continue;
    for (const dia of dias) {
      const inicio = inicioPorDia[dia] ?? 18 * 60;
      const duracao = Math.round((porDia * 60) / 15) * 15;
      if (inicio + duracao > 23 * 60) continue;
      padroes.push({
        title: area,
        dayOfWeek: dia,
        startTime: `${String(Math.floor(inicio / 60)).padStart(2, "0")}:${String(inicio % 60).padStart(2, "0")}`,
        endTime: `${String(Math.floor((inicio + duracao) / 60)).padStart(2, "0")}:${String((inicio + duracao) % 60).padStart(2, "0")}`,
        occurrences: 1,
        area,
        confidence: 1,
      });
      inicioPorDia[dia] = inicio + duracao;
    }
  }
  return padroes.sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime));
}