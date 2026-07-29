/** Presets usados no onboarding e nos hábitos. Dias: 0 = segunda … 6 = domingo. */

export const DIAS_UTEIS = [0, 1, 2, 3, 4];
export const FIM_DE_SEMANA = [5, 6];
export const TODOS_OS_DIAS = [0, 1, 2, 3, 4, 5, 6];

export type DomainPreset = {
  name: string;
  color: string;
  /** Sugestão de horas por semana. */
  hours: number;
  days: number[];
};

export const DOMAIN_PRESETS: DomainPreset[] = [
  { name: "Academia / Exercício", color: "#6b8f71", hours: 4, days: [0, 2, 4] },
  { name: "Família", color: "#a35c5c", hours: 10, days: TODOS_OS_DIAS },
  { name: "Igreja", color: "#7a6ba8", hours: 4, days: [6] },
  { name: "Amigos", color: "#c07a4a", hours: 4, days: FIM_DE_SEMANA },
  { name: "Estudo pessoal", color: "#5b7fa6", hours: 5, days: DIAS_UTEIS },
  { name: "Leitura", color: "#4f7d6e", hours: 3.5, days: TODOS_OS_DIAS },
  { name: "Casa / Tarefas domésticas", color: "#8a7f6d", hours: 5, days: TODOS_OS_DIAS },
  { name: "Lazer / Descanso", color: "#3f8f8f", hours: 7, days: TODOS_OS_DIAS },
  { name: "Projeto pessoal", color: "#a8763e", hours: 5, days: DIAS_UTEIS },
  { name: "Deslocamento", color: "#7c7c7c", hours: 5, days: DIAS_UTEIS },
];

export type HabitPreset = {
  name: string;
  type: "fazer" | "evitar";
  days: number[];
  /** Nome da área da vida sugerida, se existir. */
  domain?: string;
};

export const HABIT_PRESETS: HabitPreset[] = [
  { name: "Ler a Bíblia", type: "fazer", days: TODOS_OS_DIAS, domain: "Igreja" },
  { name: "Beber água", type: "fazer", days: TODOS_OS_DIAS },
  { name: "Orar", type: "fazer", days: TODOS_OS_DIAS, domain: "Igreja" },
  { name: "Ler um livro", type: "fazer", days: TODOS_OS_DIAS, domain: "Leitura" },
  { name: "Exercitar-se", type: "fazer", days: [0, 2, 4], domain: "Academia / Exercício" },
  { name: "Dormir cedo", type: "fazer", days: TODOS_OS_DIAS },
  { name: "Sem celular na primeira hora", type: "evitar", days: TODOS_OS_DIAS },
  { name: "Caminhar", type: "fazer", days: TODOS_OS_DIAS, domain: "Lazer / Descanso" },
];

export const ROTULO_DIAS: { label: string; days: number[] }[] = [
  { label: "Todos os dias", days: TODOS_OS_DIAS },
  { label: "Dias úteis", days: DIAS_UTEIS },
  { label: "Fim de semana", days: FIM_DE_SEMANA },
];

export function mesmoConjunto(a: number[], b: number[]) {
  return a.length === b.length && [...a].sort().every((v, i) => v === [...b].sort()[i]);
}

/** "10h/semana em 5 dias" → "≈ 2h por dia". */
export function porDia(horasSemana: number, dias: number) {
  if (!dias || !horasSemana) return "—";
  const min = Math.round((horasSemana * 60) / dias);
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h && m) return `${h}h${String(m).padStart(2, "0")}`;
  if (h) return `${h}h`;
  return `${m}min`;
}