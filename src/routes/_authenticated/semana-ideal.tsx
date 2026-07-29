import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useDomains, useIdealWeek, useSaveMutation, useTimeBudgets, useWeeklyPlan } from "@/lib/data";
import { WEEKDAYS, hoursBetween, shortTime } from "@/lib/dates";
import { findOverlaps } from "@/lib/cascade";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2, TriangleAlert } from "lucide-react";

export const Route = createFileRoute("/_authenticated/semana-ideal")({
  head: () => ({
    meta: [
      { title: "Semana ideal — Redima" },
      { name: "description", content: "O template recorrente que preenche os seus dias automaticamente." },
      { property: "og:title", content: "Semana ideal — Redima" },
      { property: "og:description", content: "Blocos recorrentes por área da vida." },
    ],
  }),
  component: SemanaIdeal,
});

function SemanaIdeal() {
  const { data: blocos = [] } = useIdealWeek();
  const { data: domains = [] } = useDomains();
  const { data: plano } = useWeeklyPlan();
  const { data: budgets = [] } = useTimeBudgets(plano?.id);

  const [titulo, setTitulo] = useState("");
  const [inicio, setInicio] = useState("09:00");
  const [fim, setFim] = useState("10:00");
  const [dominio, setDominio] = useState("");
  const [foco, setFoco] = useState(false);
  const [dias, setDias] = useState<number[]>([]);

  const criar = useSaveMutation<void>(async (_v, userId) => {
    if (!dias.length) throw new Error("Escolha ao menos um dia");
    if (fim <= inicio) throw new Error("Fim precisa ser depois do início");
    const linhas = dias.map((d) => ({
      user_id: userId,
      day_of_week: d,
      start_time: inicio,
      end_time: fim,
      domain_id: dominio || null,
      title: titulo,
      is_focus_block: foco,
    }));
    const { error } = await supabase.from("ideal_week_blocks").insert(linhas);
    if (error) throw error;
  }, ["ideal-week"]);

  const remover = useSaveMutation<string>(async (id) => {
    const { error } = await supabase.from("ideal_week_blocks").delete().eq("id", id);
    if (error) throw error;
  }, ["ideal-week"]);

  const posicionadoPorDominio = useMemo(() => {
    const map: Record<string, number> = {};
    blocos.forEach((b) => {
      if (!b.domain_id) return;
      map[b.domain_id] = (map[b.domain_id] ?? 0) + hoursBetween(b.start_time, b.end_time);
    });
    return map;
  }, [blocos]);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-4xl">Semana ideal</h1>
        <p className="text-sm text-muted-foreground">
          O template que se repete toda semana. Cada dia real nasce daqui.
        </p>
      </header>

      <section className="space-y-3 rounded-2xl border bg-card p-5">
        <h2 className="text-xl">Orçado × posicionado</h2>
        {budgets.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Você ainda não orçou a semana.{" "}
            <Link to="/semanal" className="text-primary underline-offset-4 hover:underline">
              Fazer o orçamento
            </Link>
          </p>
        )}
        {budgets.map((b) => {
          const dom = domains.find((d) => d.id === b.domain_id);
          const orcado = Number(b.planned_hours);
          const posicionado = posicionadoPorDominio[b.domain_id] ?? 0;
          const faltam = orcado - posicionado;
          return (
            <div key={b.id}>
              <div className="flex justify-between text-sm">
                <span>{dom?.name ?? "—"}</span>
                <span className="text-muted-foreground">
                  orçado {orcado.toFixed(1)}h / posicionado {posicionado.toFixed(1)}h{" "}
                  {Math.abs(faltam) < 0.01
                    ? "· ok"
                    : faltam > 0
                      ? `→ faltam ${faltam.toFixed(1)}h`
                      : `→ ${Math.abs(faltam).toFixed(1)}h a mais`}
                </span>
              </div>
              <Progress
                className="mt-1"
                value={orcado ? Math.min(100, (posicionado / orcado) * 100) : 0}
              />
            </div>
          );
        })}
      </section>

      <section className="space-y-4 rounded-2xl border bg-card p-5">
        <h2 className="text-xl">Novo bloco recorrente</h2>
        <div className="space-y-2">
          <Label htmlFor="tt">O que é</Label>
          <Input id="tt" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="si">Início</Label>
            <Input id="si" type="time" value={inicio} onChange={(e) => setInicio(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sf">Fim</Label>
            <Input id="sf" type="time" value={fim} onChange={(e) => setFim(e.target.value)} />
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
          <div className="flex flex-wrap gap-2">
            {WEEKDAYS.map((d, i) => (
              <button
                key={d}
                type="button"
                onClick={() =>
                  setDias((atual) =>
                    atual.includes(i) ? atual.filter((x) => x !== i) : [...atual, i].sort(),
                  )
                }
                className={`rounded-full border px-3 py-1 text-sm ${
                  dias.includes(i) ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between rounded-xl border p-3">
          <Label htmlFor="sfoco">Bloco de foco</Label>
          <Switch id="sfoco" checked={foco} onCheckedChange={setFoco} />
        </div>
        <Button
          disabled={!titulo.trim() || !dominio || !dias.length || criar.isPending}
          onClick={() =>
            criar.mutate(undefined, {
              onSuccess: () => {
                setTitulo("");
                setDias([]);
                setFoco(false);
                toast.success("Bloco adicionado à semana ideal.");
              },
              onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível criar."),
            })
          }
        >
          Adicionar
        </Button>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {WEEKDAYS.map((nome, i) => {
          const doDia = blocos.filter((b) => b.day_of_week === i);
          const conflitos = findOverlaps(doDia);
          const horas = doDia.reduce((s, b) => s + hoursBetween(b.start_time, b.end_time), 0);
          return (
            <div key={nome} className="rounded-2xl border bg-card p-4">
              <div className="flex items-baseline justify-between">
                <h3 className="text-lg">{nome}</h3>
                <span className="text-xs text-muted-foreground">{horas.toFixed(1)}h</span>
              </div>
              {doDia.length === 0 && (
                <p className="mt-2 text-sm text-muted-foreground">Livre.</p>
              )}
              <ul className="mt-3 space-y-2">
                {doDia.map((b) => {
                  const dom = domains.find((d) => d.id === b.domain_id);
                  return (
                    <li
                      key={b.id}
                      className="flex items-center gap-2 rounded-xl border-l-4 bg-muted/40 px-2 py-1.5"
                      style={{ borderLeftColor: dom?.color ?? "var(--border)" }}
                    >
                      <span className="font-mono text-xs text-muted-foreground">
                        {shortTime(b.start_time)}–{shortTime(b.end_time)}
                      </span>
                      <span className="flex-1 text-sm">{b.title}</span>
                      {conflitos.has(b) && (
                        <TriangleAlert className="h-3.5 w-3.5 text-destructive" aria-label="Sobreposição" />
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => remover.mutate(b.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </li>
                  );
                })}
              </ul>
              {horas > 24 && (
                <p className="mt-2 text-xs text-destructive">Mais de 24h neste dia.</p>
              )}
            </div>
          );
        })}
      </section>
    </div>
  );
}