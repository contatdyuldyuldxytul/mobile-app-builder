import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { toISODate, weekStart } from "./dates";

export type Domain = Tables<"life_domains">;
export type Goal = Tables<"goals">;
export type TimeBlock = Tables<"time_blocks">;
export type Habit = Tables<"habits">;
export type Profile = Tables<"profiles">;
export type Task = Tables<"tasks">;

async function currentUserId() {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Sem sessão");
  return data.user.id;
}

export function useProfile() {
  return useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const uid = await currentUserId();
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", uid)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useSettings() {
  return useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const uid = await currentUserId();
      const { data, error } = await supabase
        .from("settings")
        .select("*")
        .eq("user_id", uid)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useDomains() {
  return useQuery({
    queryKey: ["domains"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("life_domains")
        .select("*")
        .eq("is_archived", false)
        .order("sort_order")
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useMonthlyPlan(year: number, month: number) {
  return useQuery({
    queryKey: ["monthly", year, month],
    queryFn: async () => {
      const uid = await currentUserId();
      const { data } = await supabase
        .from("monthly_plans")
        .select("*")
        .eq("year", year)
        .eq("month", month)
        .maybeSingle();
      if (data) return data;
      const { data: created, error } = await supabase
        .from("monthly_plans")
        .insert({ user_id: uid, year, month })
        .select()
        .single();
      if (error) throw error;
      return created;
    },
  });
}

export function useGoals(monthlyPlanId?: string) {
  return useQuery({
    enabled: !!monthlyPlanId,
    queryKey: ["goals", monthlyPlanId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("goals")
        .select("*")
        .eq("monthly_plan_id", monthlyPlanId!)
        .order("priority");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useWeeklyPlan(start: Date = weekStart()) {
  const iso = toISODate(start);
  return useQuery({
    queryKey: ["weekly", iso],
    queryFn: async () => {
      const uid = await currentUserId();
      const { data } = await supabase
        .from("weekly_plans")
        .select("*")
        .eq("week_start_date", iso)
        .maybeSingle();
      if (data) return data;
      const { data: created, error } = await supabase
        .from("weekly_plans")
        .insert({ user_id: uid, week_start_date: iso })
        .select()
        .single();
      if (error) throw error;
      return created;
    },
  });
}

export function useTimeBudgets(weeklyPlanId?: string) {
  return useQuery({
    enabled: !!weeklyPlanId,
    queryKey: ["budgets", weeklyPlanId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("time_budgets")
        .select("*")
        .eq("weekly_plan_id", weeklyPlanId!);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useTimeBlocks(dateISO: string) {
  return useQuery({
    queryKey: ["blocks", dateISO],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("time_blocks")
        .select("*")
        .eq("date", dateISO)
        .order("start_time");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useBlocksRange(fromISO: string, toISO_: string) {
  return useQuery({
    queryKey: ["blocks-range", fromISO, toISO_],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("time_blocks")
        .select("*")
        .gte("date", fromISO)
        .lte("date", toISO_)
        .order("date");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useDailyPlan(dateISO: string) {
  return useQuery({
    queryKey: ["daily-plan", dateISO],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("daily_plans")
        .select("*")
        .eq("date", dateISO)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useCheckin(dateISO: string) {
  return useQuery({
    queryKey: ["checkin", dateISO],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("daily_checkins")
        .select("*")
        .eq("date", dateISO)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useHabits() {
  return useQuery({
    queryKey: ["habits"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("habits")
        .select("*")
        .eq("is_archived", false)
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useIdealWeek() {
  return useQuery({
    queryKey: ["ideal-week"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ideal_week_blocks")
        .select("*")
        .order("day_of_week")
        .order("start_time");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useHabitLogs(fromISO: string, toISO_: string) {
  return useQuery({
    queryKey: ["habit-logs", fromISO, toISO_],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("habit_logs")
        .select("*")
        .gte("date", fromISO)
        .lte("date", toISO_);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useTasks(weeklyPlanId?: string) {
  return useQuery({
    enabled: !!weeklyPlanId,
    queryKey: ["tasks", weeklyPlanId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("weekly_plan_id", weeklyPlanId!)
        .order("sort_order")
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useAllGoals() {
  return useQuery({
    queryKey: ["goals-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("goals")
        .select("*")
        .neq("status", "concluida")
        .order("priority");
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Tarefas marcadas para um dia específico (independe do plano semanal). */
export function useTasksByDate(dateISO: string) {
  return useQuery({
    queryKey: ["tasks-day", dateISO],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("scheduled_date", dateISO)
        .order("sort_order")
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Check-ins num intervalo, para o resumo de produtividade. */
export function useCheckinsRange(fromISO: string, toISO_: string) {
  return useQuery({
    queryKey: ["checkins-range", fromISO, toISO_],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("daily_checkins")
        .select("*")
        .gte("date", fromISO)
        .lte("date", toISO_);
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Mutação genérica que injeta user_id e invalida as queries informadas. */
export function useSaveMutation<TVars>(
  fn: (vars: TVars, userId: string) => Promise<unknown>,
  invalidate: string[],
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: TVars) => fn(vars, await currentUserId()),
    onSuccess: () => {
      invalidate.forEach((key) => qc.invalidateQueries({ queryKey: [key] }));
    },
  });
}