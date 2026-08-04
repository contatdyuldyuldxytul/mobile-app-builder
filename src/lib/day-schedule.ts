import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { freeSlots, toMinutes, toTime } from "./scheduler";
import { pausasNaGrade } from "./ideal-week";
import { ehAutomatica } from "./budget-fit";

export type Block = Tables<"time_blocks">;
export type Domain = Tables<"life_domains">;
export type Budget = Tables<"time_budgets">;

export const STEP = 15;
/** Nenhuma atividade do dia vira bloco com menos que isso. */
export const MIN_BLOCO = 30;

/** A área que representa o sono — vira faixa fixa da noite, não bloco do dia. */
export function isSleepDomain(d: Domain) {
  return /dorm|sono|sleep/i.test(d.name);
}

/** Sono, refeições e pausas não viram cartão de atividade no dia. */
export function ehAreaAutomatica(d: Domain) {
  return isSleepDomain(d) || ehAutomatica(d.name);
}

/** Sobe para o próximo horário redondo da grade de 15 min. */
export function sobe(min: number, step = STEP) {
  return Math.ceil(min / step) * step;
}

/**
 * Remove do dia o que não segue mais o padrão: duração zero ou negativa,
 * blocos fora da janela do dia, horários quebrados, atividades com menos de
 * 30 min e pausas fora da virada dos colchetes. O que você concluiu ou ligou
 * a uma tarefa continua intocado.
 */
export async function sanearDia(
  blocks: Block[],
  dayStart: string,
  dayEnd: string,
  cicloFoco = 120,
) {
  const lim0 = toMinutes(dayStart);
  const lim1 = toMinutes(dayEnd);
  const ruins = blocks
    .filter((b) => !b.completed && !b.task_id)
    .filter((b) => {
      const ini = toMinutes(hhmm(b.start_time));
      const fim = toMinutes(hhmm(b.end_time));
      const dur = fim - ini;
      if (dur <= 0) return true;
      if (ini < lim0 || fim > lim1) return true;
      // Horário quebrado (fora da grade de 15 min) não pertence mais ao dia.
      if (ini % STEP !== 0 || fim % STEP !== 0) return true;
      // A pausa só existe na virada de um colchete.
      if (b.block_kind === "pausa") return ini % cicloFoco !== 0;
      return dur < MIN_BLOCO;
    })
    .map((b) => b.id);
  if (!ruins.length) return { removidos: 0 };
  const { error } = await supabase.from("time_blocks").delete().in("id", ruins);
  if (error) throw error;
  return { removidos: ruins.length };
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

/** Janela rígida escolhida para uma área; nunca fazemos fallback fora dela. */
function janelaDoPeriodo(d: Domain, dayStart: string, dayEnd: string) {
  const inicio = toMinutes(dayStart);
  const fim = toMinutes(dayEnd);
  const periodo = d.preferred_period ?? "qualquer";
  if (periodo === "manha") return { inicio, fim: Math.min(fim, 12 * 60) };
  if (periodo === "tarde") return { inicio: Math.max(inicio, 12 * 60), fim: Math.min(fim, 18 * 60) };
  if (periodo === "noite") return { inicio: Math.max(inicio, 18 * 60), fim };
  return { inicio, fim };
}

/** Limita uma vaga ao colchete de 2h onde ela começa. */
function limitarAoColchete(inicio: number, fim: number, ciclo: number) {
  const limite = (Math.floor(inicio / ciclo) + 1) * ciclo;
  return Math.min(fim, limite);
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
  // Quantos minutos cada área já tem no dia — o que falta é o que será criado.
  const jaFeito = new Map<string, number>();
  for (const b of blocks) {
    if (!b.domain_id || b.block_kind === "pausa") continue;
    const dur = toMinutes(hhmm(b.end_time)) - toMinutes(hhmm(b.start_time));
    jaFeito.set(b.domain_id, (jaFeito.get(b.domain_id) ?? 0) + dur);
  }

  const pendentes = domains
    .filter((d) => !ehAreaAutomatica(d))
    .map((d) => ({
      d,
      minutos: snap(Math.max(0, dailyMinutes(d, budgets, weekday) - (jaFeito.get(d.id) ?? 0))),
    }))
    .filter((x) => x.minutos >= MIN_BLOCO)
    // âncoras (trabalho/estudo) primeiro: são o esqueleto do dia
    .sort(
      (a, b) => Number(b.d.is_anchor) - Number(a.d.is_anchor) || a.d.sort_order - b.d.sort_order,
    );

  const linhas: Record<string, unknown>[] = [];
  const naoCoube: string[] = [];

  for (const { d, minutos } of pendentes) {
    const janela = janelaDoPeriodo(d, dayStart, dayEnd);
    const partes = Math.max(1, Math.min(2, Number(d.blocks_per_day ?? 1)));
    const alvoParte = Math.max(MIN_BLOCO, snap(minutos / partes));
    let colocados = 0;
    // Só usa vagas do período escolhido e nunca atravessa um colchete.
    let restante = minutos;
    for (const vaga of freeSlots(ocupados, dayStart, dayEnd)) {
      if (restante < MIN_BLOCO) break;
      if (colocados >= partes) break;
      const ini = sobe(Math.max(toMinutes(vaga.start_time), janela.inicio));
      const fimVaga = limitarAoColchete(
        ini,
        Math.min(toMinutes(vaga.end_time), janela.fim),
        breakInterval,
      );
      const dur =
        Math.floor(Math.min(restante, alvoParte, fimVaga - ini) / STEP) * STEP;
      if (dur < MIN_BLOCO) continue;
      ocupados.push({ start_time: toTime(ini), end_time: toTime(ini + dur) });
      linhas.push({
        user_id: userId,
        date: dateISO,
        title: d.name,
        start_time: toTime(ini),
        end_time: toTime(ini + dur),
        domain_id: d.id,
        block_kind: "tarefa",
        allows_break: !d.is_anchor,
        is_focus_block: !!d.is_anchor,
        status: "planejado",
      });
      restante -= dur;
      colocados++;
    }
    if (restante >= MIN_BLOCO) naoCoube.push(d.name);
  }

  void breakMinutes;
  if (linhas.length) {
    const { error } = await supabase.from("time_blocks").insert(linhas as never);
    if (error) throw error;
  }
  return { criados: linhas.length, naoCoube };
}

type Slot = { id: string; ini: number; fim: number };

const ehRefeicao = (b: Block) => /caf[ée]|almo[çc]o|lanche|jantar|refei/i.test(b.title);

/**
 * Descanso produtivo na virada dos colchetes: a pausa começa exatamente no
 * múltiplo do ciclo de foco no relógio (08:00, 10:00, 12:00…), nunca dentro
 * do colchete. Só entra onde o horário está livre.
 */
export async function ensureBreaks(args: {
  blocks: Block[];
  dateISO: string;
  userId: string;
  interval: number;
  breakMinutes: number;
  dayEnd: string;
  dayStart?: string;
  /** Quando falso, a pausa é reservada mesmo antes das atividades existirem. */
  exigirAtividade?: boolean;
}) {
  const { blocks, dateISO, userId, interval, breakMinutes, dayEnd } = args;
  if (interval <= 0) return { criadas: 0 };

  const ordenados = [...blocks].sort((a, b) => a.start_time.localeCompare(b.start_time));
  const atividades = ordenados.filter((b) => b.block_kind !== "pausa");
  const exigirAtividade = args.exigirAtividade ?? true;
  if (exigirAtividade && !atividades.length) return { criadas: 0 };

  const inicioDia = toMinutes(hhmm(args.dayStart ?? atividades[0]?.start_time ?? "06:00"));
  const fimDia = toMinutes(dayEnd);
  const refeicoes = ordenados
    .filter(ehRefeicao)
    .map((b) => ({ inicio: toMinutes(hhmm(b.start_time)), fim: toMinutes(hhmm(b.end_time)) }));

  // Mesma grade da Semana Ideal: pausa só na virada do colchete.
  const pausas = pausasNaGrade(inicioDia, fimDia, breakMinutes, refeicoes, interval);
  const ocupado = (ini: number, fim: number) =>
    ordenados.some((b) => ini < toMinutes(hhmm(b.end_time)) && fim > toMinutes(hhmm(b.start_time)));
  const temAtividade = (ini: number, fim: number) =>
    atividades.some(
      (b) => ini < toMinutes(hhmm(b.end_time)) && fim > toMinutes(hhmm(b.start_time)),
    );

  const novas: Record<string, unknown>[] = [];
  for (const p of pausas) {
    if (p.fim > fimDia || ocupado(p.inicio, p.fim)) continue;
    // A pausa separa duas sessões: precisa de atividade antes e depois dela.
    if (exigirAtividade && !(temAtividade(inicioDia, p.inicio) && temAtividade(p.fim, fimDia)))
      continue;
    novas.push({
      user_id: userId,
      date: dateISO,
      title: "Pausa",
      start_time: toTime(p.inicio),
      end_time: toTime(p.fim),
      block_kind: "pausa",
      allows_break: false,
      status: "planejado",
    });
  }

  if (novas.length) {
    const { error } = await supabase.from("time_blocks").insert(novas as never);
    if (error) throw error;
  }
  return { criadas: novas.length };
}

/**
 * Depois de montado o dia, uma pausa que ficou entre dois vazios não descansa
 * de nada — ela é removida. Só permanece a que separa duas atividades.
 */
export async function pruneLonePauses(blocks: Block[]) {
  const atividades = blocks.filter((b) => b.block_kind !== "pausa");
  // A pausa fica sempre que separar duas sessões do dia, mesmo sem encostar.
  const antesDe = (min: number) => atividades.some((b) => toMinutes(hhmm(b.end_time)) <= min);
  const depoisDe = (min: number) => atividades.some((b) => toMinutes(hhmm(b.start_time)) >= min);
  const sobrando = blocks
    .filter((b) => b.block_kind === "pausa")
    .filter(
      (b) => !(antesDe(toMinutes(hhmm(b.start_time))) && depoisDe(toMinutes(hhmm(b.end_time)))),
    )
    .map((b) => b.id);
  if (!sobrando.length) return { removidas: 0 };
  const { error } = await supabase.from("time_blocks").delete().in("id", sobrando);
  if (error) throw error;
  return { removidas: sobrando.length };
}

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
  // Atividade nenhuma fica menor que meia hora; só a pausa pode ser curta.
  const minimo = block.block_kind === "pausa" ? STEP : MIN_BLOCO;
  const dur = Math.max(minimo, snap(endMin - startMin));
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
  if (dur < MIN_BLOCO * 2) throw new Error("Curto demais para dividir.");

  const metade = Math.max(MIN_BLOCO, snap(dur / 2));
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

const iniDe = (b: Block) => toMinutes(hhmm(b.start_time));
const fimDe = (b: Block) => toMinutes(hhmm(b.end_time));
const durDe = (b: Block) => Math.max(STEP, fimDe(b) - iniDe(b));

/**
 * Move UMA atividade para a faixa de 2h escolhida — e só ela.
 * O resto do dia fica onde está: apenas as atividades que já pertencem
 * àquela faixa cedem o mínimo necessário para o bloco caber.
 */
export function planMoveToBand(
  blocks: Block[],
  blockId: string,
  bandStart: number,
  bandEnd: number,
  beforeId?: string | null,
): Slot[] {
  const movido = blocks.find((b) => b.id === blockId);
  if (!movido) return [];

  // Só repacka o que nasce dentro da faixa; pausas e continuações são fixas.
  const naFaixa = blocks.filter(
    (b) =>
      b.id !== blockId && b.block_kind !== "pausa" && iniDe(b) >= bandStart && iniDe(b) < bandEnd,
  );
  const idsFaixa = new Set(naFaixa.map((b) => b.id));
  const fixos = blocks
    .filter((b) => b.id !== blockId && !idsFaixa.has(b.id))
    .map((b) => ({ ini: iniDe(b), fim: fimDe(b) }));

  const ordem = [...naFaixa].sort((a, b) => iniDe(a) - iniDe(b));
  const alvo = beforeId ? ordem.findIndex((b) => b.id === beforeId) : -1;
  const sequencia = [...ordem];
  sequencia.splice(alvo >= 0 ? alvo : sequencia.length, 0, movido);

  const postos: Slot[] = [];
  let cursor = bandStart;
  for (const b of sequencia) {
    const dur = durDe(b);
    let ini = Math.max(cursor, bandStart);
    for (let i = 0; i < 200; i++) {
      const choques = [...fixos, ...postos].filter((x) => ini < x.fim && ini + dur > x.ini);
      if (!choques.length) break;
      ini = Math.max(...choques.map((c) => c.fim));
    }
    postos.push({ id: b.id, ini, fim: ini + dur });
    cursor = ini + dur;
  }
  return postos;
}

/** Grava o movimento de um bloco só. Devolve quantos horários mudaram. */
export async function moveBlockToBand(
  blocks: Block[],
  blockId: string,
  bandStart: number,
  bandEnd: number,
  beforeId?: string | null,
) {
  const postos = planMoveToBand(blocks, blockId, bandStart, bandEnd, beforeId);
  return persistir(blocks, postos);
}

/**
 * Junta em um só os pedaços da mesma atividade que estão colados dentro da
 * mesma faixa: um bloco fica com o intervalo inteiro, os demais somem.
 */
export async function mergeBlocks(blocks: Block[], ids: string[]) {
  const alvo = blocks.filter((b) => ids.includes(b.id)).sort((a, b) => iniDe(a) - iniDe(b));
  if (alvo.length < 2) return { unidos: 0 };
  const primeiro = alvo[0];
  const total = alvo.reduce((s, b) => s + durDe(b), 0);
  const feito = alvo.every((b) => b.completed);

  const { error } = await supabase
    .from("time_blocks")
    .update({
      start_time: toTime(iniDe(primeiro)),
      end_time: toTime(iniDe(primeiro) + total),
      completed: feito,
    })
    .eq("id", primeiro.id);
  if (error) throw error;

  const resto = alvo.slice(1).map((b) => b.id);
  const { error: e2 } = await supabase.from("time_blocks").delete().in("id", resto);
  if (e2) throw e2;
  return { unidos: resto.length };
}

/** Duplicatas exatas (mesmo título e mesmo horário) não deveriam existir. */
export async function dedupeExact(blocks: Block[]) {
  const vistos = new Set<string>();
  const repetidos: string[] = [];
  for (const b of [...blocks].sort((a, c) => a.start_time.localeCompare(c.start_time))) {
    const chave = `${b.title}|${hhmm(b.start_time)}|${hhmm(b.end_time)}`;
    if (vistos.has(chave)) repetidos.push(b.id);
    else vistos.add(chave);
  }
  if (!repetidos.length) return { removidos: 0 };
  const { error } = await supabase.from("time_blocks").delete().in("id", repetidos);
  if (error) throw error;
  return { removidos: repetidos.length };
}
