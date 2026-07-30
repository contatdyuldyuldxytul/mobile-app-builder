import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { findSlot, sliceWithBreaks, toMinutes, toTime } from "./scheduler";

export type Block = Tables<"time_blocks">;
export type Domain = Tables<"life_domains">;
export type Budget = Tables<"time_budgets">;

export const STEP = 15;

/** A área que representa o sono — vira faixa fixa da noite, não bloco do dia. */
export function isSleepDomain(d: Domain) {
  return /dorm|sono|sleep/i.test(d.name);
}

export function snap(minutes: number, step = STEP) {
  return Math.round(minutes / step) * step;
}

export function hhmm(t: string) {
  return t.slice(0, 5);
}

/** Quantos minutos esta área pede no dia da semana informado. */
export function dailyMinutes(d: Domain, budgets: Budget[], weekday: number) {
  const dias = (d.preferred_days ?? []).map(Number);
  if (!dias.includes(weekday)) return 0;
  const b = budgets.find((x) => x.domain_id === d.id);
  const semana = Number(b?.planned_hours ?? d.default_weekly_hours ?? 0);
  if (semana <= 0) return 0;
  return snap((semana * 60) / (dias.length || 1));
}

type EnsureArgs = {
  dateISO: string;
  weekday: number;
  userId: string;
  domains: Domain[];
  budgets: Budget[];
  blocks: Block[];
  dayStart: string;
  dayEnd: string;
  breakInterval: number;
  breakMinutes: number;
};

/**
 * Traduz o orçamento da semana em blocos com hora marcada no dia.
 * Idempotente: só cria o que ainda não existe e nunca mexe no que você moveu.
 */
export async function ensureDayBlocks(args: EnsureArgs) {
  const {
    dateISO,
    weekday,
    userId,
    domains,
    budgets,
    blocks,
    dayStart,
    dayEnd,
    breakInterval,
    breakMinutes,
  } = args;

  const ocupados = blocks.map((b) => ({ start_time: hhmm(b.start_time), end_time: hhmm(b.end_time) }));
  const jaTem = new Set(blocks.map((b) => b.domain_id).filter(Boolean) as string[]);

  const pendentes = domains
    .filter((d) => !isSleepDomain(d) && !jaTem.has(d.id))
    .map((d) => ({ d, minutos: dailyMinutes(d, budgets, weekday) }))
    .filter((x) => x.minutos > 0)
    // âncoras (trabalho/estudo) primeiro: são o esqueleto do dia
    .sort((a, b) => Number(b.d.is_anchor) - Number(a.d.is_anchor) || a.d.sort_order - b.d.sort_order);

  const linhas: Record<string, unknown>[] = [];
  const naoCoube: string[] = [];

  for (const { d, minutos } of pendentes) {
    const permitePausa = !d.is_anchor;
    const extra = permitePausa
      ? Math.max(0, Math.ceil(minutos / Math.max(1, breakInterval)) - 1) * breakMinutes
      : 0;
    const slot = findSlot(ocupados, minutos + extra, dayStart, dayEnd);
    if (!slot) {
      naoCoube.push(d.name);
      continue;
    }
    const fatias = sliceWithBreaks(slot.start_time, minutos, {
      allowsBreak: permitePausa,
      intervalMinutes: breakInterval,
      breakMinutes,
    });
    for (const f of fatias) {
      ocupados.push({ start_time: f.start_time, end_time: f.end_time });
      linhas.push({
        user_id: userId,
        date: dateISO,
        title: f.kind === "pausa" ? "Pausa" : d.name,
        start_time: f.start_time,
        end_time: f.end_time,
        domain_id: f.kind === "pausa" ? null : d.id,
        block_kind: f.kind,
        allows_break: permitePausa,
        is_focus_block: f.kind === "tarefa" && !!d.is_anchor,
        status: "planejado",
      });
    }
  }

  if (linhas.length) {
    const { error } = await supabase.from("time_blocks").insert(linhas as never);
    if (error) throw error;
  }
  return { criados: linhas.length, naoCoube };
}

/** Move/redimensiona um bloco, mantendo-o dentro do dia. */
export async function saveBlockTime(
  block: Block,
  startMin: number,
  endMin: number,
  dayStart: string,
  dayEnd: string,
) {
  const limiteInicio = toMinutes(dayStart);
  const limiteFim = toMinutes(dayEnd);
  const dur = Math.max(STEP, endMin - startMin);
  const inicio = Math.min(Math.max(limiteInicio, snap(startMin)), limiteFim - dur);
  const { error } = await supabase
    .from("time_blocks")
    .update({ start_time: toTime(inicio), end_time: toTime(inicio + dur) })
    .eq("id", block.id);
  if (error) throw error;
}

/** Divide o bloco ao meio: a segunda metade vai para o próximo espaço livre. */
export async function splitBlock(
  block: Block,
  blocks: Block[],
  userId: string,
  dayStart: string,
  dayEnd: string,
) {
  const inicio = toMinutes(hhmm(block.start_time));
  const fim = toMinutes(hhmm(block.end_time));
  const dur = fim - inicio;
  if (dur < STEP * 2) throw new Error("Curto demais para dividir.");

  const metade = snap(dur / 2) || STEP;
  const { error } = await supabase
    .from("time_blocks")
    .update({ end_time: toTime(inicio + metade) })
    .eq("id", block.id);
  if (error) throw error;

  const ocupados = blocks
    .filter((b) => b.id !== block.id)
    .map((b) => ({ start_time: hhmm(b.start_time), end_time: hhmm(b.end_time) }))
    .concat([{ start_time: toTime(inicio), end_time: toTime(inicio + metade) }]);

  const resto = dur - metade;
  const slot = findSlot(ocupados, resto, dayStart, dayEnd);
  if (!slot) throw new Error("Sem espaço livre para a outra metade.");

  const { error: e2 } = await supabase.from("time_blocks").insert({
    user_id: userId,
    date: block.date,
    title: block.title,
    start_time: slot.start_time,
    end_time: slot.end_time,
    domain_id: block.domain_id,
    goal_id: block.goal_id,
    task_id: block.task_id,
    block_kind: block.block_kind,
    allows_break: block.allows_break,
    status: "planejado",
  } as never);
  if (e2) throw e2;
  return slot;
}