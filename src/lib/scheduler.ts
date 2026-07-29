import { hoursBetween } from "./dates";

export type Slot = { start_time: string; end_time: string };

export function toMinutes(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export function toTime(min: number) {
  const m = Math.max(0, Math.min(24 * 60, Math.round(min)));
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

export function formatDuration(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h && m) return `${h}h${String(m).padStart(2, "0")}`;
  if (h) return `${h}h`;
  return `${m}min`;
}

/** Intervalos livres entre dayStart e dayEnd, descontando os blocos ocupados. */
export function freeSlots(occupied: Slot[], dayStart: string, dayEnd: string): Slot[] {
  const ordenados = [...occupied]
    .map((b) => ({ s: toMinutes(b.start_time), e: toMinutes(b.end_time) }))
    .sort((a, b) => a.s - b.s);

  const livres: Slot[] = [];
  let cursor = toMinutes(dayStart);
  const fim = toMinutes(dayEnd);

  for (const b of ordenados) {
    if (b.e <= cursor) continue;
    if (b.s > cursor) livres.push({ start_time: toTime(cursor), end_time: toTime(Math.min(b.s, fim)) });
    cursor = Math.max(cursor, b.e);
    if (cursor >= fim) break;
  }
  if (cursor < fim) livres.push({ start_time: toTime(cursor), end_time: toTime(fim) });

  return livres.filter((s) => toMinutes(s.end_time) > toMinutes(s.start_time));
}

/** Primeiro intervalo livre que comporta `minutes`. */
export function findSlot(occupied: Slot[], minutes: number, dayStart: string, dayEnd: string) {
  const slot = freeSlots(occupied, dayStart, dayEnd).find(
    (s) => toMinutes(s.end_time) - toMinutes(s.start_time) >= minutes,
  );
  if (!slot) return null;
  const inicio = toMinutes(slot.start_time);
  return { start_time: toTime(inicio), end_time: toTime(inicio + minutes) };
}

export type Fatia = { start_time: string; end_time: string; kind: "tarefa" | "pausa" };

/**
 * Fatia um trecho de trabalho inserindo pausas conforme o princípio do descanso
 * produtivo: a cada `intervalMinutes` de trabalho, `breakMinutes` de pausa.
 */
export function sliceWithBreaks(
  start: string,
  minutes: number,
  opts: { allowsBreak: boolean; intervalMinutes: number; breakMinutes: number },
): Fatia[] {
  const { allowsBreak, intervalMinutes, breakMinutes } = opts;
  if (!allowsBreak || minutes <= intervalMinutes || intervalMinutes <= 0) {
    return [{ start_time: start, end_time: toTime(toMinutes(start) + minutes), kind: "tarefa" }];
  }

  const fatias: Fatia[] = [];
  let cursor = toMinutes(start);
  let restante = minutes;

  while (restante > 0) {
    const trecho = Math.min(intervalMinutes, restante);
    fatias.push({ start_time: toTime(cursor), end_time: toTime(cursor + trecho), kind: "tarefa" });
    cursor += trecho;
    restante -= trecho;
    if (restante > 0) {
      fatias.push({ start_time: toTime(cursor), end_time: toTime(cursor + breakMinutes), kind: "pausa" });
      cursor += breakMinutes;
    }
  }
  return fatias;
}

/** Quanto tempo o conjunto de fatias ocupa de ponta a ponta, em minutos. */
export function extentMinutes(fatias: Fatia[]) {
  if (!fatias.length) return 0;
  return toMinutes(fatias[fatias.length - 1].end_time) - toMinutes(fatias[0].start_time);
}

export type Distribuivel = {
  id: string;
  estimated_minutes: number;
  priority: number;
  allows_break: boolean;
};

export type CargaDia = { dateISO: string; livreMinutos: number };

/**
 * Distribui tarefas do backlog nos dias com folga, na ordem de prioridade.
 * O que não couber permanece sem dia — "que o seu sim seja sim".
 */
export function distribute(tarefas: Distribuivel[], dias: CargaDia[]) {
  const capacidade = dias.map((d) => ({ ...d }));
  const alocadas: { id: string; dateISO: string }[] = [];
  const sobraram: string[] = [];

  const ordenadas = [...tarefas].sort(
    (a, b) => b.priority - a.priority || b.estimated_minutes - a.estimated_minutes,
  );

  for (const t of ordenadas) {
    const dia = capacidade.find((d) => d.livreMinutos >= t.estimated_minutes);
    if (!dia) {
      sobraram.push(t.id);
      continue;
    }
    dia.livreMinutos -= t.estimated_minutes;
    alocadas.push({ id: t.id, dateISO: dia.dateISO });
  }

  return { alocadas, sobraram };
}

export function occupiedMinutes(blocks: Slot[]) {
  return blocks.reduce((s, b) => s + hoursBetween(b.start_time, b.end_time) * 60, 0);
}