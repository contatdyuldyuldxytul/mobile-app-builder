import { A_CLASSIFICAR, normalize } from "./areas";

/**
 * Classificação por regras (sem IA): dicionário PT/EN de palavras que aparecem
 * em títulos de compromissos. Sem correspondência confiável → "A classificar".
 */
const REGRAS: { area: string; palavras: string[] }[] = [
  {
    area: "Trabalho",
    palavras: [
      "reuniao",
      "reunião",
      "meeting",
      "call",
      "1:1",
      "one on one",
      "cliente",
      "client",
      "proposta",
      "projeto",
      "sprint",
      "daily",
      "standup",
      "review",
      "alinhamento",
      "kickoff",
      "apresentacao",
      "apresentação",
      "entrevista",
      "onboarding",
      "comercial",
      "venda",
      "contrato",
      "briefing",
      "escritorio",
      "escritório",
      "expediente",
      "trabalho",
      "work",
      "equipe",
      "time",
      "board",
    ],
  },
  {
    area: "Saúde",
    palavras: [
      "treino",
      "academia",
      "gym",
      "corrida",
      "run",
      "musculacao",
      "musculação",
      "crossfit",
      "yoga",
      "pilates",
      "natacao",
      "natação",
      "fisioterapia",
      "medico",
      "médico",
      "consulta",
      "dentista",
      "exame",
      "terapia",
      "psicologo",
      "psicólogo",
      "nutricionista",
      "caminhada",
      "bike",
      "saude",
      "saúde",
    ],
  },
  {
    area: "Fé",
    palavras: [
      "culto",
      "igreja",
      "church",
      "celula",
      "célula",
      "missa",
      "oracao",
      "oração",
      "devocional",
      "estudo biblico",
      "estudo bíblico",
      "biblia",
      "bíblia",
      "louvor",
      "ministerio",
      "ministério",
      "grupo pequeno",
      "ebd",
      "retiro",
    ],
  },
  {
    area: "Estudos",
    palavras: [
      "aula",
      "curso",
      "class",
      "faculdade",
      "universidade",
      "prova",
      "exame final",
      "seminario",
      "seminário",
      "palestra",
      "workshop",
      "mentoria",
      "estudo",
      "study",
      "licao",
      "lição",
      "tcc",
      "monografia",
      "idiomas",
      "ingles",
      "inglês",
    ],
  },
  {
    area: "Família",
    palavras: [
      "familia",
      "família",
      "jantar",
      "almoco",
      "almoço",
      "aniversario",
      "aniversário",
      "escola",
      "filho",
      "filha",
      "esposa",
      "marido",
      "mae",
      "mãe",
      "pai",
      "avo",
      "avó",
      "casa dos",
      "visita",
      "reuniao de pais",
      "reunião de pais",
      "pediatra",
      "festa infantil",
    ],
  },
  {
    area: "Amigos",
    palavras: [
      "amigos",
      "friends",
      "churrasco",
      "happy hour",
      "bar",
      "encontro com",
      "futebol",
      "game night",
      "cafe com",
      "café com",
    ],
  },
  {
    area: "Finanças",
    palavras: [
      "financeiro",
      "contabilidade",
      "imposto",
      "banco",
      "fatura",
      "orcamento",
      "orçamento",
      "investimento",
      "contador",
      "boleto",
    ],
  },
  {
    area: "Lazer",
    palavras: [
      "cinema",
      "show",
      "viagem",
      "passeio",
      "praia",
      "serie",
      "série",
      "jogo",
      "hobby",
      "musica",
      "música",
      "lazer",
      "folga",
      "ferias",
      "férias",
    ],
  },
  {
    area: "Descanso",
    palavras: ["descanso", "soneca", "dormir", "sono", "pausa", "rest", "relaxar"],
  },
  {
    area: "Deslocamento",
    palavras: [
      "deslocamento",
      "transito",
      "trânsito",
      "voo",
      "aeroporto",
      "viagem de carro",
      "commute",
      "uber",
      "onibus",
      "ônibus",
    ],
  },
];

export type Classification = { area: string; confidence: number };

export type ClassifyInput = {
  title: string;
  weekday?: number;
  allDay?: boolean;
  attendees?: number;
};

/**
 * Retorna a área sugerida e a confiança (0–1). Confiança < 0.5 vira
 * "A classificar" — o app nunca chuta.
 */
export function classifyEvent(input: ClassifyInput): Classification {
  const titulo = normalize(input.title);
  if (!titulo) return { area: A_CLASSIFICAR, confidence: 0 };

  let melhor: { area: string; score: number } | null = null;
  for (const regra of REGRAS) {
    for (const palavra of regra.palavras) {
      if (!titulo.includes(palavra)) continue;
      // Palavras mais longas são sinais mais específicos.
      const score = 0.6 + Math.min(0.25, palavra.length / 60);
      if (!melhor || score > melhor.score) melhor = { area: regra.area, score };
    }
  }

  if (!melhor) {
    // Sinal fraco: compromisso com várias pessoas em dia útil quase sempre é trabalho.
    if ((input.attendees ?? 0) >= 2 && (input.weekday ?? 0) <= 4 && !input.allDay) {
      return { area: "Trabalho", confidence: 0.5 };
    }
    return { area: A_CLASSIFICAR, confidence: 0 };
  }

  let confianca = melhor.score;
  if ((input.attendees ?? 0) >= 2 && melhor.area === "Trabalho") confianca += 0.1;
  if (input.allDay) confianca -= 0.15;
  confianca = Math.max(0, Math.min(1, confianca));

  if (confianca < 0.5) return { area: A_CLASSIFICAR, confidence: confianca };
  return { area: melhor.area, confidence: confianca };
}
