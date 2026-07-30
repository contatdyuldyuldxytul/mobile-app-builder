import { useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useDomains, useHabitLogs, useHabits, useSaveMutation } from "@/lib/data";
import { addDays, toISODate, todayISO, WEEKDAYS, weekStart } from "@/lib/dates";
import { HABIT_PRESETS } from "@/lib/presets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Check, Flame, Plus, Sparkles, Trash2, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

/** Cada hábito marcado vale 10 pontos; o nível sobe a cada 100. */
const PONTOS_POR_MARCA = 10;
const PONTOS_POR_NIVEL = 100;

/** Painel de hábitos — vive dentro da aba Mensal. */
export function HabitsPanel() {
  const hoje = new Date();
  const hojeISO = todayISO();
  const de = toISODate(addDays(hoje, -29));
  const { data: habits = [] } = useHabits();
  const { data: logs = [] } = useHabitLogs(de, hojeISO);
  const { data: domains = [] } = useDomains();

  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<"fazer" | "evitar">("fazer");
  const [dominio, setDominio] = useState("");
  const [dias, setDias] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);

  const criar = useSaveMutation<void>(
    async (_v, userId) => {
      const { error } = await supabase.from("habits").insert({
        user_id: userId,
        name: nome,
        type: tipo,
        domain_id: dominio || null,
        frequency: [...dias].sort((a, b) => a - b),
      });
      if (error) throw error;
    },
    ["habits"],
  );

  const remover = useSaveMutation<string>(
    async (id) => {
      const { error } = await supabase.from("habits").update({ is_archived: true }).eq("id", id);
      if (error) throw error;
    },
    ["habits"],
  );

  const adicionarPreset = useSaveMutation<string>(
    async (nomePreset, userId) => {
      const preset = HABIT_PRESETS.find((h) => h.name === nomePreset)!;
      const dominioId = preset.domain
        ? (domains.find((d) => d.name === preset.domain)?.id ?? null)
        : null;
      const { error } = await supabase.from("habits").insert({
        user_id: userId,
        name: preset.name,
        type: preset.type,
        frequency: preset.days,
        domain_id: dominioId,
      });
      if (error) throw error;
    },
    ["habits"],
  );

  const alternar = useSaveMutation<{ habitId: string; date: string; completed: boolean }>(
    async ({ habitId, date, completed }, userId) => {
      const { error } = await supabase
        .from("habit_logs")
        .upsert(
          { user_id: userId, habit_id: habitId, date, completed },
          { onConflict: "habit_id,date" },
        );
      if (error) throw error;
    },
    ["habit-logs"],
  );

  function feito(habitId: string, date: string) {
    return logs.some((l) => l.habit_id === habitId && l.date === date && l.completed);
  }

  function streak(habitId: string) {
    let count = 0;
    for (let i = 0; i < 60; i++) {
      const d = toISODate(addDays(hoje, -i));
      if (feito(habitId, d)) count++;
      else if (i > 0) break;
    }
    return count;
  }

  const inicioSemana = weekStart(hoje);
  const diasSemana = Array.from({ length: 7 }, (_, i) => toISODate(addDays(inicioSemana, i)));
  const diaAtual = (hoje.getDay() + 6) % 7;

  const marcasTotais = logs.filter((l) => l.completed).length;
  const pontos = marcasTotais * PONTOS_POR_MARCA;
  const nivel = Math.floor(pontos / PONTOS_POR_NIVEL) + 1;
  const progressoNivel = pontos % PONTOS_POR_NIVEL;

  const doDia = habits.filter((h) => h.frequency.includes(diaAtual));
  const feitosHoje = doDia.filter((h) => feito(h.id, hojeISO)).length;
  const pctHoje = doDia.length ? (feitosHoje / doDia.length) * 100 : 0;
  const melhorStreak = useMemo(
    () => habits.reduce((m, h) => Math.max(m, streak(h.id)), 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [habits, logs],
  );

  const sugestoes = HABIT_PRESETS.filter(
    (p) => !habits.some((h) => h.name.toLowerCase() === p.name.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <header className="flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-2xl">Hábitos</h2>
          <p className="text-sm text-muted-foreground">Consistência, não perfeição.</p>
        </div>
        <Dialog open={aberto} onOpenChange={setAberto}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline">
              <Plus className="mr-1 h-4 w-4" /> Novo
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90dvh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Novo hábito</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="n">Nome</Label>
                <Input id="n" value={nome} onChange={(e) => setNome(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <div className="grid grid-cols-2 gap-2">
                  {(["fazer", "evitar"] as const).map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setTipo(v)}
                      className={cn(
                        "rounded-xl border px-3 py-2 text-sm capitalize transition-colors",
                        tipo === v
                          ? "border-primary bg-primary/10"
                          : "text-muted-foreground hover:bg-accent",
                      )}
                    >
                      {v}
                    </button>
                  ))}
                </div>
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
              <div className="space-y-2">
                <Label>Dias da semana</Label>
                <div className="flex flex-wrap gap-1.5">
                  {WEEKDAYS.map((w, i) => (
                    <button
                      key={w}
                      type="button"
                      onClick={() =>
                        setDias(dias.includes(i) ? dias.filter((d) => d !== i) : [...dias, i])
                      }
                      className={cn(
                        "h-9 w-11 rounded-lg border text-xs text-muted-foreground transition-colors",
                        dias.includes(i) && "bg-primary text-primary-foreground",
                      )}
                    >
                      {w}
                    </button>
                  ))}
                </div>
              </div>
              <Button
                className="w-full"
                disabled={!nome.trim() || criar.isPending}
                onClick={() =>
                  criar.mutate(undefined, {
                    onSuccess: () => {
                      setNome("");
                      setAberto(false);
                      toast.success("Hábito criado.");
                    },
                    onError: () => toast.error("Não foi possível criar o hábito."),
                  })
                }
              >
                Adicionar hábito
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </header>

      <section className="overflow-hidden rounded-2xl border bg-card">
        <div className="flex items-center gap-4 bg-primary/10 p-5">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground">
            <Trophy className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-lg">Nível {nivel}</p>
            <p className="text-xs text-muted-foreground">
              {progressoNivel}/{PONTOS_POR_NIVEL} pontos para o próximo nível
            </p>
            <Progress className="mt-2 h-2" value={progressoNivel} />
          </div>
        </div>
        <div className="grid grid-cols-3 divide-x">
          <div className="p-4 text-center">
            <p className="font-mono text-2xl">
              {feitosHoje}/{doDia.length}
            </p>
            <p className="text-xs text-muted-foreground">hoje</p>
          </div>
          <div className="p-4 text-center">
            <p className="flex items-center justify-center gap-1 font-mono text-2xl">
              <Flame className={cn("h-5 w-5", melhorStreak > 0 && "text-primary")} />
              {melhorStreak}
            </p>
            <p className="text-xs text-muted-foreground">melhor sequência</p>
          </div>
          <div className="p-4 text-center">
            <p className="font-mono text-2xl">{marcasTotais}</p>
            <p className="text-xs text-muted-foreground">marcas em 30 dias</p>
          </div>
        </div>
        <div className="px-5 pb-5">
          <Progress className="h-3 transition-all duration-500" value={pctHoje} />
          <p className="mt-2 text-xs text-muted-foreground">
            {pctHoje === 100 && doDia.length > 0
              ? "Dia completo. Descanse com a consciência tranquila."
              : `${Math.round(pctHoje)}% do dia concluído`}
          </p>
        </div>
      </section>

      <div className="space-y-3">
        {habits.length === 0 && (
          <p className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            Nenhum hábito ainda. Comece pelas sugestões abaixo.
          </p>
        )}

        {habits.map((h) => {
          const s = streak(h.id);
          const dom = domains.find((d) => d.id === h.domain_id);
          const feitoHoje = feito(h.id, hojeISO);
          const noDia = h.frequency.includes(diaAtual);
          return (
            <article
              key={h.id}
              className="rounded-2xl border-l-4 bg-card p-4 transition-all duration-300"
              style={{ borderLeftColor: dom?.color ?? "var(--primary)" }}
            >
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  aria-label={`Marcar ${h.name}`}
                  onClick={() =>
                    alternar.mutate(
                      { habitId: h.id, date: hojeISO, completed: !feitoHoje },
                      {
                        onSuccess: () => {
                          if (!feitoHoje) toast.success(`+${PONTOS_POR_MARCA} pontos · ${h.name}`);
                        },
                      },
                    )
                  }
                  className={cn(
                    "grid h-11 w-11 shrink-0 place-items-center rounded-full border transition-all duration-300 active:scale-90",
                    feitoHoje
                      ? "scale-105 border-primary bg-primary text-primary-foreground"
                      : "hover:bg-accent",
                  )}
                >
                  <Check className={cn("h-5 w-5", !feitoHoje && "text-muted-foreground")} />
                </button>
                <div className="min-w-0 flex-1">
                  <h3 className={cn("truncate text-base", feitoHoje && "text-muted-foreground")}>
                    {h.name}
                  </h3>
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    {s > 0 && <Flame className="h-3.5 w-3.5 text-primary" />}
                    {s > 0 ? `${s} dia(s) seguidos` : "sem sequência ainda"}
                    {!noDia && " · fora dos dias escolhidos"}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 text-muted-foreground"
                  onClick={() => remover.mutate(h.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <div className="mt-3 grid grid-cols-7 gap-1.5">
                {diasSemana.map((d, i) => {
                  const marcado = feito(h.id, d);
                  const futuro = d > hojeISO;
                  return (
                    <button
                      key={d}
                      type="button"
                      disabled={futuro}
                      title={d}
                      onClick={() =>
                        alternar.mutate({ habitId: h.id, date: d, completed: !marcado })
                      }
                      className={cn(
                        "flex h-11 flex-col items-center justify-center rounded-xl border text-[10px] transition-all duration-300 disabled:opacity-40",
                        marcado
                          ? "border-primary bg-primary text-primary-foreground"
                          : "text-muted-foreground",
                        d === hojeISO && !marcado && "border-primary",
                      )}
                    >
                      <span>{WEEKDAYS[i]}</span>
                      <span className="font-mono">{marcado ? "✓" : "·"}</span>
                    </button>
                  );
                })}
              </div>
            </article>
          );
        })}
      </div>

      {sugestoes.length > 0 && (
        <section className="space-y-3 rounded-2xl border bg-card p-5">
          <h3 className="flex items-center gap-2 text-lg">
            <Sparkles className="h-4 w-4 text-primary" /> Sugestões
          </h3>
          <p className="text-sm text-muted-foreground">
            Um toque adiciona. Eles aparecem sozinhos no checklist do dia.
          </p>
          <div className="flex flex-wrap gap-2">
            {sugestoes.map((p) => (
              <button
                key={p.name}
                type="button"
                disabled={adicionarPreset.isPending}
                onClick={() =>
                  adicionarPreset.mutate(p.name, {
                    onSuccess: () => toast.success(`“${p.name}” adicionado.`),
                    onError: () => toast.error("Não foi possível adicionar."),
                  })
                }
                className="rounded-full border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent active:scale-95"
              >
                + {p.name}
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
