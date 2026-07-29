import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  useBlocksRange,
  useCheckin,
  useDomains,
  useSaveMutation,
  useTimeBudgets,
  useWeeklyPlan,
} from "@/lib/data";
import { addDays, formatLongDate, hoursBetween, toISODate, todayISO, weekStart } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/_authenticated/revisao")({
  head: () => ({
    meta: [
      { title: "Check-in e revisão — Redima" },
      { name: "description", content: "Feche o dia com uma reflexão gentil e revise a semana." },
      { property: "og:title", content: "Check-in e revisão — Redima" },
      { property: "og:description", content: "Planejado x realizado, sem culpa." },
    ],
  }),
  component: Revisao,
});

function Escala({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (n: number) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={`h-10 flex-1 rounded-xl border text-sm ${
              value === n ? "bg-primary text-primary-foreground" : "text-muted-foreground"
            }`}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

function Revisao() {
  const hoje = todayISO();
  const { data: checkin } = useCheckin(hoje);
  const inicio = weekStart();
  const { data: plano } = useWeeklyPlan(inicio);
  const { data: budgets = [] } = useTimeBudgets(plano?.id);
  const { data: domains = [] } = useDomains();
  const { data: blocos = [] } = useBlocksRange(toISODate(inicio), toISODate(addDays(inicio, 6)));

  const [honrou, setHonrou] = useState<boolean | null>(null);
  const [reflexao, setReflexao] = useState("");
  const [humor, setHumor] = useState<number | null>(null);
  const [energia, setEnergia] = useState<number | null>(null);

  useEffect(() => {
    setHonrou(checkin?.honored_budget ?? null);
    setReflexao(checkin?.reflection ?? "");
    setHumor(checkin?.mood ?? null);
    setEnergia(checkin?.energy ?? null);
  }, [checkin]);

  const salvar = useSaveMutation<void>(async (_v, userId) => {
    const { error } = await supabase.from("daily_checkins").upsert(
      {
        user_id: userId,
        date: hoje,
        honored_budget: honrou,
        reflection: reflexao || null,
        mood: humor,
        energy: energia,
      },
      { onConflict: "user_id,date" },
    );
    if (error) throw error;
  }, ["checkin"]);

  const realizado: Record<string, number> = {};
  blocos.forEach((b) => {
    if (!b.domain_id || !b.completed) return;
    realizado[b.domain_id] = (realizado[b.domain_id] ?? 0) + hoursBetween(b.start_time, b.end_time);
  });

  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-4xl">Check-in</h1>
        <p className="text-sm text-muted-foreground">{formatLongDate(hoje)} · leva 30 segundos</p>
      </header>

      <section className="space-y-5 rounded-2xl border bg-card p-5">
        <div className="space-y-2">
          <Label>Você honrou o que combinou consigo hoje?</Label>
          <div className="flex gap-2">
            {[
              { v: true, l: "Sim" },
              { v: false, l: "Nem tanto" },
            ].map((o) => (
              <button
                key={o.l}
                type="button"
                onClick={() => setHonrou(o.v)}
                className={`flex-1 rounded-xl border px-4 py-2 text-sm ${
                  honrou === o.v ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                }`}
              >
                {o.l}
              </button>
            ))}
          </div>
        </div>

        <Escala label="Humor" value={humor} onChange={setHumor} />
        <Escala label="Energia" value={energia} onChange={setEnergia} />

        <div className="space-y-2">
          <Label htmlFor="r">Uma frase sobre o dia</Label>
          <Textarea
            id="r"
            rows={3}
            value={reflexao}
            placeholder="Sem julgamento. Só o que você notou."
            onChange={(e) => setReflexao(e.target.value)}
          />
        </div>

        <Button
          disabled={salvar.isPending}
          onClick={() =>
            salvar.mutate(undefined, {
              onSuccess: () => toast.success("Dia fechado. Descanse."),
              onError: () => toast.error("Não foi possível salvar."),
            })
          }
        >
          Salvar check-in
        </Button>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl">Revisão da semana</h2>
        {budgets.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Sem orçamento nesta semana para comparar ainda.
          </p>
        )}
        {budgets.map((b) => {
          const dom = domains.find((d) => d.id === b.domain_id);
          const feito = realizado[b.domain_id] ?? 0;
          const planejado = Number(b.planned_hours);
          return (
            <div key={b.id} className="rounded-2xl border bg-card p-4">
              <div className="flex justify-between text-sm">
                <span className="flex items-center gap-2">
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: dom?.color ?? "var(--border)" }}
                  />
                  {dom?.name ?? "—"}
                </span>
                <span className="text-muted-foreground">
                  {feito.toFixed(1)}h realizadas · {planejado.toFixed(1)}h planejadas
                </span>
              </div>
              <Progress
                className="mt-2"
                value={planejado ? Math.min(100, (feito / planejado) * 100) : 0}
              />
            </div>
          );
        })}
      </section>
    </div>
  );
}