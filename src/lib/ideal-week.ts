/**
 * Monta a Semana Ideal a partir das âncoras e do orçamento de horas.
 * Dias: 0 = segunda … 6 = domingo. O dia começa às 06:00 e termina quando
 * chega a hora de dormir (24h − sono), no máximo às 23:00.
 * A ordem segue o ritmo humano: acordar, café, uma abertura leve, trabalho,
 * almoço, tarde, jantar, noite — com pausa a cada 2h de atividade contínua.
 */
import type { RoutinePattern } from "./routine-detect";

export const ACORDAR = 6 * 60;
export const REFEICOES_PADRAO = 1.5; // horas por dia somando as 4 refeições
export const PAUSA_MINUTOS = 15;
export const CICLO_FOCO = 120; // pausa a cada 2h de atividade

export type HorariosRefeicao = {
  cafe: string;
  almoco: string;
  lanche: string;
  jantar: string;
};

export const REFEICOES_HORARIOS: HorariosRefeicao = {
  cafe: "07:00",
  almoco: "12:00",
  lanche: "15:30",
  jantar: "19:00",
};

/** Duração fixa de cada refeição, em minutos — o app decide, não o usuário. */
export const DURACAO_REFEICAO = { cafe: 20, almoco: 45, lanche: 15, jantar: 40 };

export const MINUTOS_REFEICOES_DIA =
  DURACAO_REFEICAO.cafe +
  DURACAO_REFEICAO.almoco +
  DURACAO_REFEICAO.lanche +
  DURACAO_REFEICAO.jantar;

/** Pausas sugeridas: uma de 15min a cada 2h de tempo acordado e livre. */
export function pausasSugeridasPorDia(sono: number, refeicoesPorDia: number, pausaMin = PAUSA_MINUTOS) {
  const acordado = Math.max(0, 24 - sono - refeicoesPorDia);
  const ciclos = Math.max(0, Math.floor(acordado / 2));
  return Math.round(((ciclos * pausaMin) / 60) * 4) / 4; // horas, passo de 15min
}

type Bloco = { inicio: number; fim: number; titulo: string; area: string };

const hhmm = (v: number) =>
  `${String(Math.floor(v / 60)).padStart(2, "0")}:${String(Math.round(v) % 60).padStart(2, "0")}`;

const minutos = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
};

class Dia {
  blocos: Bloco[] = [];
  constructor(
    readonly inicio: number,
    readonly fim: number,
  ) {}

  livre(de: number, dur: number) {
    if (de + dur > this.fim) return false;
    return !this.blocos.some((b) => de < b.fim && de + dur > b.inicio);
  }

  primeiroLivre(apartirDe: number, dur: number) {
    const candidatos = [Math.max(apartirDe, this.inicio), ...this.blocos.map((b) => b.fim)]
      .filter((v) => v >= Math.max(apartirDe, this.inicio))
      .sort((a, b) => a - b);
    for (const c of candidatos) if (this.livre(c, dur)) return c;
    return null;
  }

  por(inicio: number, dur: number, titulo: string, area: string) {
    if (dur < 15 || !this.livre(inicio, dur)) return false;
    this.blocos.push({ inicio, fim: inicio + dur, titulo, area });
    this.blocos.sort((a, b) => a.inicio - b.inicio);
    return true;
  }

  encaixar(apartirDe: number, dur: number, titulo: string, area: string) {
    const slot = this.primeiroLivre(apartirDe, dur);
    if (slot === null) return false;
    return this.por(slot, dur, titulo, area);
  }
}

const arredonda = (min: number) => Math.max(15, Math.round(min / 15) * 15);

export type IdealWeekInput = {
  sono: number;
  horasTrabalho: number;
  diasTrabalho: number[];
  refeicoesPorDia: number;
  pausasPorDia: number;
  /** Horas por semana das áreas extras (sem trabalho, refeições e pausas). */
  horasPorArea: Record<string, number>;
  /** Em quais dias da semana cada área acontece (0 = segunda). */
  diasPorArea?: Record<string, number[]>;
};

export function gerarSemanaIdeal(input: IdealWeekInput): RoutinePattern[] {
  const dormir = Math.min(23 * 60, ACORDAR + Math.round((24 - input.sono) * 60));
  const dias = Array.from({ length: 7 }, () => new Dia(ACORDAR, dormir));

  // 1. Refeições em horários fixos.
  for (const [i, dia] of dias.entries()) {
    void i;
    for (const r of REFEICOES) {
      const dur = arredonda(input.refeicoesPorDia * 60 * r.peso);
      dia.por(r.hora, dur, r.titulo, "Alimentação");
    }
  }

  // 2. Trabalho ou estudo, dividido em manhã e tarde ao redor do almoço.
  for (const d of input.diasTrabalho) {
    const dia = dias[d];
    if (!dia) continue;
    let restante = arredonda(input.horasTrabalho * 60);
    const manha = Math.min(restante, Math.max(0, 12 * 60 - (8 * 60)));
    if (manha >= 15) {
      if (dia.encaixar(8 * 60, manha, "Trabalho ou estudo", "Trabalho")) restante -= manha;
    }
    while (restante >= 15) {
      const pedaco = Math.min(restante, 120);
      if (!dia.encaixar(13 * 60, pedaco, "Trabalho ou estudo", "Trabalho")) break;
      restante -= pedaco;
    }
  }

  // 3. Áreas da vida: espalhadas pelos dias, preferindo o fim da tarde/noite.
  const areas = Object.entries(input.horasPorArea)
    .filter(([, h]) => h > 0)
    .sort((a, b) => b[1] - a[1]);
  for (const [area, horas] of areas) {
    const minutos = arredonda(horas * 60);
    const preferidos = input.diasPorArea?.[area]?.filter((d) => d >= 0 && d <= 6);
    const escolhidos =
      preferidos && preferidos.length
        ? [...new Set(preferidos)]
        : (() => {
            const quantos = Math.min(7, Math.max(1, Math.round(minutos / 90)));
            return Array.from({ length: quantos }, (_, i) => Math.round((i * 7) / quantos) % 7);
          })();
    const porDia = arredonda(minutos / (escolhidos.length || 1));
    for (const d of escolhidos) {
      const dia = dias[d];
      if (!dia) continue;
      if (!dia.encaixar(17 * 60, porDia, area, area)) dia.encaixar(ACORDAR, porDia, area, area);
    }
  }

  // 4. Pausas: 15min depois de blocos longos, até o total do dia.
  for (const dia of dias) {
    let restante = Math.round(input.pausasPorDia * 60);
    const longos = dia.blocos.filter((b) => b.fim - b.inicio >= 90 && b.area !== "Alimentação");
    for (const b of longos) {
      if (restante < PAUSA_MINUTOS) break;
      if (dia.por(b.fim, PAUSA_MINUTOS, "Pausa", "Pausas")) restante -= PAUSA_MINUTOS;
    }
  }

  const padroes: RoutinePattern[] = [];
  for (const [d, dia] of dias.entries()) {
    for (const b of dia.blocos) {
      padroes.push({
        title: b.titulo,
        dayOfWeek: d,
        startTime: hhmm(b.inicio),
        endTime: hhmm(b.fim),
        occurrences: 1,
        area: b.area,
        confidence: 1,
      });
    }
  }
  return padroes.sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime));
}
