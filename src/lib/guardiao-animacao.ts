/**
 * Camada de animação dos guardiões.
 *
 * Cada MP4 traz o personagem na metade de cima (RGB) e a máscara de
 * transparência na metade de baixo (tons de cinza). A composição é feita
 * quadro a quadro num canvas — nunca exiba o vídeo direto.
 *
 * Nada aqui altera `guardioes.ts`: isto é só apresentação e raridade.
 */
import ampulheta from "@/assets/personagens/ampulheta.mp4.asset.json";
import caderno from "@/assets/personagens/caderno.mp4.asset.json";
import check from "@/assets/personagens/check.mp4.asset.json";
import folha from "@/assets/personagens/folha.mp4.asset.json";
import montanha from "@/assets/personagens/montanha.mp4.asset.json";
import nuvem from "@/assets/personagens/nuvem.mp4.asset.json";
import sol from "@/assets/personagens/sol.mp4.asset.json";

export type GuardiaoAnimado =
  | "check"
  | "nuvem"
  | "sol"
  | "montanha"
  | "folha"
  | "caderno"
  | "ampulheta";

export const VIDEO: Record<GuardiaoAnimado, string> = {
  check: check.url,
  nuvem: nuvem.url,
  sol: sol.url,
  montanha: montanha.url,
  folha: folha.url,
  caderno: caderno.url,
  ampulheta: ampulheta.url,
};

/** Quanto maior, mais raro — decide o empate quando dois gatilhos batem no mesmo dia. */
export const RARIDADE: Record<GuardiaoAnimado, number> = {
  ampulheta: 7,
  folha: 6,
  montanha: 5,
  sol: 4,
  caderno: 3,
  nuvem: 2,
  check: 1,
};

/** Intervalo mínimo, em dias, entre duas exibições do mesmo guardião. */
export const INTERVALO_MINIMO: Partial<Record<GuardiaoAnimado, number>> = {
  nuvem: 10,
  sol: 14,
  folha: 30,
};

export function diasEntre(aISO: string, bISO: string) {
  const a = new Date(`${aISO}T00:00:00`);
  const b = new Date(`${bISO}T00:00:00`);
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

export type Aparicao = { guardiao: string; shown_on: string };

/**
 * Regras de raridade, aplicadas sobre o histórico gravado:
 * um por dia, nunca em dois dias seguidos (exceto o Check) e o intervalo
 * mínimo de cada personagem.
 */
export function podeAparecer(id: GuardiaoAnimado, historico: Aparicao[], hojeISO: string): boolean {
  if (historico.some((a) => a.shown_on === hojeISO)) return false;

  if (id !== "check") {
    const ontem = historico.some((a) => diasEntre(a.shown_on, hojeISO) === 1);
    if (ontem) return false;
  }

  const minimo = INTERVALO_MINIMO[id];
  if (minimo) {
    const ultima = historico
      .filter((a) => a.guardiao === id)
      .map((a) => diasEntre(a.shown_on, hojeISO))
      .sort((x, y) => x - y)[0];
    if (ultima !== undefined && ultima < minimo) return false;
  }

  return true;
}

/** Entre vários candidatos do mesmo dia, o mais raro. */
export function maisRaro(ids: GuardiaoAnimado[]): GuardiaoAnimado | null {
  if (!ids.length) return null;
  return [...ids].sort((a, b) => RARIDADE[b] - RARIDADE[a])[0];
}
