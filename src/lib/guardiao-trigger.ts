/**
 * Camada de aparição dos guardiões: decide QUEM aparece e QUANDO.
 * A raridade é garantida no banco (guardian_appearances), então recarregar
 * a página nunca repete uma exibição. guardioes.ts não é tocado.
 */
import { useCallback, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { addDays, toISODate, todayISO } from "@/lib/dates";

export type GuardiaoAnim =
  | "folha"
  | "montanha"
  | "sol"
  | "ampulheta"
  | "caderno"
  | "nuvem"
  | "check";

/** Do mais raro para o mais comum — desempata quando dois gatilhos batem no mesmo dia. */
const RARIDADE: GuardiaoAnim[] = [
  "folha",
  "montanha",
  "sol",
  "ampulheta",
  "caderno",
  "nuvem",
  "check",
];

/** Intervalo mínimo, em dias, entre duas aparições do mesmo guardião. */
const INTERVALO: Partial<Record<GuardiaoAnim, number>> = { nuvem: 10, sol: 14, folha: 30 };

function diasEntre(aISO: string, bISO: string) {
  return Math.round((Date.parse(aISO) - Date.parse(bISO)) / 86_400_000);
}

/** Aplica as regras de raridade e registra a exibição. Devolve o guardião ou nulo. */
export async function escolherGuardiao(candidatos: GuardiaoAnim[]): Promise<GuardiaoAnim | null> {
  if (!candidatos.length) return null;
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) return null;

  const hoje = todayISO();
  const ontem = toISODate(addDays(new Date(), -1));
  const desde = toISODate(addDays(new Date(), -40));

  const { data: regs = [] } = await supabase
    .from("guardian_appearances")
    .select("guardiao,shown_on")
    .eq("user_id", userId)
    .gte("shown_on", desde)
    .order("shown_on", { ascending: false });

  // No máximo um guardião por dia.
  if ((regs ?? []).some((r) => r.shown_on === hoje)) return null;
  const ontemTeve = (regs ?? []).some((r) => r.shown_on === ontem);

  for (const g of RARIDADE) {
    if (!candidatos.includes(g)) continue;
    // Nunca em dois dias seguidos — exceto o Check.
    if (ontemTeve && g !== "check") continue;
    const minimo = INTERVALO[g];
    const ultimo = (regs ?? []).find((r) => r.guardiao === g);
    if (minimo && ultimo && diasEntre(hoje, ultimo.shown_on) < minimo) continue;

    const { error } = await supabase
      .from("guardian_appearances")
      .insert({ user_id: userId, guardiao: g, shown_on: hoje });
    if (error) return null; // conflito: já registrado em outra aba
    return g;
  }
  return null;
}

/** Avalia os gatilhos do dia a partir dos dados que o app já guarda. */
export async function avaliarGatilhos(): Promise<GuardiaoAnim[]> {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) return [];
  const hoje = todayISO();
  const gatilhos: GuardiaoAnim[] = [];

  const { data: blocos = [] } = await supabase
    .from("time_blocks")
    .select("block_kind,completed")
    .eq("user_id", userId)
    .eq("date", hoje);

  const tarefas = (blocos ?? []).filter((b) => b.block_kind !== "pausa");
  const pausas = (blocos ?? []).filter((b) => b.block_kind === "pausa");
  if (tarefas.length > 0 && tarefas.every((b) => b.completed)) gatilhos.push("check");
  if (pausas.length > 0 && pausas.every((b) => b.completed)) gatilhos.push("nuvem");

  // Sol: cinco manhãs seguidas com intenção escrita.
  const cincoDias = Array.from({ length: 5 }, (_, i) => toISODate(addDays(new Date(), -i)));
  const { data: planos = [] } = await supabase
    .from("daily_plans")
    .select("date,intention")
    .eq("user_id", userId)
    .gte("date", cincoDias[4])
    .lte("date", hoje);
  const comIntencao = new Set(
    (planos ?? []).filter((p) => (p.intention ?? "").trim()).map((p) => p.date),
  );
  if (cincoDias.every((d) => comIntencao.has(d))) gatilhos.push("sol");

  // Montanha: meta do mês concluída hoje.
  const { data: metas = [] } = await supabase
    .from("goals")
    .select("status,updated_at")
    .eq("user_id", userId)
    .eq("status", "concluida");
  if ((metas ?? []).some((m) => (m.updated_at ?? "").slice(0, 10) === hoje)) {
    gatilhos.push("montanha");
  }

  // Folha: quatro semanas seguidas honrando o orçamento.
  const inicio28 = toISODate(addDays(new Date(), -27));
  const { data: checkins = [] } = await supabase
    .from("daily_checkins")
    .select("date,honored_budget")
    .eq("user_id", userId)
    .gte("date", inicio28)
    .lte("date", hoje);
  const honrouSemana = [0, 1, 2, 3].every((s) => {
    const fim = Date.parse(hoje) - s * 7 * 86_400_000;
    const ini = fim - 6 * 86_400_000;
    return (checkins ?? []).some(
      (c) => c.honored_budget && Date.parse(c.date) >= ini && Date.parse(c.date) <= fim,
    );
  });
  if (honrouSemana) gatilhos.push("folha");

  return gatilhos;
}

/** Estado do overlay: dispara, guarda quem está em cena e fecha. */
export function useGuardiaoAnim() {
  const [atual, setAtual] = useState<GuardiaoAnim | null>(null);
  const ocupado = useRef(false);

  const disparar = useCallback(async (candidatos: GuardiaoAnim[]) => {
    if (ocupado.current || !candidatos.length) return;
    ocupado.current = true;
    try {
      const escolhido = await escolherGuardiao(candidatos);
      if (escolhido) setAtual(escolhido);
    } catch {
      // Aparição é enfeite: nunca deve quebrar a tela.
    } finally {
      ocupado.current = false;
    }
  }, []);

  const dispararDoDia = useCallback(async () => {
    try {
      disparar(await avaliarGatilhos());
    } catch {
      /* silencioso */
    }
  }, [disparar]);

  const fechar = useCallback(() => setAtual(null), []);

  return { atual, disparar, dispararDoDia, fechar };
}
