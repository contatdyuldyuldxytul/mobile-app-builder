import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useBlocksRange, useDomains, useSaveMutation, useTimeBudgets, useWeeklyPlan } from "@/lib/data";
import { addDays, formatLongDate, hoursBetween, toISODate, weekStart } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { ChevronLeft, ChevronRight, TriangleAlert } from "lucide-react";

export const Route = createFileRoute("/_authenticated/semanal")({
  head: () => ({
    meta: [
      { title: "Orçamento semanal — Redima" },
      { name: "description", content: "Aloque horas por área da vida e veja quanto ainda resta." },
      { property: "og:title", content: "Orçamento semanal — Redima" },
      { property: "og:description", content: "Horas por área da vida, sem overcommit." },
    ],
  }),
  component: Semanal,
});

const HORAS_ACORDADO_SEMANA = 112; // 16h por dia

function Semanal() {
  const [inicio, setInicio] = useState(() => weekStart());
  const { data: plano } = useWeeklyPlan(inicio);
  const { data: budgets = [] } = useTimeBudgets(plano?.id);
  const { data: domains = [] } = useDomains();
  const fimISO = toISODate(addDays(inicio, 6));
  const { data: blocos = [] } = useBlocksRange(toISODate(inicio), fimISO);
  const [valores, setValores] = useState<Record<string, string>>({});

  useEffect(() => {
    const next: Record<string, string> = {};
    domains.forEach((d) => {
      const b = budgets.find((x) => x.domain_id === d.id);
      next[d.id] = b ? String(Number(b.planned_hours)) : "";
    });
    setValores(next);
  }, [budgets, domains]);

  const realizadoPorDominio = useMemo(() => {
    const map: Record<string, number> = {};
    blocos.forEach((b) => {
      if (!b.domain_id || !b.completed) return;
      map[b.domain_id] = (map[b.domain_id] ?? 0) + hoursBetween(b.start_time, b.end_time);
    });
    return map;
  }, [blocos]);

  const total = Object.values(valores).reduce((s, v) => s + (Number(v) || 0), 0);
  const livre = HORAS_ACORDADO_SEMANA - total;
  const overcommit = livre < 0;

  const salvar = useSaveMutation<void>(async (_v, userId) => {
    if (!plano) throw new Error("Sem plano");
    const linhas = domains
      .filter((d) => Number(valores[d.id]) > 0)
      .map((d) => ({
        user_id: userId,
        weekly_plan_id: plano.id,
        domain_id: d.id,
        planned_hours: Number(valores[d.id]),
        actual_hours: realizadoPorDominio[d.id] ?? 0,
      }));
    const { error } = await supabase
      .from("time_budgets")
      .upsert(linhas, { onConflict: "weekly_plan_id,domain_id" });
    if (error) throw error;
  }, ["budgets"]);

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl">Semana</h1>
          <p className="text-sm text-muted-foreground">
            {formatLongDate(toISODate(inicio))} — {formatLongDate(fimISO)}
          </p>
        </div>
        <div className="flex gap-1">
          <Button variant="outline" size="icon" onClick={() => setInicio(addDays(inicio, -7))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => setInicio(addDays(inicio, 7))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <section
        className={`rounded-2xl border p-5 ${overcommit ? "border-destructive/50 bg-destructive/5" : "bg-card"}`}
      >
        <div className="flex items-baseline justify-between">
          <h2 className="text-xl">{total.toFixed(1)}h comprometidas</h2>
          <span className="text-sm text-muted-foreground">
            de {HORAS_ACORDADO_SEMANA}h acordadas
          </span>
        </div>
        <Progress className="mt-3" value={Math.min(100, (total / HORAS_ACORDADO_SEMANA) * 100)} />
        {overcommit ? (
          <p className="mt-3 flex items-center gap-2 text-sm text-destructive">
            <TriangleAlert className="h-4 w-4" />
            Você está prometendo {Math.abs(livre).toFixed(1)}h a mais do que existem. Que o seu sim
            seja sim.
          </p>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">{livre.toFixed(1)}h ainda livres.</p>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-xl">Horas por área da vida</h2>
        {domains.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Crie suas áreas da vida em Ajustes para começar a orçar.
          </p>
        )}
        {domains.map((d) => {
          const realizado = realizadoPorDominio[d.id] ?? 0;
          const planejado = Number(valores[d.id]) || 0;
          return (
            <div key={d.id} className="rounded-2xl border bg-card p-4">
              <div className="flex items-center gap-3">
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: d.color }} />
                <span className="flex-1">{d.name}</span>
                <Input
                  type="number"
                  min={0}
                  step={0.5}
                  className="w-24"
                  value={valores[d.id] ?? ""}
                  onChange={(e) => setValores({ ...valores, [d.id]: e.target.value })}
                />
                <span className="text-sm text-muted-foreground">h</span>
              </div>
              <Progress
                className="mt-3"
                value={planejado ? Math.min(100, (realizado / planejado) * 100) : 0}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                realizado: {realizado.toFixed(1)}h
              </p>
            </div>
          );
        })}
        <Button
          disabled={!plano || salvar.isPending}
          onClick={() =>
            salvar.mutate(undefined, {
              onSuccess: () => toast.success("Orçamento salvo."),
              onError: () => toast.error("Não foi possível salvar."),
            })
          }
        >
          Salvar orçamento
        </Button>
      </section>
    </div>
  );
}