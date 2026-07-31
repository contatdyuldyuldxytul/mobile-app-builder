/**
 * Camada de gamificação: os personagens-guardiões.
 *
 * Regra de arquitetura: nada é armazenado. O estado de cada personagem é
 * derivado, na leitura, dos dados que o app já coleta — sobre uma janela
 * móvel dos últimos 14 dias. Assim, editar um dia retroativo corrige o
 * ecossistema sozinho e a fórmula pode mudar sem migração.
 *
 * Princípio: os personagens refletem, não cobram. Nenhum número de
 * gamificação sai daqui — só estado e uma frase sobre o que a pessoa fez.
 */
import { useMemo } from "react";
import {
  useBlocksRange,
  useCheckinsRange,
  useDailyPlan,
  useDomains,
  useFocusSessions,
  useGoalsEveryStatus,
  useSettings,
  useTimeBudgets,
  useWeeklyPlan,
} from "./data";
import { addDays, hoursBetween, toISODate, todayISO, weekStart } from "./dates";

export type EstadoGuardiao = "adormecido" | "desperto" | "firme" | "radiante";

export type PersonagemId =
  | "ampulheta"
  | "sol"
  | "check"
  | "alvo"
  | "montanha"
  | "nuvem"
  | "folha"
  | "caderno"
  | "estrela"
  | "balao";

export type Guardiao = {
  id: PersonagemId;
  nome: string;
  principio: string;
  estado: EstadoGuardiao;
  /** Passou muito do que combinou — desequilíbrio, não conquista. */
  sobrecarregado: boolean;
  /** Frase curta sobre o que aconteceu de fato. Nunca genérica, nunca cobrança. */
  frase: string;
};

/** Arquivo de arte por personagem — um único SVG; os estados são filtros. */
export const ARTE: Record<PersonagemId, string> = {
  ampulheta: "/personagens/ampulheta.svg",
  sol: "/personagens/sol.svg",
  check: "/personagens/check.svg",
  alvo: "/personagens/alvo.svg",
  montanha: "/personagens/montanha.svg",
  nuvem: "/personagens/nuvem.svg",
  folha: "/personagens/folha.svg",
  caderno: "/personagens/caderno.svg",
  // Provisórios até a arte definitiva chegar.
  estrela: "/personagens/sol.svg",
  balao: "/personagens/ampulheta.svg",
};

function estadoDe(n: number): EstadoGuardiao {
  if (n < 0.2) return "adormecido";
  if (n < 0.5) return "desperto";
  if (n < 0.8) return "firme";
  return "radiante";
}

/** Honra = perto do combinado. Faltar e exceder afastam do centro igualmente. */
function honra(realizado: number, planejado: number) {
  if (planejado <= 0) return realizado > 0 ? 0.5 : 0;
  return Math.max(0, 1 - Math.abs(realizado - planejado) / planejado);
}

function plural(n: number, um: string, muitos: string) {
  return `${n} ${n === 1 ? um : muitos}`;
}

export type LeituraGuardioes = {
  /** 0..1 — a areia da ampulheta: o quanto da semana foi honrado. */
  areia: number;
  /** Dia da semana em curso (1 = segunda). Serve para "a ampulheta virou". */
  diaDaSemana: number;
  ampulhetaFrase: string;
  guardioes: Guardiao[];
  /** O guardião que mais pede atenção agora — para a tela Hoje. */
  destaque: Guardiao;
  /** Conquista real e rara. Nulo quase sempre. */
  estrela: { titulo: string; frase: string } | null;
  carregando: boolean;
};

export function useGuardioes(): LeituraGuardioes {
  const hoje = todayISO();
  const inicio = weekStart();
  const inicioISO = toISODate(inicio);
  const fimISO = toISODate(addDays(inicio, 6));
  const janelaISO = toISODate(addDays(new Date(), -13));

  const { data: settings } = useSettings();
  const { data: domains = [] } = useDomains();
  const { data: plano } = useWeeklyPlan(inicio);
  const { data: budgets = [], isLoading: carregandoBudgets } = useTimeBudgets(plano?.id);
  const { data: blocosJanela = [], isLoading: carregandoBlocos } = useBlocksRange(janelaISO, hoje);
  const { data: blocosSemana = [] } = useBlocksRange(inicioISO, fimISO);
  const { data: checkins = [] } = useCheckinsRange(janelaISO, hoje);
  const { data: sessoes = [] } = useFocusSessions(janelaISO);
  const { data: metas = [] } = useGoalsEveryStatus();
  const { data: planoDoDia } = useDailyPlan(hoje);

  return useMemo(() => {
    const diaDaSemana = ((new Date().getDay() + 6) % 7) + 1;

    // ---- Ampulheta: a areia é o orçamento da semana honrado, área por área.
    const realizadoSemana: Record<string, number> = {};
    blocosSemana.forEach((b) => {
      if (!b.domain_id || !b.completed) return;
      realizadoSemana[b.domain_id] =
        (realizadoSemana[b.domain_id] ?? 0) + hoursBetween(b.start_time, b.end_time);
    });
    const decorrido = Math.min(1, diaDaSemana / 7);
    const porArea = budgets.map((b) => {
      const previsto = Number(b.planned_hours) * decorrido;
      const feito = realizadoSemana[b.domain_id] ?? 0;
      return { domainId: b.domain_id, previsto, feito, honra: honra(feito, previsto) };
    });
    const areia = porArea.length ? porArea.reduce((s, a) => s + a.honra, 0) / porArea.length : 0;
    const excedida = porArea.find((a) => a.previsto > 0 && a.feito > a.previsto * 1.35);
    const nomeArea = (id: string) => domains.find((d) => d.id === id)?.name ?? "uma área";
    const maisVazia = [...porArea].sort((a, b) => a.honra - b.honra)[0];

    const ampulhetaFrase = !porArea.length
      ? "Ainda sem orçamento nesta semana — a areia começa quando você reservar horas."
      : excedida
        ? `${nomeArea(excedida.domainId)} passou bem do que você combinou; o tempo saiu de outro lugar.`
        : areia >= 0.8
          ? "A areia está caindo no ritmo que você combinou."
          : maisVazia
            ? `${nomeArea(maisVazia.domainId)} é a parte que menos recebeu tempo esta semana.`
            : "A semana está começando.";

    // ---- Sol: intenção do dia e a manhã iniciada.
    const blocosHoje = blocosJanela.filter((b) => b.date === hoje);
    const manhaFeita = blocosHoje.filter(
      (b) => b.completed && b.block_kind !== "pausa" && b.start_time < "12:00",
    ).length;
    const temIntencao = !!planoDoDia?.intention?.trim();
    const sol = (temIntencao ? 0.5 : 0) + Math.min(0.5, manhaFeita * 0.25);
    const solFrase = temIntencao
      ? manhaFeita
        ? `Intenção escrita e ${plural(manhaFeita, "bloco", "blocos")} da manhã já fechado${manhaFeita === 1 ? "" : "s"}.`
        : "A intenção do dia está escrita; a manhã ainda não começou."
      : manhaFeita
        ? "A manhã começou, mas o dia ficou sem intenção escrita."
        : "O dia ainda não recebeu uma intenção.";

    // ---- Check: planejado x realizado na janela + check-ins honrados.
    const tarefasJanela = blocosJanela.filter((b) => b.block_kind !== "pausa");
    const feitosJanela = tarefasJanela.filter((b) => b.completed).length;
    const aderencia = tarefasJanela.length ? feitosJanela / tarefasJanela.length : 0;
    const honrados = checkins.filter((c) => c.honored_budget).length;
    const check = Math.min(1, aderencia * 0.75 + Math.min(0.25, honrados * 0.05));
    const checkFrase = tarefasJanela.length
      ? `Você fechou ${feitosJanela} dos ${tarefasJanela.length} blocos que combinou nas últimas duas semanas.`
      : "Ainda não há blocos combinados para comparar.";

    // ---- Alvo: sessões de foco levadas até o fim.
    const concluidas = sessoes.filter((s) => s.ended_at).length;
    const alvo = Math.min(1, concluidas / 10);
    const alvoFrase = concluidas
      ? `${plural(concluidas, "ciclo de foco levado", "ciclos de foco levados")} até o fim.`
      : "Nenhum ciclo de foco iniciado por aqui ainda.";

    // ---- Montanha: metas caminhando.
    const emAndamento = metas.filter((g) => g.status === "em_andamento").length;
    const metasFeitas = metas.filter((g) => g.status === "concluida").length;
    const montanha = metas.length
      ? Math.min(1, (metasFeitas + emAndamento * 0.5) / metas.length)
      : 0;
    const montanhaFrase = metas.length
      ? `${plural(metasFeitas, "meta concluída", "metas concluídas")} e ${emAndamento} em andamento.`
      : "Nenhuma meta definida para este mês.";

    // ---- Nuvem: as pausas realmente tiradas.
    const pausasFeitas = blocosJanela.filter((b) => b.block_kind === "pausa" && b.completed).length;
    const pausasSessao = sessoes.filter((s) => s.took_break).length;
    const totalPausas = pausasFeitas + pausasSessao;
    const nuvem = Math.min(1, totalPausas / 12);
    const nuvemFrase = totalPausas
      ? `${plural(totalPausas, "pausa tirada", "pausas tiradas")} nas últimas duas semanas.`
      : "As pausas de duas em duas horas ainda estão passando batido.";

    // ---- Folha: ritmo — apareceu perto do combinado em quantos dias.
    const diasComBloco = new Set(blocosJanela.map((b) => b.date));
    const diasHonrados = new Set(
      blocosJanela.filter((b) => b.completed && b.block_kind !== "pausa").map((b) => b.date),
    );
    const folha = diasComBloco.size ? diasHonrados.size / Math.max(7, diasComBloco.size) : 0;
    const folhaFrase = diasHonrados.size
      ? `Você apareceu em ${plural(diasHonrados.size, "dia", "dias")} dos últimos catorze.`
      : "As últimas duas semanas passaram sem blocos concluídos.";

    // ---- Caderno: a revisão semanal feita.
    const revisou = (settings?.last_weekly_prompt_date ?? "") >= inicioISO;
    const reflexoes = checkins.filter((c) => c.reflection?.trim()).length;
    const caderno = (revisou ? 0.6 : 0) + Math.min(0.4, reflexoes * 0.1);
    const cadernoFrase = revisou
      ? "A revisão desta semana já está feita."
      : reflexoes
        ? `${plural(reflexoes, "reflexão escrita", "reflexões escritas")}, mas a revisão da semana ficou pendente.`
        : "A revisão da semana ainda não foi feita.";

    // Exceder uma área derruba os outros: o tempo saiu de algum lugar.
    const penalidade = excedida ? 0.75 : 1;

    const guardioes: Guardiao[] = [
      {
        id: "sol",
        nome: "Sol",
        principio: "Começar o dia com intenção",
        estado: estadoDe(sol),
        sobrecarregado: false,
        frase: solFrase,
      },
      {
        id: "check",
        nome: "Check",
        principio: "Que o seu sim seja sim",
        estado: estadoDe(excedida ? Math.min(check, 0.45) : check),
        sobrecarregado: !!excedida,
        frase: excedida
          ? `${checkFrase} ${nomeArea(excedida.domainId)} passou do combinado.`
          : checkFrase,
      },
      {
        id: "alvo",
        nome: "Alvo",
        principio: "Uma coisa por vez",
        estado: estadoDe(alvo),
        sobrecarregado: false,
        frase: alvoFrase,
      },
      {
        id: "montanha",
        nome: "Montanha",
        principio: "Priorizar o que importa",
        estado: estadoDe(montanha * penalidade),
        sobrecarregado: false,
        frase: montanhaFrase,
      },
      {
        id: "nuvem",
        nome: "Nuvem",
        principio: "Descanso produtivo",
        estado: estadoDe(nuvem * penalidade),
        sobrecarregado: false,
        frase: nuvemFrase,
      },
      {
        id: "folha",
        nome: "Folha",
        principio: "Eliminar toda pressa",
        estado: estadoDe(folha * penalidade),
        sobrecarregado: false,
        frase: folhaFrase,
      },
      {
        id: "caderno",
        nome: "Caderno",
        principio: "Processar tudo num lugar só",
        estado: estadoDe(caderno),
        sobrecarregado: false,
        frase: cadernoFrase,
      },
    ];

    const ordem: Record<EstadoGuardiao, number> = {
      adormecido: 0,
      desperto: 1,
      firme: 2,
      radiante: 3,
    };
    const destaque =
      guardioes.find((g) => g.sobrecarregado) ??
      [...guardioes].sort((a, b) => ordem[a.estado] - ordem[b.estado])[0];

    // Estrela: rara de verdade.
    const semanaInteira = areia >= 0.9 && diaDaSemana >= 7;
    const metaRecem = metas.find(
      (g) => g.status === "concluida" && (g.updated_at ?? "").slice(0, 10) === hoje,
    );
    const estrela = metaRecem
      ? { titulo: "Meta concluída", frase: `Você fechou “${metaRecem.title}”.` }
      : semanaInteira
        ? {
            titulo: "Semana inteira honrada",
            frase: "A semana terminou dentro do que você combinou.",
          }
        : null;

    return {
      areia,
      diaDaSemana,
      ampulhetaFrase,
      guardioes,
      destaque,
      estrela,
      carregando: carregandoBlocos || carregandoBudgets,
    };
  }, [
    blocosJanela,
    blocosSemana,
    budgets,
    checkins,
    domains,
    hoje,
    inicioISO,
    metas,
    planoDoDia,
    sessoes,
    settings,
    carregandoBlocos,
    carregandoBudgets,
  ]);
}
