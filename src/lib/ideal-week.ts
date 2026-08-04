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
/** Nenhuma atividade vira bloco com menos que isso. */
export const MIN_BLOCO = 30;

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

/** Janela absoluta de uma preferência. A mesma regra vale na Semana e no Hoje. */
export function janelaDoPeriodo(
  periodo: string | null | undefined,
  inicioDia: number,
  fimDia: number,
): Janela {
  if (periodo === "manha") return { inicio: inicioDia, fim: Math.min(fimDia, 12 * 60) };
  if (periodo === "tarde")
    return { inicio: Math.max(inicioDia, 12 * 60), fim: Math.min(fimDia, 18 * 60) };
  if (periodo === "noite") return { inicio: Math.max(inicioDia, 18 * 60), fim: fimDia };
  return { inicio: inicioDia, fim: fimDia };
}

export function horarioCabeNoPeriodo(
  periodo: string | null | undefined,
  inicio: number,
  fim: number,
  inicioDia = 0,
  fimDia = 24 * 60,
) {
  const janela = janelaDoPeriodo(periodo, inicioDia, fimDia);
  return inicio >= janela.inicio && fim <= janela.fim;
}

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
      if (refeicao.inicio > cursor)
        focos.push({ inicio: cursor, fim: Math.min(refeicao.inicio, fimDia) });
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

/**
 * As pausas ficam na virada dos colchetes do relógio (08:00, 10:00, 12:00…),
 * nunca dentro deles. Refeição na virada já é o respiro do ciclo.
 */
export function pausasNaGrade(
  inicioDia: number,
  fimDia: number,
  pausaMin: number,
  refeicoes: Janela[] = [],
  ciclo = CICLO_FOCO,
): Janela[] {
  const pausas: Janela[] = [];
  for (let t = Math.ceil(inicioDia / ciclo) * ciclo; t + pausaMin <= fimDia; t += ciclo) {
    if (t <= inicioDia) continue;
    if (refeicoes.some((r) => t < r.fim && t + pausaMin > r.inicio)) continue;
    pausas.push({ inicio: t, fim: t + pausaMin });
  }
  return pausas;
}

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
    const minimo = Math.min(Math.max(minPedaco, MIN_BLOCO), restante);
    for (const vaga of this.vagas(apartirDe)) {
      if (restante < MIN_BLOCO) break;
      const inicio = sobe15(vaga.inicio);
      if (vaga.fim - inicio < MIN_BLOCO) continue;
      const limiteColchete = (Math.floor(inicio / CICLO_FOCO) + 1) * CICLO_FOCO;
      const dur =
        Math.floor(Math.min(restante, vaga.fim - inicio, limiteColchete - inicio) / 15) * 15;
      // Nada de fatias insignificantes: um pedaço menor que isso não vira bloco.
      if (dur < minimo) continue;
      if (this.por(inicio, dur, titulo, area)) restante -= dur;
    }
    return restante;
  }

  /**
   * Igual ao `preencher`, mas só dentro da janela do período escolhido.
   * O período é regra: fora dele a área não é agendada. `pedacos` diz em
   * quantos blocos a área aparece no dia (uma ou duas vezes).
   */
  preencherEm(janela: Janela, total: number, titulo: string, area: string, pedacos = 1) {
    let restante = Math.floor(total / 15) * 15;
    const partes = Math.max(1, Math.min(pedacos, Math.floor(restante / MIN_BLOCO) || 1));
    const base = Math.max(MIN_BLOCO, Math.floor(restante / partes / 15) * 15);
    let colocados = 0;
    for (const vaga of this.vagas(janela.inicio)) {
      if (restante < MIN_BLOCO) break;
      if (vaga.inicio >= janela.fim) break;
      const inicio = Math.max(sobe15(vaga.inicio), sobe15(janela.inicio));
      const limiteColchete = (Math.floor(inicio / CICLO_FOCO) + 1) * CICLO_FOCO;
      const fim = Math.min(vaga.fim, janela.fim, limiteColchete);
      if (fim - inicio < MIN_BLOCO) continue;
      const alvo = colocados >= partes - 1 ? restante : base;
      // Não encurta silenciosamente a carga pedida só porque a primeira vaga
      // do período é pequena. Procura a próxima vaga que comporte esta parte.
      if (fim - inicio < alvo) continue;
      const dur = Math.floor(Math.min(alvo, fim - inicio) / 15) * 15;
      if (dur < MIN_BLOCO) continue;
      if (this.por(inicio, dur, titulo, area)) {
        restante -= dur;
        colocados++;
      }
    }
    return restante;
  }
}

const arredonda = (min: number) => Math.max(15, Math.round(min / 15) * 15);
/** Sobe para o próximo horário redondo (:00, :15, :30, :45). */
const sobe15 = (min: number) => Math.ceil(min / 15) * 15;

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
  /** Quantos blocos por dia cada área ocupa (1 = uma vez por dia). */
  vezesPorDiaPorArea?: Record<string, number>;
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
  const acordar = input.acordar ?? ACORDAR;
  const ciclo = Math.max(30, input.cicloFoco ?? CICLO_FOCO);
  const dur = { ...DURACAO_REFEICAO, ...(input.duracaoRefeicao ?? {}) };
  const dormir = Math.min(23 * 60, acordar + Math.round((24 - input.sono) * 60));
  const dias = Array.from({ length: 7 }, () => new Dia(acordar, dormir));
  const horarios = input.refeicoes ?? REFEICOES_HORARIOS;
  const pausaMin = Math.min(30, Math.max(15, input.pausaMinutos ?? PAUSA_MINUTOS));
  const refeicoes = [
    { titulo: "Café da manhã", hora: minutos(horarios.cafe), dur: dur.cafe },
    { titulo: "Almoço", hora: minutos(horarios.almoco), dur: dur.almoco },
    { titulo: "Lanche da tarde", hora: minutos(horarios.lanche), dur: dur.lanche },
    { titulo: "Jantar", hora: minutos(horarios.jantar), dur: dur.jantar },
  ];

  // 1. Refeições nos horários que a pessoa informou — as âncoras do ritmo.
  for (const dia of dias) {
    for (const r of refeicoes) dia.por(r.hora, r.dur, r.titulo, "Alimentação");
  }

  const cafeFim = minutos(horarios.cafe) + dur.cafe;
  const almocoIni = minutos(horarios.almoco);
  const almocoFim = almocoIni + dur.almoco;
  const jantarIni = minutos(horarios.jantar);

  // 2. Pausas na grade fixa: de 2 em 2 horas, sempre no mesmo lugar do
  //    relógio. Ficam reservadas ANTES das atividades, para que nenhuma
  //    atividade ocupe o descanso.
  const janelasRefeicao: Janela[] = refeicoes.map((r) => ({ inicio: r.hora, fim: r.hora + r.dur }));
  const pausas = pausasNaGrade(acordar, dormir, pausaMin, janelasRefeicao, ciclo);
  for (const dia of dias) {
    for (const p of pausas) dia.por(p.inicio, p.fim - p.inicio, "Pausa", "Pausas");
  }

  // 3. Áreas da vida: primeiro garantimos cada compromisso exatamente nos
  //    dias e períodos escolhidos. O trabalho flexível ocupa apenas o espaço
  //    restante — nunca apaga academia, fé, lazer ou outra prioridade.
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
    // O período vem da área da vida, não de palavra-chave.
    const periodo = input.periodoPorArea?.[area] ?? "qualquer";
    // O período é regra, não preferência: a área só entra na janela dele.
    const janela = janelaDoPeriodo(periodo, acordar, dormir);
    const vezes = Math.max(1, Math.min(2, input.vezesPorDiaPorArea?.[area] ?? 1));
    for (const d of escolhidos) {
      const dia = dias[d];
      if (!dia) continue;
      // Uma ou duas aparições por dia, conforme a preferência da área.
      const restante = dia.preencherEm(janela, porDia, area, area, vezes);
      if (restante >= MIN_BLOCO) naoCoube.push({ area, minutos: restante });
    }
  }

  // 4. Trabalho ou estudo preenche o restante do dia depois das prioridades.
  const inicioTrabalho = sobe15(Math.max(cafeFim + 30, acordar + 90));
  for (const d of input.diasTrabalho) {
    const dia = dias[d];
    if (!dia) continue;
    const pedido = arredonda(input.horasTrabalho * 60);
    const alvo = Math.min(pedido, dia.minutosLivres(inicioTrabalho));
    let restante = dia.preencher(inicioTrabalho, alvo, "Trabalho ou estudo", "Trabalho");
    if (restante >= MIN_BLOCO)
      restante = dia.preencher(acordar, restante, "Trabalho ou estudo", "Trabalho");
    const faltou = pedido - (alvo - restante);
    if (faltou >= MIN_BLOCO) naoCoube.push({ area: "Trabalho", minutos: faltou });
  }

  // 5. A pausa é o respiro entre duas sessões: fica sempre que houver
  //    atividade antes e depois dela no dia, mesmo sem encostar nos blocos.
  for (const dia of dias) {
    dia.blocos = dia.blocos.filter((b) => {
      if (b.area !== "Pausas") return true;
      const antes = dia.blocos.some((x) => x.area !== "Pausas" && x.fim <= b.inicio);
      const depois = dia.blocos.some((x) => x.area !== "Pausas" && x.inicio >= b.fim);
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
