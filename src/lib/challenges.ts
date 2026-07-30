import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { todayISO } from "./dates";

export type Challenge = Tables<"challenges">;
export type ChallengeMember = Tables<"challenge_members">;
export type ChallengeScore = Tables<"challenge_scores">;

/** Código curto, fácil de ditar por mensagem. */
export function gerarCodigo() {
  const alfabeto = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(
    { length: 6 },
    () => alfabeto[Math.floor(Math.random() * alfabeto.length)],
  ).join("");
}

export function linkConvite(code: string) {
  if (typeof window === "undefined") return code;
  return `${window.location.origin}/desafios?codigo=${code}`;
}

export function periodoDe(c: Challenge) {
  const hoje = todayISO();
  if (hoje < c.start_date) return "em breve" as const;
  if (hoje > c.end_date) return "encerrado" as const;
  return "ativo" as const;
}

/** Desafios de que eu participo, com os participantes e o placar de cada um. */
export function useMyChallenges() {
  return useQuery({
    queryKey: ["challenges"],
    queryFn: async () => {
      const { data: membros, error } = await supabase
        .from("challenge_members")
        .select("challenge_id");
      if (error) throw error;
      const ids = (membros ?? []).map((m) => m.challenge_id);
      if (!ids.length) return [] as Challenge[];
      const { data, error: e2 } = await supabase
        .from("challenges")
        .select("*")
        .in("id", ids)
        .order("start_date", { ascending: false });
      if (e2) throw e2;
      return data ?? [];
    },
  });
}

export type LinhaPlacar = {
  userId: string;
  nome: string;
  media: number;
  dias: number;
};

export function useChallengeBoard(challengeId?: string, start?: string, end?: string) {
  return useQuery({
    enabled: !!challengeId,
    queryKey: ["challenge-board", challengeId],
    queryFn: async (): Promise<LinhaPlacar[]> => {
      const [{ data: membros, error }, { data: scores, error: e2 }] = await Promise.all([
        supabase
          .from("challenge_members")
          .select("user_id,display_name")
          .eq("challenge_id", challengeId!),
        supabase
          .from("challenge_scores")
          .select("user_id,date,pct")
          .eq("challenge_id", challengeId!)
          .gte("date", start ?? "1900-01-01")
          .lte("date", end ?? "2999-12-31"),
      ]);
      if (error) throw error;
      if (e2) throw e2;

      return (membros ?? [])
        .map((m) => {
          const meus = (scores ?? []).filter((s) => s.user_id === m.user_id);
          const soma = meus.reduce((s, x) => s + Number(x.pct), 0);
          return {
            userId: m.user_id,
            nome: m.display_name?.trim() || "Amigo",
            media: meus.length ? soma / meus.length : 0,
            dias: meus.length,
          };
        })
        .sort((a, b) => b.media - a.media || b.dias - a.dias);
    },
  });
}

/**
 * Guarda o percentual do dia em todos os desafios ativos de que participo.
 * Chamado quando um bloco é marcado no "Hoje".
 */
export async function registrarPlacarDoDia(
  userId: string,
  dateISO: string,
  pct: number,
  doneMinutes: number,
) {
  const { data: membros } = await supabase
    .from("challenge_members")
    .select("challenge_id")
    .eq("user_id", userId);
  const ids = (membros ?? []).map((m) => m.challenge_id);
  if (!ids.length) return;

  const { data: ativos } = await supabase
    .from("challenges")
    .select("id")
    .in("id", ids)
    .lte("start_date", dateISO)
    .gte("end_date", dateISO);
  if (!ativos?.length) return;

  await supabase.from("challenge_scores").upsert(
    ativos.map((c) => ({
      challenge_id: c.id,
      user_id: userId,
      date: dateISO,
      pct: Math.round(pct),
      done_minutes: doneMinutes,
      updated_at: new Date().toISOString(),
    })),
    { onConflict: "challenge_id,user_id,date" },
  );
}
