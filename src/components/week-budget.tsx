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
import { capacidadeAcordadaPorDia, rebuildIdealWeek } from "@/lib/cascade";
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
type Area = { id: string; name: string; is_anchor?: boolean | null };

const TODOS_OS_DIAS = [0, 1, 2, 3, 4, 5, 6];
const ROTULO_CURTO = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

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
  console.log("DBG render");
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

  /** Horas comprometidas em cada dia da semana (0 = segunda). */
  function usoPorDia(mapa: Record<string, Estado>, lista: Area[]) {
    const uso = Array.from({ length: 7 }, () => 0);
    for (const d of lista) {
      if (ehSono(d.name) || ehAutomatica(d.name)) continue;
      const e = mapa[d.id];
      if (!e?.horasDia) continue;
      for (const dia of e.dias) if (dia >= 0 && dia <= 6) uso[dia] += e.horasDia;
    }
    return uso;
  }

  /**
   * O app é responsável por caber no dia: reduz proporcionalmente as áreas
   * flexíveis até que nenhum dia passe do teto. `protegido` é a área que a
   * pessoa acabou de mexer — ela é a última a ceder.
   */
  function encaixarNoTeto(
    mapa: Record<string, Estado>,
    lista: Area[],
    cap: number,
    protegido?: string,
  ) {
    const proximo = { ...mapa };
    for (let volta = 0; volta < 12; volta++) {
      const estouro = usoPorDia(proximo, lista)
        .map((h, i) => ({ i, excesso: h - cap }))
        .filter((x) => x.excesso > 0.01);
      if (!estouro.length) break;

      for (const { i, excesso } of estouro) {
        const doadoras = lista.filter(
          (d) =>
            d.id !== protegido &&
            !d.is_anchor &&
            !ehSono(d.name) &&
            !ehAutomatica(d.name) &&
            (proximo[d.id]?.horasDia ?? 0) > 0 &&
            proximo[d.id]?.dias.includes(i),
        );
        const disponivel = doadoras.reduce((s, d) => s + proximo[d.id].horasDia, 0);
        if (disponivel <= 0.01) {
          if (!protegido) break;
          const restante = Math.max(0, (proximo[protegido]?.horasDia ?? 0) - excesso);
          proximo[protegido] = { ...proximo[protegido], horasDia: Number(restante.toFixed(2)) };
          continue;
        }
        for (const d of doadoras) {
          const e = proximo[d.id];
          const tirar = (e.horasDia / disponivel) * Math.min(excesso, disponivel);
          proximo[d.id] = { ...e, horasDia: Number(Math.max(0, e.horasDia - tirar).toFixed(2)) };
        }
      }
    }
    return proximo;
  }

  useEffect(() => {
    const next: Record<string, Estado> = {};
    domains.forEach((d) => {
      const dias = ehSono(d.name) ? TODOS_OS_DIAS : (d.preferred_days ?? TODOS_OS_DIAS).map(Number);
      const b = budgets.find((x) => x.domain_id === d.id);
      const semana = b ? Number(b.planned_hours) : Number(d.default_weekly_hours) || 0;
      const porDia = semana > 0 ? Number((semana / (dias.length || 1)).toFixed(2)) : 0;
      next[d.id] = { horasDia: porDia, dias };
    });
    // O que veio salvo pode não caber no dia: o app acomoda antes de mostrar.
    const sonoSalvo = domains.find((d) => ehSono(d.name));
    const capInicial = capacidadeAcordadaPorDia(
      (sonoSalvo && next[sonoSalvo.id]?.horasDia) || Number(settings?.sleep_hours_per_day ?? 7.5),
      pausaMin,
    );
    const ajustado = encaixarNoTeto(next, domains, capInicial);
    console.log("DBG cap", capInicial, JSON.stringify(domains.map((d) => [d.name, d.is_anchor, next[d.id]?.horasDia, ajustado[d.id]?.horasDia])));
    setEstado((atual) => {
      const iguais =
        Object.keys(ajustado).length === Object.keys(atual).length &&
        Object.keys(ajustado).every(
          (k) =>
            atual[k]?.horasDia === ajustado[k].horasDia &&
            mesmoConjunto(atual[k]?.dias ?? [], ajustado[k].dias),
        );
      return iguais ? atual : ajustado;
    });
  }, [budgets, domains, pausaMin, settings?.sleep_hours_per_day]);

  const realizado = useMemo(() => {
    const map: Record<string, number> = {};
    blocos.forEach((b) => {
      if (!b.domain_id || !b.completed) return;
      map[b.domain_id] = (map[b.domain_id] ?? 0) + hoursBetween(b.start_time, b.end_time);
    });
    return map;
  }, [blocos]);

  const semanaDe = (e: Estado | undefined) => (e?.horasDia || 0) * (e?.dias.length || 0);

  const editaveis = useMemo(() => domains.filter((d) => !ehAutomatica(d.name)), [domains]);

  /** Sono é âncora: define quanto do dia sobra acordado. */
  const sonoDia = useMemo(() => {
    const d = domains.find((x) => ehSono(x.name));
    const e = d ? estado[d.id] : undefined;
    return e?.horasDia || Number(settings?.sleep_hours_per_day ?? 7.5);
  }, [domains, estado, settings]);

  /** Teto real: o que sobra do dia depois de sono, refeições e pausas. */
  const capacidade = useMemo(
    () => capacidadeAcordadaPorDia(sonoDia, pausaMin),
    [sonoDia, pausaMin],
  );

  const uso = useMemo(() => usoPorDia(estado, editaveis), [estado, editaveis]);
  const piorDia = Math.max(0, ...uso);
  const diasEstourados = uso
    .map((h, i) => (h > capacidade + 0.01 ? i : -1))
    .filter((i) => i >= 0);
  const livreNoPiorDia = Math.max(0, capacidade - piorDia);
  const totalSemana = editaveis.reduce((s, d) => s + semanaDe(estado[d.id]), 0);
  const horasAutomaticas = MINUTOS_REFEICOES_DIA / 60 + (pausaMin / 60) * 5;

  function set(id: string, patch: Partial<Estado>) {
    setEstado((v) => ({ ...v, [id]: { ...v[id], ...patch } }));
  }

  /**
   * Aumentar uma área tira das outras, dia a dia: o teto do dia nunca é
   * ultrapassado. O excedente é retirado, proporcionalmente, das áreas não
   * fixas que acontecem nos mesmos dias.
   */
  function definirHoras(id: string, horasDia: number) {
    setEstado((v) => {
      const atual = v[id] ?? { horasDia: 0, dias: TODOS_OS_DIAS };
      const alvo = domains.find((d) => d.id === id);
      const proximo = { ...v, [id]: { ...atual, horasDia } };
      // Sono muda a capacidade do dia; as demais áreas se ajustam a ela.
      const capAgora = ehSono(alvo?.name ?? "")
        ? capacidadeAcordadaPorDia(horasDia, pausaMin)
        : capacidade;
      return encaixarNoTeto(proximo, editaveis, capAgora, id);
    });
  }

  const salvar = useSaveMutation<void>(
    async (_v, userId) => {
      if (!plano) throw new Error("Sem plano da semana");
      if (diasEstourados.length) throw new Error("Há dias com mais horas do que o dia comporta.");

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
          <h2 className="text-xl">
            {fmtHoras(piorDia)} de {fmtHoras(capacidade)} do seu dia
          </h2>
          <span className="text-sm text-muted-foreground">no dia mais cheio</span>
        </div>
        <Progress
          className="mt-3"
          value={capacidade > 0 ? Math.min(100, (piorDia / capacidade) * 100) : 100}
        />
        <p className="mt-3 text-sm text-muted-foreground">
          Sobram {fmtHoras(livreNoPiorDia)} livres nesse dia · {fmtHoras(totalSemana)} na semana.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Sono, {fmtHoras(horasAutomaticas)} de alimentação e pausas já foram descontados do dia — o
          app posiciona sozinho.
        </p>
        {diasEstourados.length > 0 && (
          <p className="mt-3 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
            {diasEstourados.map((i) => ROTULO_CURTO[i]).join(", ")} passou do que o dia comporta.
            Reduza uma área antes de salvar.
          </p>
        )}
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
        // O máximo do slider é o próprio limite do dia mais apertado da área.
        const folgaNaArea = e.dias.length
          ? Math.max(0, Math.min(...e.dias.map((i) => capacidade - (uso[i] ?? 0))))
          : Math.max(0, capacidade - piorDia);
        const teto = sono
          ? 12
          : Math.min(16, Math.max(0.25, e.horasDia + folgaNaArea));
        const estouraNestesDias = e.dias.filter((i) => (uso[i] ?? 0) > capacidade + 0.01);
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
                <DayPickerWeek
                  value={e.dias}
                  alerta={estouraNestesDias}
                  onChange={(dias) => set(d.id, { dias })}
                />
                {estouraNestesDias.length > 0 && (
                  <p className="text-xs text-destructive">
                    Em {estouraNestesDias.map((i) => ROTULO_CURTO[i]).join(", ")} o dia já está
                    cheio.
                  </p>
                )}
              </>
            )}
          </article>
        );
      })}

      {domains.length > 0 && (
        <Button
          disabled={!plano || salvar.isPending || diasEstourados.length > 0}
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
