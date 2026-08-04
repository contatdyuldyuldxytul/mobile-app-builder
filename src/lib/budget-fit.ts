/**
 * Encaixe proporcional das horas no teto do dia. É a mesma regra na aba
 * Semana e no onboarding: ao aumentar uma área, as outras cedem
 * proporcionalmente nos mesmos dias e o dia nunca estoura.
 */

export type FitEstado = { horasDia: number; dias: number[] };
export type FitArea = { id: string; name: string; is_anchor?: boolean | null };

/** Áreas que o app cuida sozinho — a pessoa não escolhe horas nem dias. */
export const ehSono = (n: string) => /dorm|sono|sleep/i.test(n);
export const ehAlimentacao = (n: string) => /aliment|refei/i.test(n);
export const ehPausa = (n: string) => /pausa|descanso curto/i.test(n);
export const ehAutomatica = (n: string) => ehAlimentacao(n) || ehPausa(n);

/** Horas comprometidas em cada dia da semana (0 = segunda). */
export function usoPorDia(mapa: Record<string, FitEstado>, lista: FitArea[]) {
  const uso = Array.from({ length: 7 }, () => 0);
  for (const d of lista) {
    if (ehSono(d.name) || ehAutomatica(d.name)) continue;
    const e = mapa[d.id];
    if (!e?.horasDia) continue;
    for (const dia of e.dias) if (dia >= 0 && dia <= 6) uso[dia] += e.horasDia;
  }
  return uso;
}

/**
 * Reduz proporcionalmente as áreas flexíveis até que nenhum dia passe do teto.
 * `protegido` é a área que a pessoa acabou de mexer — ela nunca cede. Em
 * último caso as âncoras cedem, e nenhuma área fica abaixo de 30 min por dia.
 */
export function encaixarNoTeto(
  mapa: Record<string, FitEstado>,
  lista: FitArea[],
  cap: number,
  protegido?: string,
) {
  const PISO = 0.5;
  const proximo = { ...mapa };
  for (let volta = 0; volta < 24; volta++) {
    const estouro = usoPorDia(proximo, lista)
      .map((h, i) => ({ i, excesso: h - cap }))
      .filter((x) => x.excesso > 0.01);
    if (!estouro.length) break;

    let mudou = false;
    for (const { i, excesso } of estouro) {
      const rodadas: Array<{ ancoras: boolean; piso: number }> = [
        { ancoras: false, piso: PISO },
        { ancoras: false, piso: 0 },
        { ancoras: true, piso: PISO },
      ];
      let falta = excesso;
      for (const { ancoras, piso } of rodadas) {
        if (falta <= 0.01) break;
        const doadoras = lista.filter(
          (d) =>
            d.id !== protegido &&
            (ancoras || !d.is_anchor) &&
            !ehSono(d.name) &&
            !ehAutomatica(d.name) &&
            (proximo[d.id]?.horasDia ?? 0) > piso &&
            proximo[d.id]?.dias.includes(i),
        );
        const disponivel = doadoras.reduce((s, d) => s + (proximo[d.id].horasDia - piso), 0);
        if (disponivel <= 0.01) continue;
        const tirarTotal = Math.min(falta, disponivel);
        for (const d of doadoras) {
          const e = proximo[d.id];
          const tirar = ((e.horasDia - piso) / disponivel) * tirarTotal;
          const novo = Number(Math.max(piso, e.horasDia - tirar).toFixed(2));
          if (novo !== e.horasDia) mudou = true;
          proximo[d.id] = { ...e, horasDia: novo };
        }
        falta -= tirarTotal;
      }
    }
    if (!mudou) break;
  }
  return proximo;
}

/** Quanto ainda cabe nos dias em que a área acontece. */
export function folgaNaArea(uso: number[], dias: number[], cap: number) {
  if (!dias.length) return Math.max(0, cap - Math.max(0, ...uso));
  return Math.max(0, Math.min(...dias.map((i) => cap - (uso[i] ?? 0))));
}
