/** Áreas da vida canônicas do onboarding. Nome + cor, sem duplicar. */

export type AreaPreset = { name: string; color: string };

export const AREA_PRESETS: AreaPreset[] = [
  { name: "Trabalho", color: "#369792" },
  { name: "Academia ou esportes", color: "#FF8060" },
  { name: "Família", color: "#FDBCB7" },
  { name: "Estudos", color: "#856CDF" },
  { name: "Lazer", color: "#FEE4B9" },
  { name: "Fé", color: "#EADFEF" },
  { name: "Amigos", color: "#FED2B7" },
  { name: "Finanças", color: "#498580" },
  { name: "Casa", color: "#E2EBE3" },
  { name: "Deslocamento", color: "#0D1D37" },
  { name: "Alimentação", color: "#FED2B7" },
  { name: "Pausas", color: "#E2EBE3" },
];

export const A_CLASSIFICAR = "A classificar";

/** Áreas automáticas: o app já as posiciona no dia, não são escolhidas. */
export const AREAS_AUTOMATICAS = ["Alimentação", "Pausas"];

/** Áreas que o usuário escolhe no onboarding. */
export const AREAS_ESCOLHIVEIS = AREA_PRESETS.filter(
  (a) => !AREAS_AUTOMATICAS.includes(a.name),
);

/** Normaliza para comparação: minúsculas, sem acento, sem espaços extras. */
export function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Duas áreas são a mesma se o nome normalizado bate — evita duplicatas. */
export function sameArea(a: string, b: string) {
  return normalize(a) === normalize(b);
}

export function areaColor(name: string) {
  return AREA_PRESETS.find((a) => sameArea(a.name, name))?.color ?? "#EADFEF";
}