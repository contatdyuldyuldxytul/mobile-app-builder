import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  useBlocksRange,
  useCheckin,
  useDomains,
  useSaveMutation,
  useSettings,
  useTasks,
  useTimeBudgets,
  useWeeklyPlan,
} from "@/lib/data";
import { addDays, hoursBetween, toISODate, todayISO, weekStart } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

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
            className={cn(
              "h-10 flex-1 rounded-xl border text-sm text-muted-foreground",
              value === n && "bg-primary text-primary-foreground",
            )}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Check-in gentil: aparece à noite (ou na primeira abertura do dia seguinte)
 * e, uma vez por semana, traz o resumo de planejado x realizado.
 */
export function CheckinDialog() {
  const hoje = todayISO();
  const inicioSemana = weekStart();
  const inicioISO = toISODate(inicioSemana);
  const fimISO = toISODate(addDays(inicioSemana, 6));

  const { data: settings } = useSettings();
  const { data: checkin } = useCheckin(hoje);
  const { data: plano } = useWeeklyPlan(inicioSemana);
  const { data: budgets = [] } = useTimeBudgets(plano?.id);
  const { data: tarefas = [] } = useTasks(plano?.id);
  const { data: domains = [] } = useDomains();
  const { data: blocos = [] } = useBlocksRange(inicioISO, fimISO);

  const [aberto, setAberto] = useState(false);
  const [semanal, setSemanal] = useState(false);
  const [honrou, setHonrou] = useState<boolean | null>(null);
  const [humor, setHumor] = useState<number | null>(null);
  const [energia, setEnergia] = useState<number | null>(null);
  const [reflexao, setReflexao] = useState("");

  useEffect(() => {
    if (!settings) return;
    const agora = new Date();
    const hora = agora.getHours();
    const diaSemana = (agora.getDay() + 6) % 7; // 0 = segunda

    const semanaPendente =
      (diaSemana === 6 && hora >= 18) || diaSemana === 0
        ? (settings.last_weekly_prompt_date ?? "") < inicioISO
        : false;
    const diaPendente = hora >= 20 && (settings.last_daily_prompt_date ?? "") < hoje;

    if (semanaPendente || diaPendente) {
      setSemanal(semanaPendente);
      setAberto(true);
    }
  }, [settings, hoje, inicioISO]);

  useEffect(() => {
    setHonrou(checkin?.honored_budget ?? null);
    setHumor(checkin?.mood ?? null);
    setEnergia(checkin?.energy ?? null);
    setReflexao(checkin?.reflection ?? "");
  }, [checkin]);

  const marcarVisto = useSaveMutation<void>(
    async (_v, userId) => {
      const patch = semanal
        ? { last_weekly_prompt_date: hoje, last_daily_prompt_date: hoje }
        : { last_daily_prompt_date: hoje };
      await supabase
        .from("settings")
        .upsert({ user_id: userId, ...patch }, { onConflict: "user_id" });
    },
    ["settings"],
  );

  const salvar = useSaveMutation<void>(
    async (_v, userId) => {
      const { error } = await supabase.from("daily_checkins").upsert(
        {
          user_id: userId,
          date: hoje,
          honored_budget: honrou,
          mood: humor,
          energy: energia,
          reflection: reflexao || null,
        },
        { onConflict: "user_id,date" },
      );
      if (error) throw error;
      const patch = semanal
        ? { last_weekly_prompt_date: hoje, last_daily_prompt_date: hoje }
        : { last_daily_prompt_date: hoje };
      await supabase
        .from("settings")
        .upsert({ user_id: userId, ...patch }, { onConflict: "user_id" });
    },
    ["checkin", "settings"],
  );

  function fechar(aberta: boolean) {
    setAberto(aberta);
    if (!aberta) marcarVisto.mutate();
  }

  const realizado: Record<string, number> = {};
  blocos.forEach((b) => {
    if (!b.domain_id || !b.completed) return;
    realizado[b.domain_id] = (realizado[b.domain_id] ?? 0) + hoursBetween(b.start_time, b.end_time);
  });
  const feitas = tarefas.filter((t) => t.status === "feita").length;
  const pctTarefas = tarefas.length ? Math.round((feitas / tarefas.length) * 100) : 0;

  return (
    <Dialog open={aberto} onOpenChange={fechar}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {semanal
              ? "Você honrou o que combinou consigo nesta semana?"
              : "Você honrou o que combinou consigo hoje?"}
          </DialogTitle>
          <DialogDescription>
            Sem cobrança. Leva 20 segundos e pode ser fechado a qualquer momento.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="flex gap-2">
            {[
              { v: true, l: "Sim" },
              { v: false, l: "Nem tanto" },
            ].map((o) => (
              <button
                key={o.l}
                type="button"
                onClick={() => setHonrou(o.v)}
                className={cn(
                  "flex-1 rounded-xl border px-4 py-2.5 text-sm text-muted-foreground",
                  honrou === o.v && "bg-primary text-primary-foreground",
                )}
              >
                {o.l}
              </button>
            ))}
          </div>

          <Escala label="Humor" value={humor} onChange={setHumor} />
          <Escala label="Energia" value={energia} onChange={setEnergia} />

          <div className="space-y-2">
            <Label htmlFor="ref">Uma frase sobre {semanal ? "a semana" : "o dia"}</Label>
            <Textarea
              id="ref"
              rows={3}
              value={reflexao}
              placeholder="Sem julgamento. Só o que você notou."
              onChange={(e) => setReflexao(e.target.value)}
            />
          </div>

          {semanal && (
            <div className="space-y-3 rounded-xl border bg-muted/40 p-4">
              <p className="text-sm">
                Você cumpriu <strong>{pctTarefas}%</strong> do que combinou ({feitas} de{" "}
                {tarefas.length} tarefas).
              </p>
              {budgets.map((b) => {
                const dom = domains.find((d) => d.id === b.domain_id);
                const feito = realizado[b.domain_id] ?? 0;
                const planejado = Number(b.planned_hours);
                return (
                  <div key={b.id}>
                    <div className="flex justify-between text-xs">
                      <span>{dom?.name ?? "—"}</span>
                      <span className="text-muted-foreground">
                        {feito.toFixed(1)}h de {planejado.toFixed(1)}h
                      </span>
                    </div>
                    <Progress
                      className="mt-1"
                      value={planejado ? Math.min(100, (feito / planejado) * 100) : 0}
                    />
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex gap-2">
            <Button
              className="flex-1"
              disabled={salvar.isPending}
              onClick={() =>
                salvar.mutate(undefined, {
                  onSuccess: () => {
                    setAberto(false);
                    toast.success(semanal ? "Semana fechada. Descanse." : "Dia fechado. Descanse.");
                  },
                  onError: () => toast.error("Não foi possível salvar."),
                })
              }
            >
              Salvar
            </Button>
            <Button variant="ghost" onClick={() => fechar(false)}>
              Agora não
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
