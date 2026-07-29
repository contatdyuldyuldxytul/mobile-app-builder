import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useDomains, useHabitLogs, useHabits, useSaveMutation } from "@/lib/data";
import { addDays, toISODate, WEEKDAYS } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/habitos")({
  head: () => ({
    meta: [
      { title: "Hábitos — Redima" },
      { name: "description", content: "Hábitos recorrentes, sequências e histórico dos 30 dias." },
      { property: "og:title", content: "Hábitos — Redima" },
      { property: "og:description", content: "Consistência visível, sem gamificação ansiosa." },
    ],
  }),
  component: Habitos,
});

function Habitos() {
  const hoje = new Date();
  const de = toISODate(addDays(hoje, -29));
  const ate = toISODate(hoje);
  const { data: habits = [] } = useHabits();
  const { data: logs = [] } = useHabitLogs(de, ate);
  const { data: domains = [] } = useDomains();

  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<"fazer" | "evitar">("fazer");
  const [dominio, setDominio] = useState("");
  const [dias, setDias] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);

  const criar = useSaveMutation<void>(async (_v, userId) => {
    const { error } = await supabase.from("habits").insert({
      user_id: userId,
      name: nome,
      type: tipo,
      domain_id: dominio || null,
      frequency: dias.sort((a, b) => a - b),
    });
    if (error) throw error;
  }, ["habits"]);

  const remover = useSaveMutation<string>(async (id) => {
    const { error } = await supabase.from("habits").update({ is_archived: true }).eq("id", id);
    if (error) throw error;
  }, ["habits"]);

  const alternar = useSaveMutation<{ habitId: string; date: string; completed: boolean }>(
    async ({ habitId, date, completed }, userId) => {
      const { error } = await supabase
        .from("habit_logs")
        .upsert({ user_id: userId, habit_id: habitId, date, completed }, { onConflict: "habit_id,date" });
      if (error) throw error;
    },
    ["habit-logs"],
  );

  function streak(habitId: string) {
    let count = 0;
    for (let i = 0; i < 60; i++) {
      const d = toISODate(addDays(hoje, -i));
      const log = logs.find((l) => l.habit_id === habitId && l.date === d);
      if (log?.completed) count++;
      else if (i > 0) break;
    }
    return count;
  }

  const ultimos = Array.from({ length: 14 }, (_, i) => toISODate(addDays(hoje, -13 + i)));

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-4xl">Hábitos</h1>
        <p className="text-sm text-muted-foreground">Consistência, não perfeição.</p>
      </header>

      <section className="space-y-4 rounded-2xl border bg-card p-5">
        <h2 className="text-xl">Novo hábito</h2>
        <div className="space-y-2">
          <Label htmlFor="n">Nome</Label>
          <Input id="n" value={nome} onChange={(e) => setNome(e.target.value)} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as typeof tipo)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fazer">Fazer</SelectItem>
                <SelectItem value="evitar">Evitar</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Área da vida</Label>
            <Select value={dominio} onValueChange={setDominio}>
              <SelectTrigger>
                <SelectValue placeholder="Escolher" />
              </SelectTrigger>
              <SelectContent>
                {domains.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-2">
          <Label>Dias da semana</Label>
          <div className="flex flex-wrap gap-2">
            {WEEKDAYS.map((w, i) => (
              <button
                key={w}
                type="button"
                onClick={() =>
                  setDias(dias.includes(i) ? dias.filter((d) => d !== i) : [...dias, i])
                }
                className={`rounded-full border px-3 py-1 text-xs ${
                  dias.includes(i) ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                }`}
              >
                {w}
              </button>
            ))}
          </div>
        </div>
        <Button
          disabled={!nome.trim() || criar.isPending}
          onClick={() =>
            criar.mutate(undefined, {
              onSuccess: () => {
                setNome("");
                toast.success("Hábito criado.");
              },
              onError: () => toast.error("Não foi possível criar o hábito."),
            })
          }
        >
          Adicionar hábito
        </Button>
      </section>

      <section className="space-y-3">
        {habits.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhum hábito ainda.</p>
        )}
        {habits.map((h) => (
          <article key={h.id} className="rounded-2xl border bg-card p-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg">{h.name}</h3>
                <p className="text-xs text-muted-foreground">
                  {h.type === "fazer" ? "Fazer" : "Evitar"} · sequência de {streak(h.id)} dia(s)
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => remover.mutate(h.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <div className="mt-3 flex gap-1">
              {ultimos.map((d) => {
                const feito = logs.some((l) => l.habit_id === h.id && l.date === d && l.completed);
                return (
                  <button
                    key={d}
                    type="button"
                    title={d}
                    onClick={() => alternar.mutate({ habitId: h.id, date: d, completed: !feito })}
                    className={`h-6 flex-1 rounded ${feito ? "bg-primary" : "bg-muted"}`}
                  />
                );
              })}
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}