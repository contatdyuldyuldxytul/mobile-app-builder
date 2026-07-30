/** Áreas da vida canônicas do onboarding. Nome + cor, sem duplicar. */

export type AreaPreset = { name: string; color: string };

export const AREA_PRESETS: AreaPreset[] = [
  { name: "Trabalho", color: "#a8763e" },
  { name: "Saúde", color: "#6b8f71" },
  { name: "Família", color: "#a35c5c" },
  { name: "Estudos", color: "#5b7fa6" },
  { name: "Descanso", color: "#3f8f8f" },
  { name: "Fé", color: "#7a6ba8" },
  { name: "Amigos", color: "#c07a4a" },
  { name: "Finanças", color: "#4f7d6e" },
  { name: "Lazer", color: "#8a7f6d" },
  { name: "Deslocamento", color: "#7c7c7c" },
];

export const A_CLASSIFICAR = "A classificar";

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
  return AREA_PRESETS.find((a) => sameArea(a.name, name))?.color ?? "#7c7c7c";
}