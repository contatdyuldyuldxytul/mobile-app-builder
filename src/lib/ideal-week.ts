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

export type DuracaoRefeicao = typeof DURACAO_REFEICAO;

/** Soma dos minutos das quatro refeições (usa os padrões quando não vier nada). */
export function minutosRefeicoesDia(dur: Partial<DuracaoRefeicao> = {}) {
  const d = { ...DURACAO_REFEICAO, ...dur };
  return d.cafe + d.almoco + d.lanche + d.jantar;
}

export const MINUTOS_REFEICOES_DIA = minutosRefeicoesDia();

/** Período do dia preferido por uma área da vida. */
export type Periodo = "manha" | "tarde" | "noite" | "qualquer";

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
export type Janela = { inicio: number; fim: number };

/**
 * A grade do dia: ciclos de foco de 2h separados por pausas de duração fixa.
 * É determinística — a pausa cai sempre no fecho de um ciclo, nunca no meio
 * de um bloco e nunca em horário aleatório. Uma refeição que cai dentro do
 * ciclo faz o papel da pausa: fecha o ciclo e o próximo começa quando ela
 * termina.
 */
export function gradeDeCiclos(
  inicioDia: number,
  fimDia: number,
  pausaMin: number,
  refeicoes: Janela[] = [],
  ciclo = CICLO_FOCO,
): { focos: Janela[]; pausas: Janela[] } {
  const ordenadas = [...refeicoes].sort((a, b) => a.inicio - b.inicio);
  const focos: Janela[] = [];
  const pausas: Janela[] = [];
  let cursor = inicioDia;

  for (let i = 0; i < 60 && cursor < fimDia; i++) {
    const refeicao = ordenadas.find((r) => r.fim > cursor && r.inicio < cursor + ciclo);
    if (refeicao) {
      if (refeicao.inicio > cursor) focos.push({ inicio: cursor, fim: Math.min(refeicao.inicio, fimDia) });
      cursor = Math.max(cursor + 15, refeicao.fim);
      continue;
    }
    const fimFoco = Math.min(cursor + ciclo, fimDia);
    focos.push({ inicio: cursor, fim: fimFoco });
    cursor = fimFoco;
    if (cursor + pausaMin > fimDia) break;
    pausas.push({ inicio: cursor, fim: cursor + pausaMin });
    cursor += pausaMin;
  }
  return { focos, pausas };
}

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

  /** Todos os espaços livres a partir de um horário, em ordem. */
  vagas(apartirDe: number): Janela[] {
    const ordem = [...this.blocos].sort((a, b) => a.inicio - b.inicio);
    const livres: Janela[] = [];
    let cursor = Math.max(apartirDe, this.inicio);
    for (const b of ordem) {
      if (b.fim <= cursor) continue;
      if (b.inicio > cursor) livres.push({ inicio: cursor, fim: Math.min(b.inicio, this.fim) });
      cursor = Math.max(cursor, b.fim);
      if (cursor >= this.fim) break;
    }
    if (cursor < this.fim) livres.push({ inicio: cursor, fim: this.fim });
    return livres.filter((v) => v.fim - v.inicio >= 15);
  }

  minutosLivres(apartirDe = this.inicio) {
    return this.vagas(apartirDe).reduce((s, v) => s + (v.fim - v.inicio), 0);
  }

  /**
   * Coloca `total` minutos da área nas vagas disponíveis, fatiando quando
   * preciso. Nunca inventa tempo: devolve o que não coube.
   */
  preencher(apartirDe: number, total: number, titulo: string, area: string, minPedaco = 30) {
    let restante = Math.floor(total / 15) * 15;
    const minimo = Math.min(minPedaco, restante);
    for (const vaga of this.vagas(apartirDe)) {
      if (restante < 15) break;
      const dur = Math.floor(Math.min(restante, vaga.fim - vaga.inicio) / 15) * 15;
      // Nada de fatias insignificantes: um pedaço menor que isso não vira bloco.
      if (dur < minimo) continue;
      if (this.por(vaga.inicio, dur, titulo, area)) restante -= dur;
    }
    return restante;
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
  /** Hora de acordar, em minutos desde a meia-noite (padrão 06:00). */
  acordar?: number;
  /** Duração do ciclo de foco, em minutos (padrão 120). */
  cicloFoco?: number;
  /** Duração de cada refeição, em minutos. */
  duracaoRefeicao?: Partial<DuracaoRefeicao>;
  /** Horas por semana das áreas extras (sem trabalho, refeições e pausas). */
  horasPorArea: Record<string, number>;
  /** Em quais dias da semana cada área acontece (0 = segunda). */
  diasPorArea?: Record<string, number[]>;
  /** Período do dia preferido por área. */
  periodoPorArea?: Record<string, Periodo>;
};

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

  // 2. Pausas na grade fixa: de 2 em 2 horas, sempre no mesmo lugar do
  //    relógio. Ficam reservadas ANTES das atividades, para que nenhuma
  //    atividade ocupe o descanso.
  const janelasRefeicao: Janela[] = refeicoes.map((r) => ({ inicio: r.hora, fim: r.hora + r.dur }));
  const { pausas } = gradeDeCiclos(ACORDAR, dormir, pausaMin, janelasRefeicao);
  for (const dia of dias) {
    for (const p of pausas) dia.por(p.inicio, p.fim - p.inicio, "Pausa", "Pausas");
  }

  // 3. Trabalho ou estudo: nunca logo ao acordar — começa depois do café,
  //    com uma folga de meia hora para a manhã respirar.
  const inicioTrabalho = Math.max(cafeFim + 30, ACORDAR + 90);
  for (const d of input.diasTrabalho) {
    const dia = dias[d];
    if (!dia) continue;
    const pedido = arredonda(input.horasTrabalho * 60);
    // O teto é o espaço realmente livre do dia — o app nunca extrapola.
    const alvo = Math.min(pedido, dia.minutosLivres(inicioTrabalho));
    let restante = dia.preencher(inicioTrabalho, alvo, "Trabalho ou estudo", "Trabalho");
    if (restante >= 15) restante = dia.preencher(ACORDAR, restante, "Trabalho ou estudo", "Trabalho");
    const faltou = pedido - (alvo - restante);
    if (faltou >= 15) naoCoube.push({ area: "Trabalho", minutos: faltou });
  }

  // 4. Áreas da vida: cada uma no período que faz sentido para ela.
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
          ? [jantarIni + DURACAO_REFEICAO.jantar, almocoFim + 60, cafeFim + 10, ACORDAR]
          : [almocoFim + 30, jantarIni + DURACAO_REFEICAO.jantar, cafeFim + 10, ACORDAR];
      // Nunca pede mais do que o dia tem de espaço livre.
      const alvo = Math.min(porDia, dia.minutosLivres());
      let restante = alvo;
      for (const t of tentativas) {
        if (restante < 15) break;
        restante = dia.preencher(Math.max(ACORDAR, t), restante, area, area);
      }
      const faltou = porDia - (alvo - restante);
      if (faltou >= 15) naoCoube.push({ area, minutos: faltou });
    }
  }

  // 5. Pausas que ficaram entre dois vazios não viram bloco solto: só
  //    permanecem as que separam de fato duas atividades.
  for (const dia of dias) {
    dia.blocos = dia.blocos.filter((b) => {
      if (b.area !== "Pausas") return true;
      const antes = dia.blocos.some((x) => x.fim === b.inicio && x.area !== "Pausas");
      const depois = dia.blocos.some((x) => x.inicio === b.fim && x.area !== "Pausas");
      return antes && depois;
    });
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
