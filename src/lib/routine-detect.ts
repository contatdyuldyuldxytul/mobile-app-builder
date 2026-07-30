import { classifyEvent } from "./classify";
import { A_CLASSIFICAR, normalize } from "./areas";

export type RawEvent = {
  externalId: string;
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  recurring: boolean;
  attendees: number;
};

export type RoutinePattern = {
  title: string;
  dayOfWeek: number; // 0 = segunda
  startTime: string; // HH:MM
  endTime: string;
  occurrences: number;
  area: string;
  confidence: number;
};

function hhmm(d: Date) {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function weekdayIndex(d: Date) {
  return (d.getDay() + 6) % 7;
}

function toMin(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function fromMin(min: number) {
  const v = Math.max(0, Math.min(24 * 60 - 1, Math.round(min)));
  return `${String(Math.floor(v / 60)).padStart(2, "0")}:${String(v % 60).padStart(2, "0")}`;
}

/** Agrupa por título normalizado + dia da semana + faixa de meia hora. */
function chave(e: RawEvent) {
  const inicio = Math.round((e.start.getHours() * 60 + e.start.getMinutes()) / 30);
  return `${normalize(e.title)}|${weekdayIndex(e.start)}|${inicio}`;
}

/**
 * Detecta o que se repete: aparece em ao menos `minOcorrencias` semanas
 * distintas, ou é um evento recorrente da própria agenda.
 */
export function detectRoutine(events: RawEvent[], minOcorrencias = 2): RoutinePattern[] {
  const grupos = new Map<string, RawEvent[]>();
  for (const e of events) {
    if (e.allDay) continue;
    const duracao = (e.end.getTime() - e.start.getTime()) / 60000;
    if (duracao <= 0 || duracao > 12 * 60) continue;
    const k = chave(e);
    grupos.set(k, [...(grupos.get(k) ?? []), e]);
  }

  const padroes: RoutinePattern[] = [];
  for (const grupo of grupos.values()) {
    const semanas = new Set(
      grupo.map((e) => {
        const d = new Date(e.start);
        d.setDate(d.getDate() - weekdayIndex(d));
        return d.toDateString();
      }),
    );
    const recorrente = grupo.some((e) => e.recurring);
    if (semanas.size < minOcorrencias && !recorrente) continue;

    const inicioMedio =
      grupo.reduce((s, e) => s + e.start.getHours() * 60 + e.start.getMinutes(), 0) / grupo.length;
    const duracaoMedia =
      grupo.reduce((s, e) => s + (e.end.getTime() - e.start.getTime()) / 60000, 0) / grupo.length;

    const base = grupo[0];
    const { area, confidence } = classifyEvent({
      title: base.title,
      weekday: weekdayIndex(base.start),
      allDay: base.allDay,
      attendees: Math.max(...grupo.map((e) => e.attendees)),
    });

    padroes.push({
      title: base.title.trim() || "Compromisso",
      dayOfWeek: weekdayIndex(base.start),
      startTime: fromMin(Math.round(inicioMedio / 15) * 15),
      endTime: fromMin(Math.round((inicioMedio + duracaoMedia) / 15) * 15),
      occurrences: Math.max(semanas.size, recorrente ? minOcorrencias : semanas.size),
      area,
      confidence,
    });
  }

  return padroes.sort(
    (a, b) => a.dayOfWeek - b.dayOfWeek || toMin(a.startTime) - toMin(b.startTime),
  );
}

/** Horas por semana em cada área, a partir dos padrões detectados. */
export function hoursByArea(padroes: RoutinePattern[]) {
  const mapa = new Map<string, number>();
  for (const p of padroes) {
    const horas = (toMin(p.endTime) - toMin(p.startTime)) / 60;
    if (horas <= 0) continue;
    mapa.set(p.area, (mapa.get(p.area) ?? 0) + horas);
  }
  mapa.delete(A_CLASSIFICAR);
  return mapa;
}

/** Média de horas de trabalho por dia útil detectadas na agenda (0 se não houver). */
export function detectedWorkHoursPerDay(padroes: RoutinePattern[]) {
  const trabalho = padroes.filter((p) => p.area === "Trabalho" && p.dayOfWeek <= 4);
  if (!trabalho.length) return 0;
  const dias = new Set(trabalho.map((p) => p.dayOfWeek)).size;
  const horas = trabalho.reduce((s, p) => s + (toMin(p.endTime) - toMin(p.startTime)) / 60, 0);
  return Math.round((horas / dias) * 2) / 2;
}

export { hhmm, weekdayIndex };