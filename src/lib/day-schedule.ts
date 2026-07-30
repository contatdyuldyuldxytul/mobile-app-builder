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

  const ocupados = blocks.map((b) => ({
    start_time: hhmm(b.start_time),
    end_time: hhmm(b.end_time),
  }));
  const jaTem = new Set(blocks.map((b) => b.domain_id).filter(Boolean) as string[]);

  const pendentes = domains
    .filter((d) => !isSleepDomain(d) && !jaTem.has(d.id))
    .map((d) => ({ d, minutos: dailyMinutes(d, budgets, weekday) }))
    .filter((x) => x.minutos > 0)
    // âncoras (trabalho/estudo) primeiro: são o esqueleto do dia
    .sort(
      (a, b) => Number(b.d.is_anchor) - Number(a.d.is_anchor) || a.d.sort_order - b.d.sort_order,
    );

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

type Slot = { id: string; ini: number; fim: number };

/**
 * Reorganiza o dia sem sobreposição: o bloco fixo fica onde você soltou e os
 * demais escorregam para baixo, na ordem, até caber. Nada fica em cima de nada.
 */
export function layoutDay(blocks: Block[], dayStart: string, dayEnd: string, fixo?: Slot): Slot[] {
  const lim0 = toMinutes(dayStart);

  const outros = blocks
    .filter((b) => b.id !== fixo?.id)
    .map((b) => ({
      id: b.id,
      ini: toMinutes(hhmm(b.start_time)),
      fim: toMinutes(hhmm(b.end_time)),
    }))
    .sort((a, b) => a.ini - b.ini);

  const postos: Slot[] = fixo ? [fixo] : [];
  for (const o of outros) {
    const dur = Math.max(STEP, o.fim - o.ini);
    let ini = Math.max(lim0, snap(o.ini));
    for (let i = 0; i < 200; i++) {
      const choque = postos.find((p) => ini < p.fim && ini + dur > p.ini);
      if (!choque) break;
      ini = choque.fim;
    }
    // Não espreme no fim do dia: o que não cabe segue na fila e aparece
    // marcado como "fora do dia" na agenda.
    postos.push({ id: o.id, ini, fim: ini + dur });
  }
  return postos;
}

async function persistir(blocks: Block[], postos: Slot[]) {
  const mudou = postos.filter((p) => {
    const b = blocks.find((x) => x.id === p.id);
    if (!b) return false;
    return hhmm(b.start_time) !== toTime(p.ini) || hhmm(b.end_time) !== toTime(p.fim);
  });
  for (const p of mudou) {
    const { error } = await supabase
      .from("time_blocks")
      .update({ start_time: toTime(p.ini), end_time: toTime(p.fim) })
      .eq("id", p.id);
    if (error) throw error;
  }
  return mudou.length;
}

/** Move/redimensiona um bloco e reacomoda os vizinhos para não sobrepor. */
export async function saveBlockTime(
  block: Block,
  startMin: number,
  endMin: number,
  dayStart: string,
  dayEnd: string,
  blocks: Block[] = [],
) {
  const lim0 = toMinutes(dayStart);
  const lim1 = toMinutes(dayEnd);
  const dur = Math.max(STEP, snap(endMin - startMin));
  const ini = Math.min(Math.max(lim0, snap(startMin)), lim1 - dur);
  const fixo: Slot = { id: block.id, ini, fim: ini + dur };
  const lista = blocks.length ? blocks : [block];
  await persistir(lista, layoutDay(lista, dayStart, dayEnd, fixo));
}

/**
 * Arruma o dia inteiro: apaga repetições da mesma atividade e tira as
 * sobreposições, mantendo a ordem das horas.
 */
export async function tidyDay(blocks: Block[], dayStart: string, dayEnd: string) {
  const vistos = new Set<string>();
  const repetidos: string[] = [];
  const manter: Block[] = [];
  for (const b of [...blocks].sort((x, y) => x.start_time.localeCompare(y.start_time))) {
    if (b.block_kind === "pausa" || b.task_id) {
      manter.push(b);
      continue;
    }
    const chave = `${b.domain_id ?? b.title}|${toMinutes(hhmm(b.end_time)) - toMinutes(hhmm(b.start_time))}`;
    if (vistos.has(chave)) repetidos.push(b.id);
    else {
      vistos.add(chave);
      manter.push(b);
    }
  }
  if (repetidos.length) {
    const { error } = await supabase.from("time_blocks").delete().in("id", repetidos);
    if (error) throw error;
  }
  const movidos = await persistir(manter, layoutDay(manter, dayStart, dayEnd));
  return repetidos.length + movidos;
}

/**
 * Divide o bloco ao meio no eixo do tempo: as duas metades ficam em sequência,
 * no mesmo lugar do dia (09:00–11:00 vira 09:00–10:00 e 10:00–11:00).
 */
export async function splitBlock(
  block: Block,
  blocks: Block[],
  userId: string,
  dayStart: string,
  dayEnd: string,
) {
  void blocks;
  void dayStart;
  void dayEnd;
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

  const { error: e2 } = await supabase.from("time_blocks").insert({
    user_id: userId,
    date: block.date,
    title: block.title,
    start_time: toTime(inicio + metade),
    end_time: toTime(fim),
    domain_id: block.domain_id,
    goal_id: block.goal_id,
    task_id: block.task_id,
    block_kind: block.block_kind,
    allows_break: block.allows_break,
    status: "planejado",
  } as never);
  if (e2) throw e2;
  return { start_time: toTime(inicio + metade), end_time: toTime(fim) };
}

/**
 * Reordena as atividades do dia: as durações são preservadas e os horários
 * recalculados em sequência, a partir do início da primeira atividade.
 * As pausas voltam a cair a cada `breakInterval` de atividade.
 */
export async function reorderDay(
  blocks: Block[],
  orderedIds: string[],
  opts: { breakInterval: number; breakMinutes: number },
) {
  const planejado = planFromOrder(blocks, orderedIds, opts);
  const atualizacoes = planejado.filter((p) => {
    const b = blocks.find((x) => x.id === p.id)!;
    return hhmm(b.start_time) !== toTime(p.ini) || hhmm(b.end_time) !== toTime(p.fim);
  });
  for (const p of atualizacoes) {
    const { error } = await supabase
      .from("time_blocks")
      .update({ start_time: toTime(p.ini), end_time: toTime(p.fim) })
      .eq("id", p.id);
    if (error) throw error;
  }
  return atualizacoes.length;
}

/** Calcula os novos horários (sem gravar) — usado também na versão otimista. */
export function planFromOrder(
  blocks: Block[],
  orderedIds: string[],
  opts: { breakInterval: number; breakMinutes: number },
): Slot[] {
  const atividades = orderedIds
    .map((id) => blocks.find((b) => b.id === id))
    .filter((b): b is Block => !!b);
  if (!atividades.length) return [];

  const pausas = blocks
    .filter((b) => b.block_kind === "pausa")
    .sort((a, b) => a.start_time.localeCompare(b.start_time));

  const inicioBase = Math.min(
    ...blocks.filter((b) => b.block_kind !== "pausa").map((b) => toMinutes(hhmm(b.start_time))),
  );

  const postos: Slot[] = [];
  let cursor = inicioBase;
  let desdeAPausa = 0;
  let iPausa = 0;

  for (const b of atividades) {
    const dur = Math.max(STEP, toMinutes(hhmm(b.end_time)) - toMinutes(hhmm(b.start_time)));
    if (desdeAPausa >= opts.breakInterval && iPausa < pausas.length) {
      const p = pausas[iPausa++];
      const durPausa = Math.max(STEP, toMinutes(hhmm(p.end_time)) - toMinutes(hhmm(p.start_time)));
      postos.push({ id: p.id, ini: cursor, fim: cursor + durPausa });
      cursor += durPausa;
      desdeAPausa = 0;
    }
    postos.push({ id: b.id, ini: cursor, fim: cursor + dur });
    cursor += dur;
    desdeAPausa += dur;
  }

  // Pausas que sobraram vão para o fim, logo após a última atividade.
  for (; iPausa < pausas.length; iPausa++) {
    const p = pausas[iPausa];
    const durPausa = Math.max(STEP, toMinutes(hhmm(p.end_time)) - toMinutes(hhmm(p.start_time)));
    postos.push({ id: p.id, ini: cursor, fim: cursor + durPausa });
    cursor += durPausa;
  }
  return postos;
}
