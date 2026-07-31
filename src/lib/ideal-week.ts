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
export function pausasSugeridasPorDia(
  sono: number,
  refeicoesPorDia: number,
  pausaMin = PAUSA_MINUTOS,
) {
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
  /** Horários habituais das refeições — o app define as durações. */
  refeicoes?: HorariosRefeicao;
  /** Duração de cada pausa (15 a 30 min). */
  pausaMinutos?: number;
  /** Horas por semana das áreas extras (sem trabalho, refeições e pausas). */
  horasPorArea: Record<string, number>;
  /** Em quais dias da semana cada área acontece (0 = segunda). */
  diasPorArea?: Record<string, number[]>;
};

/** Áreas que pedem manhã cedo ou fim de tarde. */
const MATINAIS = /academ|esporte|treino|exerc|corrida|oracao|devoc|leitura|estud/i;
/** Áreas que combinam com a noite. */
const NOTURNAS = /famil|lazer|descanso|amig|casa|fe$|igreja|serie|filme/i;

export function gerarSemanaIdeal(input: IdealWeekInput): RoutinePattern[] {
  return gerarSemanaIdealDetalhado(input).padroes;
}

/** Igual ao gerador, mas devolve também o que não coube (área → minutos). */
export function gerarSemanaIdealDetalhado(input: IdealWeekInput): {
  padroes: RoutinePattern[];
  naoCoube: { area: string; minutos: number }[];
} {
  const naoCoube: { area: string; minutos: number }[] = [];
  const dormir = Math.min(23 * 60, ACORDAR + Math.round((24 - input.sono) * 60));
  const dias = Array.from({ length: 7 }, () => new Dia(ACORDAR, dormir));
  const horarios = input.refeicoes ?? REFEICOES_HORARIOS;
  const pausaMin = Math.min(30, Math.max(15, input.pausaMinutos ?? PAUSA_MINUTOS));
  const refeicoes = [
    { titulo: "Café da manhã", hora: minutos(horarios.cafe), dur: DURACAO_REFEICAO.cafe },
    { titulo: "Almoço", hora: minutos(horarios.almoco), dur: DURACAO_REFEICAO.almoco },
    { titulo: "Lanche da tarde", hora: minutos(horarios.lanche), dur: DURACAO_REFEICAO.lanche },
    { titulo: "Jantar", hora: minutos(horarios.jantar), dur: DURACAO_REFEICAO.jantar },
  ];

  // 1. Refeições nos horários que a pessoa informou — as âncoras do ritmo.
  for (const dia of dias) {
    for (const r of refeicoes) dia.por(r.hora, r.dur, r.titulo, "Alimentação");
  }

  const cafeFim = minutos(horarios.cafe) + DURACAO_REFEICAO.cafe;
  const almocoIni = minutos(horarios.almoco);
  const almocoFim = almocoIni + DURACAO_REFEICAO.almoco;
  const jantarIni = minutos(horarios.jantar);

  // 2. Trabalho ou estudo: nunca logo ao acordar — começa depois do café,
  //    com uma folga de meia hora para a manhã respirar.
  const inicioTrabalho = Math.max(cafeFim + 30, ACORDAR + 90);
  for (const d of input.diasTrabalho) {
    const dia = dias[d];
    if (!dia) continue;
    let restante = arredonda(input.horasTrabalho * 60);
    const manha = Math.min(restante, Math.max(0, almocoIni - inicioTrabalho));
    if (manha >= 15) {
      if (dia.encaixar(inicioTrabalho, manha, "Trabalho ou estudo", "Trabalho")) restante -= manha;
    }
    while (restante >= 15) {
      const pedaco = Math.min(restante, CICLO_FOCO);
      if (!dia.encaixar(almocoFim, pedaco, "Trabalho ou estudo", "Trabalho")) break;
      restante -= pedaco;
    }
  }

  // 3. Áreas da vida: cada uma no período que faz sentido para ela.
  const areas = Object.entries(input.horasPorArea)
    .filter(([, h]) => h > 0)
    .sort((a, b) => b[1] - a[1]);
  for (const [area, horas] of areas) {
    const totalMin = arredonda(horas * 60);
    const preferidos = input.diasPorArea?.[area]?.filter((d) => d >= 0 && d <= 6);
    const escolhidos =
      preferidos && preferidos.length
        ? [...new Set(preferidos)]
        : (() => {
            const quantos = Math.min(7, Math.max(1, Math.round(totalMin / 90)));
            return Array.from({ length: quantos }, (_, i) => Math.round((i * 7) / quantos) % 7);
          })();
    const porDia = arredonda(totalMin / (escolhidos.length || 1));
    const matinal = MATINAIS.test(area);
    const noturna = NOTURNAS.test(area);
    for (const d of escolhidos) {
      const dia = dias[d];
      if (!dia) continue;
      const tentativas = matinal
        ? [cafeFim + 10, almocoFim + 30, jantarIni - 120, ACORDAR]
        : noturna
          ? [jantarIni + DURACAO_REFEICAO.jantar, almocoFim + 60, cafeFim + 10]
          : [almocoFim + 30, jantarIni + DURACAO_REFEICAO.jantar, cafeFim + 10, ACORDAR];
      let colocou = false;
      for (const t of tentativas) {
        if (dia.encaixar(Math.max(ACORDAR, t), porDia, area, area)) {
          colocou = true;
          break;
        }
      }
      // Último recurso: qualquer espaço livre do dia, mesmo que menor.
      if (!colocou) {
        for (const dur of [porDia, 60, 45, 30, 15]) {
          if (dur <= porDia && dia.encaixar(ACORDAR, dur, area, area)) {
            colocou = true;
            if (dur < porDia) naoCoube.push({ area, minutos: porDia - dur });
            break;
          }
        }
      }
      if (!colocou) naoCoube.push({ area, minutos: porDia });
    }
  }

  // 4. Pausas: uma a cada 2h de atividade contínua — nunca duas seguidas,
  //    nunca colada numa refeição.
  for (const dia of dias) {
    const ordem = [...dia.blocos].sort((a, b) => a.inicio - b.inicio);
    let acumulado = 0;
    for (const [i, b] of ordem.entries()) {
      if (b.area === "Alimentação") {
        acumulado = 0; // comer já é a pausa
        continue;
      }
      acumulado += b.fim - b.inicio;
      if (acumulado < CICLO_FOCO) continue;
      const proximo = ordem[i + 1];
      const proximoEhRefeicao = proximo?.area === "Alimentação" && proximo.inicio - b.fim < 30;
      if (proximoEhRefeicao) {
        acumulado = 0;
        continue;
      }
      // A pausa entra logo depois do bloco; se ali estiver ocupado, cai no
      // primeiro espaço livre seguinte — nunca é descartada em silêncio.
      if (dia.por(b.fim, pausaMin, "Pausa", "Pausas") || dia.encaixar(b.fim, pausaMin, "Pausa", "Pausas"))
        acumulado = 0;
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
  padroes.sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime));

  // Agrupa o que sobrou por área, para a tela mostrar em uma linha por área.
  const somado = new Map<string, number>();
  for (const n of naoCoube) somado.set(n.area, (somado.get(n.area) ?? 0) + n.minutos);
  return {
    padroes,
    naoCoube: [...somado].map(([area, minutos]) => ({ area, minutos })),
  };
}
