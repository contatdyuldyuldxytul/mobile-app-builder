/**
 * Quando cada guardião aparece. Só leitura dos dados que o app já tem —
 * as regras de raridade ficam no provider.
 */
import { useEffect } from "react";
import { useGuardiaoAnimado } from "@/components/guardiao-provider";
import { useCheckinsRange, useDailyPlansRange } from "./data";
import { addDays, toISODate, todayISO } from "./dates";
import type { GuardiaoAnimado } from "./guardiao-animacao";

type BlocoLeve = { block_kind: string; completed: boolean };

/** Check, Nuvem, Sol e Folha — avaliados na tela Hoje. */
export function useGatilhosHoje(blocos: BlocoLeve[]) {
  const { disparar } = useGuardiaoAnimado();
  const hoje = todayISO();
  const de5 = toISODate(addDays(new Date(), -4));
  const de28 = toISODate(addDays(new Date(), -27));
  const { data: planos = [] } = useDailyPlansRange(de5, hoje);
  const { data: checkins = [] } = useCheckinsRange(de28, hoje);

  useEffect(() => {
    const candidatos: GuardiaoAnimado[] = [];

    const atividades = blocos.filter((b) => b.block_kind !== "pausa");
    if (atividades.length && atividades.every((b) => b.completed)) candidatos.push("check");

    const pausas = blocos.filter((b) => b.block_kind === "pausa");
    if (pausas.length && pausas.every((b) => b.completed)) candidatos.push("nuvem");

    // Sol: cinco manhãs seguidas com a intenção do dia definida.
    const dias = Array.from({ length: 5 }, (_, i) => toISODate(addDays(new Date(), -i)));
    const cincoManhas = dias.every((d) =>
      planos.some(
        (p) => p.date === d && ((p.intention ?? "").trim() || (p.devotional_reflection ?? "").trim()),
      ),
    );
    if (cincoManhas) candidatos.push("sol");

    // Folha: quatro semanas seguidas honrando o orçamento.
    const quatroSemanas = [0, 1, 2, 3].every((s) => {
      const fim = toISODate(addDays(new Date(), -7 * s));
      const ini = toISODate(addDays(new Date(), -7 * s - 6));
      return checkins.some((c) => c.date >= ini && c.date <= fim && c.honored_budget);
    });
    if (quatroSemanas) candidatos.push("folha");

    if (candidatos.length) disparar(...candidatos);
  }, [blocos, planos, checkins, disparar]);
}

/** Montanha: uma meta do mês concluída. */
export function useGatilhoMontanha(concluiuMeta: boolean) {
  const { disparar } = useGuardiaoAnimado();
  useEffect(() => {
    if (concluiuMeta) disparar("montanha");
  }, [concluiuMeta, disparar]);
}