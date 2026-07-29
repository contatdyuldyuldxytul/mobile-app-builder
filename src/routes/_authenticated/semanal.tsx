import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  useBlocksRange,
  useDomains,
  useSaveMutation,
  useSettings,
  useTimeBudgets,
  useWeeklyPlan,
} from "@/lib/data";
import { addDays, formatLongDate, hoursBetween, toISODate, weekStart } from "@/lib/dates";
import { WEEK_HOURS } from "@/lib/cascade";
import { WeekTabs } from "@/components/week-tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

function Semanal() {
  const [inicio, setInicio] = useState(() => weekStart());
  const { data: plano } = useWeeklyPlan(inicio);
  const { data: budgets = [] } = useTimeBudgets(plano?.id);
  const { data: domains = [] } = useDomains();
  const { data: settings } = useSettings();
  const fimISO = toISODate(addDays(inicio, 6));
  const { data: blocos = [] } = useBlocksRange(toISODate(inicio), fimISO);
  const [valores, setValores] = useState<Record<string, string>>({});
  const [vista, setVista] = useState<"horas" | "pct">("horas");

  const inicioISO = toISODate(inicio);
  // O orçamento é um padrão que se repete: se a semana ainda está vazia,
  // pré-carregamos a alocação da semana anterior mais recente.
  const { data: anterior = [] } = useQuery({
    queryKey: ["budget-anterior", inicioISO],
    queryFn: async () => {
      const { data: planoAnt } = await supabase
        .from("weekly_plans")
        .select("id")
        .lt("week_start_date", inicioISO)
        .order("week_start_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!planoAnt) return [];
      const { data } = await supabase
        .from("time_budgets")
        .select("domain_id, planned_hours")
        .eq("weekly_plan_id", planoAnt.id);
      return data ?? [];
    },
  });

  useEffect(() => {
    const next: Record<string, string> = {};
    domains.forEach((d) => {
      const b = budgets.find((x) => x.domain_id === d.id);
      if (b) {
        next[d.id] = String(Number(b.planned_hours));
        return;
      }
      const ant = anterior.find((x) => x.domain_id === d.id);
      if (ant) {
        next[d.id] = String(Number(ant.planned_hours));
        return;
      }
      next[d.id] = d.is_anchor && Number(d.default_weekly_hours) > 0
        ? String(Number(d.default_weekly_hours))
        : "";
    });
    // Só atualiza quando o conteúdo muda de fato: os defaults `= []` criam
    // arrays novos a cada render e reiniciariam o efeito indefinidamente.
    setValores((atual) => {
      const iguais =
        Object.keys(next).length === Object.keys(atual).length &&
        Object.keys(next).every((k) => atual[k] === next[k]);
      return iguais ? atual : next;
    });
  }, [budgets, domains, anterior]);

  const realizadoPorDominio = useMemo(() => {
    const map: Record<string, number> = {};
    blocos.forEach((b) => {
      if (!b.domain_id || !b.completed) return;
      map[b.domain_id] = (map[b.domain_id] ?? 0) + hoursBetween(b.start_time, b.end_time);
    });
    return map;
  }, [blocos]);

  const total = Object.values(valores).reduce((s, v) => s + (Number(v) || 0), 0);
  const livre = WEEK_HOURS - total;
  const overcommit = livre < -0.001;

  function setHoras(id: string, h: number) {
    const arredondado = Math.max(0, Math.round(h * 2) / 2);
    setValores((v) => ({ ...v, [id]: arredondado ? String(arredondado) : "" }));
  }

  const salvar = useSaveMutation<void>(async (_v, userId) => {
    if (!plano) throw new Error("Sem plano");
    if (total > WEEK_HOURS) throw new Error("Acima de 168h");
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

      <WeekTabs />

      <section
        className={`rounded-2xl border p-5 ${overcommit ? "border-destructive/50 bg-destructive/5" : "bg-card"}`}
      >
        <div className="flex items-baseline justify-between">
          <h2 className="text-xl">{total.toFixed(1)}h alocadas</h2>
          <span className="text-sm text-muted-foreground">de {WEEK_HOURS}h na semana</span>
        </div>
        <Progress className="mt-3" value={Math.min(100, (total / WEEK_HOURS) * 100)} />
        {overcommit ? (
          <p className="mt-3 flex items-center gap-2 text-sm text-destructive">
            <TriangleAlert className="h-4 w-4" />
            Excedido: {Math.abs(livre).toFixed(1)}h. Tire horas de alguma área para poder salvar.
          </p>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            Não alocado: {livre.toFixed(1)}h.
          </p>
        )}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Âncoras: {Number(settings?.sleep_hours_per_day ?? 0)}h de sono/dia ·{" "}
            {Number(settings?.work_hours_per_day ?? 0)}h de trabalho/dia útil.{" "}
            <Link to="/ancoras" className="text-primary underline-offset-4 hover:underline">
              Ajustar âncoras
            </Link>
          </p>
          <Tabs value={vista} onValueChange={(v) => setVista(v as typeof vista)}>
            <TabsList>
              <TabsTrigger value="horas">Horas</TabsTrigger>
              <TabsTrigger value="pct">%</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
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
          const restanteParaEsta = livre + planejado; // teto interdependente
          return (
            <div key={d.id} className="rounded-2xl border bg-card p-4">
              <div className="flex items-center gap-3">
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: d.color }} />
                <span className="flex-1">
                  {d.name}
                  {d.is_anchor && (
                    <span className="ml-2 text-xs text-muted-foreground">âncora</span>
                  )}
                </span>
                {vista === "horas" ? (
                  <>
                    <Input
                      type="number"
                      min={0}
                      step={0.5}
                      className="w-24"
                      value={valores[d.id] ?? ""}
                      onChange={(e) => setHoras(d.id, Number(e.target.value))}
                    />
                    <span className="text-sm text-muted-foreground">h</span>
                  </>
                ) : (
                  <>
                    <Input
                      type="number"
                      min={0}
                      step={1}
                      className="w-24"
                      value={planejado ? ((planejado / WEEK_HOURS) * 100).toFixed(0) : ""}
                      onChange={(e) => setHoras(d.id, (Number(e.target.value) / 100) * WEEK_HOURS)}
                    />
                    <span className="text-sm text-muted-foreground">%</span>
                  </>
                )}
              </div>
              <Slider
                className="mt-4"
                value={[planejado]}
                max={WEEK_HOURS}
                step={0.5}
                onValueChange={([v]) => setHoras(d.id, Math.min(v, Math.max(0, restanteParaEsta)))}
              />
              <Progress
                className="mt-3"
                value={planejado ? Math.min(100, (realizado / planejado) * 100) : 0}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                realizado: {realizado.toFixed(1)}h · {((planejado / WEEK_HOURS) * 100).toFixed(0)}%
                da semana
              </p>
            </div>
          );
        })}
        <Button
          disabled={!plano || overcommit || salvar.isPending}
          onClick={() =>
            salvar.mutate(undefined, {
              onSuccess: () => toast.success("Orçamento salvo."),
              onError: () => toast.error("Não foi possível salvar."),
            })
          }
        >
          Salvar orçamento
        </Button>
        <p className="text-xs text-muted-foreground">
          Depois de orçar, posicione as horas na{" "}
          <Link to="/semana-ideal" className="text-primary underline-offset-4 hover:underline">
            semana ideal
          </Link>
          .
        </p>
      </section>
    </div>
  );
}