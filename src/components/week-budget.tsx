import { useEffect, useMemo, useState } from "react";
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
import { WEEKDAYS, addDays, hoursBetween, toISODate } from "@/lib/dates";
import { WEEK_HOURS } from "@/lib/cascade";
import { ROTULO_DIAS, mesmoConjunto } from "@/lib/presets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { TriangleAlert } from "lucide-react";

type Estado = { horasDia: string; dias: number[] };

function fmtHoras(h: number) {
  const min = Math.round(h * 60);
  const hh = Math.floor(min / 60);
  const mm = min % 60;
  if (hh && mm) return `${hh}h${String(mm).padStart(2, "0")}`;
  if (hh) return `${hh}h`;
  return `${mm}min`;
}

/**
 * Seção A da semana: você diz quantas horas por DIA quer dar a cada área e em
 * quais dias — o app calcula o total da semana e cuida do teto de 168h.
 */
export function WeekBudget({ inicio }: { inicio: Date }) {
  const { data: plano } = useWeeklyPlan(inicio);
  const { data: budgets = [] } = useTimeBudgets(plano?.id);
  const { data: domains = [] } = useDomains();
  const { data: settings } = useSettings();
  const fimISO = toISODate(addDays(inicio, 6));
  const { data: blocos = [] } = useBlocksRange(toISODate(inicio), fimISO);

  const [estado, setEstado] = useState<Record<string, Estado>>({});

  useEffect(() => {
    const next: Record<string, Estado> = {};
    domains.forEach((d) => {
      const dias = (d.preferred_days ?? [0, 1, 2, 3, 4, 5, 6]).map(Number);
      const b = budgets.find((x) => x.domain_id === d.id);
      const semana = b ? Number(b.planned_hours) : Number(d.default_weekly_hours) || 0;
      const porDia = semana > 0 ? semana / (dias.length || 1) : 0;
      next[d.id] = { horasDia: porDia > 0 ? String(Number(porDia.toFixed(2))) : "", dias };
    });
    setEstado((atual) => {
      const iguais =
        Object.keys(next).length === Object.keys(atual).length &&
        Object.keys(next).every(
          (k) =>
            atual[k]?.horasDia === next[k].horasDia &&
            mesmoConjunto(atual[k]?.dias ?? [], next[k].dias),
        );
      return iguais ? atual : next;
    });
  }, [budgets, domains]);

  const realizado = useMemo(() => {
    const map: Record<string, number> = {};
    blocos.forEach((b) => {
      if (!b.domain_id || !b.completed) return;
      map[b.domain_id] = (map[b.domain_id] ?? 0) + hoursBetween(b.start_time, b.end_time);
    });
    return map;
  }, [blocos]);

  const semanaDe = (e: Estado | undefined) =>
    (Number(e?.horasDia) || 0) * (e?.dias.length || 0);

  const total = Object.values(estado).reduce((s, v) => s + semanaDe(v), 0);
  const livre = WEEK_HOURS - total;
  const excedeu = livre < -0.001;

  function set(id: string, patch: Partial<Estado>) {
    setEstado((v) => ({ ...v, [id]: { ...v[id], ...patch } }));
  }

  const salvar = useSaveMutation<void>(async (_v, userId) => {
    if (!plano) throw new Error("Sem plano da semana");
    if (excedeu) throw new Error("Você passou das 168h da semana");

    const linhas = domains
      .filter((d) => semanaDe(estado[d.id]) > 0)
      .map((d) => ({
        user_id: userId,
        weekly_plan_id: plano.id,
        domain_id: d.id,
        planned_hours: Number(semanaDe(estado[d.id]).toFixed(2)),
        actual_hours: realizado[d.id] ?? 0,
      }));
    if (linhas.length) {
      const { error } = await supabase
        .from("time_budgets")
        .upsert(linhas, { onConflict: "weekly_plan_id,domain_id" });
      if (error) throw error;
    }

    for (const d of domains) {
      const e = estado[d.id];
      if (!e) continue;
      await supabase
        .from("life_domains")
        .update({
          preferred_days: e.dias,
          default_weekly_hours: Number(semanaDe(e).toFixed(2)),
        })
        .eq("id", d.id);
    }
  }, ["budgets", "domains"]);

  return (
    <section className="space-y-4">
      <div
        className={cn(
          "rounded-2xl border p-5 transition-colors",
          excedeu ? "border-destructive/50 bg-destructive/5" : "bg-card",
        )}
      >
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="text-xl">{total.toFixed(1)}h distribuídas</h2>
          <span className="text-sm text-muted-foreground">de {WEEK_HOURS}h na semana</span>
        </div>
        <Progress className="mt-3" value={Math.min(100, (total / WEEK_HOURS) * 100)} />
        {excedeu ? (
          <p className="mt-3 flex items-center gap-2 text-sm text-destructive">
            <TriangleAlert className="h-4 w-4 shrink-0" />
            {Math.abs(livre).toFixed(1)}h a mais do que existe. Tire horas de alguma área.
          </p>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            Sobram {livre.toFixed(1)}h ainda não comprometidas.
          </p>
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          Fixos: {Number(settings?.sleep_hours_per_day ?? 0)}h de sono/dia ·{" "}
          {Number(settings?.work_hours_per_day ?? 0)}h de trabalho por dia útil.
        </p>
      </div>

      {domains.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Crie suas áreas da vida em Ajustes para começar.
        </p>
      )}

      {domains.map((d) => {
        const e = estado[d.id] ?? { horasDia: "", dias: [0, 1, 2, 3, 4, 5, 6] };
        const semana = semanaDe(e);
        const feito = realizado[d.id] ?? 0;
        return (
          <article key={d.id} className="space-y-3 rounded-2xl border bg-card p-4">
            <div className="flex items-center gap-3">
              <span
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: d.color }}
              />
              <span className="min-w-0 flex-1 truncate">
                {d.name}
                {d.is_anchor && <span className="ml-2 text-xs text-muted-foreground">fixo</span>}
              </span>
              <Input
                type="number"
                min={0}
                step={0.25}
                inputMode="decimal"
                className="w-20 shrink-0"
                value={e.horasDia}
                onChange={(ev) => set(d.id, { horasDia: ev.target.value })}
              />
              <span className="shrink-0 text-sm text-muted-foreground">h/dia</span>
            </div>

            <div className="rounded-xl bg-muted/50 px-3 py-2 text-sm">
              {semana > 0 ? (
                <>
                  <span className="font-mono">{fmtHoras(Number(e.horasDia) || 0)}</span> por dia ×{" "}
                  {e.dias.length} dia(s) ={" "}
                  <span className="font-mono text-foreground">{semana.toFixed(1)}h na semana</span>
                </>
              ) : (
                <span className="text-muted-foreground">Sem horas reservadas ainda</span>
              )}
              {feito > 0 && (
                <span className="text-muted-foreground"> · {feito.toFixed(1)}h já feitas</span>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {ROTULO_DIAS.map((r) => (
                <button
                  key={r.label}
                  type="button"
                  onClick={() => set(d.id, { dias: r.days })}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs text-muted-foreground transition-colors",
                    mesmoConjunto(e.dias, r.days) && "border-primary bg-primary/10 text-foreground",
                  )}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {WEEKDAYS.map((w, i) => (
                <button
                  key={w}
                  type="button"
                  onClick={() =>
                    set(d.id, {
                      dias: e.dias.includes(i)
                        ? e.dias.filter((x) => x !== i)
                        : [...e.dias, i].sort((a, b) => a - b),
                    })
                  }
                  className={cn(
                    "h-8 w-10 rounded-lg border text-xs text-muted-foreground transition-colors",
                    e.dias.includes(i) && "bg-primary text-primary-foreground",
                  )}
                >
                  {w}
                </button>
              ))}
            </div>
          </article>
        );
      })}

      {domains.length > 0 && (
        <Button
          disabled={!plano || excedeu || salvar.isPending}
          onClick={() =>
            salvar.mutate(undefined, {
              onSuccess: () => toast.success("Semana salva. O checklist de hoje já se ajustou."),
              onError: (er) =>
                toast.error(er instanceof Error ? er.message : "Não foi possível salvar."),
            })
          }
        >
          Salvar horas da semana
        </Button>
      )}
    </section>
  );
}
