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
import { addDays, hoursBetween, toISODate } from "@/lib/dates";
import { WEEK_HOURS, rebuildIdealWeek } from "@/lib/cascade";
import { ROTULO_DIAS, mesmoConjunto } from "@/lib/presets";
import { MINUTOS_REFEICOES_DIA, REFEICOES_HORARIOS } from "@/lib/ideal-week";
import { Button } from "@/components/ui/button";
import { HoursSlider, fmtHoras } from "@/components/ui/hours-slider";
import { DayPickerWeek } from "@/components/ui/day-picker-week";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

type Estado = { horasDia: number; dias: number[] };

const TODOS_OS_DIAS = [0, 1, 2, 3, 4, 5, 6];

/** Áreas que o app cuida sozinho — a pessoa não escolhe horas nem dias. */
const ehSono = (n: string) => /dorm|sono/i.test(n);
const ehAlimentacao = (n: string) => /aliment|refei/i.test(n);
const ehPausa = (n: string) => /pausa|descanso curto/i.test(n);
const ehAutomatica = (n: string) => ehAlimentacao(n) || ehPausa(n);

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
  const [refeicoes, setRefeicoes] = useState(REFEICOES_HORARIOS);
  const [pausaMin, setPausaMin] = useState(15);

  useEffect(() => {
    if (!settings) return;
    setRefeicoes({
      cafe: (settings.breakfast_time ?? REFEICOES_HORARIOS.cafe).slice(0, 5),
      almoco: (settings.lunch_time ?? REFEICOES_HORARIOS.almoco).slice(0, 5),
      lanche: (settings.snack_time ?? REFEICOES_HORARIOS.lanche).slice(0, 5),
      jantar: (settings.dinner_time ?? REFEICOES_HORARIOS.jantar).slice(0, 5),
    });
    setPausaMin(Math.min(30, Math.max(15, Number(settings.break_duration_minutes ?? 15))));
  }, [settings]);

  useEffect(() => {
    const next: Record<string, Estado> = {};
    domains.forEach((d) => {
      const dias = ehSono(d.name)
        ? TODOS_OS_DIAS
        : (d.preferred_days ?? TODOS_OS_DIAS).map(Number);
      const b = budgets.find((x) => x.domain_id === d.id);
      const semana = b ? Number(b.planned_hours) : Number(d.default_weekly_hours) || 0;
      const porDia = semana > 0 ? Number((semana / (dias.length || 1)).toFixed(2)) : 0;
      next[d.id] = { horasDia: porDia, dias };
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

  const semanaDe = (e: Estado | undefined) => (e?.horasDia || 0) * (e?.dias.length || 0);

  /** As áreas automáticas ocupam tempo, mas não são editáveis. */
  const horasAutomaticas = useMemo(() => {
    const refeicoesSemana = (MINUTOS_REFEICOES_DIA / 60) * 7;
    const pausasSemana = (pausaMin / 60) * 5 * 7; // ~5 ciclos de foco por dia
    return refeicoesSemana + pausasSemana;
  }, [pausaMin]);

  const editaveis = useMemo(
    () => domains.filter((d) => !ehAutomatica(d.name)),
    [domains],
  );

  const total =
    editaveis.reduce((s, d) => s + semanaDe(estado[d.id]), 0) + horasAutomaticas;
  const livre = WEEK_HOURS - total;

  function set(id: string, patch: Partial<Estado>) {
    setEstado((v) => ({ ...v, [id]: { ...v[id], ...patch } }));
  }

  /**
   * Aumentar uma área tira das outras: o teto nunca é ultrapassado. O que não
   * cabe no espaço livre é retirado, proporcionalmente, das áreas não fixas.
   */
  function definirHoras(id: string, horasDia: number) {
    setEstado((v) => {
      const atual = v[id] ?? { horasDia: 0, dias: TODOS_OS_DIAS };
      const proximo = { ...v, [id]: { ...atual, horasDia } };
      const dif = (horasDia - atual.horasDia) * (atual.dias.length || 0);
      if (dif <= 0) return proximo;

      let faltando = dif - livre;
      if (faltando <= 0.001) return proximo;

      const doadoras = editaveis.filter(
        (d) => d.id !== id && !d.is_anchor && semanaDe(proximo[d.id]) > 0,
      );
      const disponivel = doadoras.reduce((s, d) => s + semanaDe(proximo[d.id]), 0);
      if (disponivel <= 0) return v; // nada a tirar: mantém como estava

      for (const d of doadoras) {
        const e = proximo[d.id];
        const semana = semanaDe(e);
        const tirar = Math.min(semana, (semana / disponivel) * faltando);
        const novoDia = Math.max(0, (semana - tirar) / (e.dias.length || 1));
        proximo[d.id] = { ...e, horasDia: Number(novoDia.toFixed(2)) };
        faltando -= tirar;
      }
      return proximo;
    });
  }

  const salvar = useSaveMutation<void>(
    async (_v, userId) => {
      if (!plano) throw new Error("Sem plano da semana");

      await supabase
        .from("settings")
        .update({
          breakfast_time: refeicoes.cafe,
          lunch_time: refeicoes.almoco,
          snack_time: refeicoes.lanche,
          dinner_time: refeicoes.jantar,
          break_duration_minutes: pausaMin,
        })
        .eq("user_id", userId);

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

      // A Semana Ideal é a fonte do dia: refaz a grade com as novas horas.
      await rebuildIdealWeek(userId);
    },
    ["budgets", "domains", "ideal-week", "blocks", "blocks-range", "settings"],
  );

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border bg-card p-5">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="text-xl">{fmtHoras(total / 7)} distribuídas por dia</h2>
          <span className="text-sm text-muted-foreground">em média</span>
        </div>
        <Progress className="mt-3" value={Math.min(100, (total / WEEK_HOURS) * 100)} />
        <p className="mt-3 text-sm text-muted-foreground">
          Sobram {fmtHoras(Math.max(0, livre) / 7)} por dia ainda não comprometidas.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Alimentação e pausas já entram na conta — o app posiciona sozinho.
        </p>
      </div>

      <article className="space-y-4 rounded-2xl border bg-card p-4">
        <div>
          <h3 className="text-base">Alimentação</h3>
          <p className="text-sm text-muted-foreground">
            Só diga os horários de sempre. A duração o app resolve.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {(
            [
              ["cafe", "Café da manhã"],
              ["almoco", "Almoço"],
              ["lanche", "Lanche da tarde"],
              ["jantar", "Jantar"],
            ] as const
          ).map(([chave, rotulo]) => (
            <div key={chave} className="space-y-1.5">
              <Label htmlFor={`ref-${chave}`} className="text-xs text-muted-foreground">
                {rotulo}
              </Label>
              <Input
                id={`ref-${chave}`}
                type="time"
                step={900}
                value={refeicoes[chave]}
                onChange={(ev) => setRefeicoes((r) => ({ ...r, [chave]: ev.target.value }))}
              />
            </div>
          ))}
        </div>
      </article>

      <article className="space-y-3 rounded-2xl border bg-card p-4">
        <div>
          <h3 className="text-base">Pausas</h3>
          <p className="text-sm text-muted-foreground">
            Uma pausa a cada 2h de foco. Você só escolhe o tamanho dela.
          </p>
        </div>
        <HoursSlider
          value={pausaMin / 60}
          onChange={(v) => setPausaMin(Math.round((v * 60) / 5) * 5)}
          step={5 / 60}
          min={15 / 60}
          max={30 / 60}
          suffix="por pausa"
          label="Duração de cada pausa"
        />
      </article>

      {domains.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Crie suas áreas da vida em Ajustes para começar.
        </p>
      )}

      {editaveis.map((d) => {
        const e = estado[d.id] ?? { horasDia: 0, dias: TODOS_OS_DIAS };
        const semana = semanaDe(e);
        const feito = realizado[d.id] ?? 0;
        const sono = ehSono(d.name);
        const teto = Math.min(
          sono ? 12 : 16,
          e.horasDia + Math.max(0, livre) / (e.dias.length || 7),
        );
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
            </div>

            <HoursSlider
              value={e.horasDia}
              onChange={(v) => definirHoras(d.id, v)}
              step={0.25}
              min={0}
              max={Math.max(e.horasDia, Number(teto.toFixed(2)), 0.25)}
              suffix={sono ? "por noite" : "por dia"}
              label={`Horas por dia em ${d.name}`}
            />

            <p className="text-xs text-muted-foreground">
              {sono
                ? "Todas as noites"
                : semana > 0
                  ? `${e.dias.length} dia(s) na semana`
                  : "Sem horas reservadas ainda"}
              {feito > 0 && ` · ${fmtHoras(feito)} já feitas`}
            </p>

            {!sono && (
              <>
                <div className="flex flex-wrap gap-2">
                  {ROTULO_DIAS.map((r) => (
                    <button
                      key={r.label}
                      type="button"
                      onClick={() => set(d.id, { dias: r.days })}
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs text-muted-foreground transition-colors",
                        mesmoConjunto(e.dias, r.days) &&
                          "border-primary bg-primary/10 text-foreground",
                      )}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
                <DayPickerWeek value={e.dias} onChange={(dias) => set(d.id, { dias })} />
              </>
            )}
          </article>
        );
      })}

      {domains.length > 0 && (
        <Button
          disabled={!plano || salvar.isPending}
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
