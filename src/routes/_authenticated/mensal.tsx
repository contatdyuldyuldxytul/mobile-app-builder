import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  useBlocksRange,
  useDomains,
  useGoals,
  useMonthlyPlan,
  useSaveMutation,
  useWeeklyPlan,
} from "@/lib/data";
import { MONTHS, hoursBetween, toISODate } from "@/lib/dates";
import { ProgressRing } from "@/components/progress-ring";
import { fmtHoras } from "@/lib/format";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import {
  CalendarPlus,
  Check,
  ChevronLeft,
  ChevronRight,
  Circle,
  Plus,
  Timer,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/mensal")({
  head: () => ({
    meta: [
      { title: "Metas do mês — Redima" },
      { name: "description", content: "Metas do mês por área da vida, com progresso visual." },
      { property: "og:title", content: "Metas do mês — Redima" },
      { property: "og:description", content: "Poucas metas, bem escolhidas, por área da vida." },
    ],
  }),
  component: Mensal,
});

type Status = "nao_iniciada" | "em_andamento" | "concluida";

const PROXIMO: Record<Status, Status> = {
  nao_iniciada: "em_andamento",
  em_andamento: "concluida",
  concluida: "nao_iniciada",
};

function Mensal() {
  const agora = new Date();
  const [ano, setAno] = useState(agora.getFullYear());
  const [mes, setMes] = useState(agora.getMonth() + 1);
  const { data: plano } = useMonthlyPlan(ano, mes);
  const { data: metas = [] } = useGoals(plano?.id);
  const { data: domains = [] } = useDomains();
  const { data: semana } = useWeeklyPlan();
  const inicioMes = toISODate(new Date(ano, mes - 1, 1));
  const fimMes = toISODate(new Date(ano, mes, 0));
  const { data: blocosMes = [] } = useBlocksRange(inicioMes, fimMes);

  const [aberto, setAberto] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [tipo, setTipo] = useState<"pessoal" | "profissional">("pessoal");
  const [dominio, setDominio] = useState<string>("");

  const criar = useSaveMutation<void>(async (_v, userId) => {
    if (!plano) throw new Error("Sem plano");
    if (!dominio) throw new Error("Escolha uma área da vida");
    const { error } = await supabase.from("goals").insert({
      user_id: userId,
      monthly_plan_id: plano.id,
      title: titulo,
      description: descricao || null,
      type: tipo,
      domain_id: dominio,
      priority: metas.length,
    });
    if (error) throw error;
  }, ["goals"]);

  const atualizar = useSaveMutation<{ id: string; status: Status }>(async ({ id, status }) => {
    const { error } = await supabase.from("goals").update({ status }).eq("id", id);
    if (error) throw error;
  }, ["goals"]);

  const remover = useSaveMutation<string>(async (id) => {
    const { error } = await supabase.from("goals").delete().eq("id", id);
    if (error) throw error;
  }, ["goals"]);

  /** A ponte com a Semana: a meta vira uma tarefa a posicionar nos dias. */
  const reservar = useSaveMutation<{ id: string; title: string; domainId: string | null }>(
    async (meta, userId) => {
      const { error } = await supabase.from("tasks").insert({
        user_id: userId,
        weekly_plan_id: semana?.id ?? null,
        goal_id: meta.id,
        domain_id: meta.domainId,
        title: meta.title,
        estimated_minutes: 60,
        status: "backlog",
      });
      if (error) throw error;
    },
    ["tasks"],
  );

  /** Horas já vividas no mês, por área — o que o "Hoje" registrou. */
  const horasPorArea = useMemo(() => {
    const map: Record<string, number> = {};
    blocosMes.forEach((b) => {
      if (!b.domain_id || !b.completed) return;
      map[b.domain_id] = (map[b.domain_id] ?? 0) + hoursBetween(b.start_time, b.end_time);
    });
    return map;
  }, [blocosMes]);

  const totalHoras = Object.values(horasPorArea).reduce((s, h) => s + h, 0);

  function mover(delta: number) {
    const d = new Date(ano, mes - 1 + delta, 1);
    setAno(d.getFullYear());
    setMes(d.getMonth() + 1);
  }

  const concluidas = metas.filter((m) => m.status === "concluida").length;
  const andamento = metas.filter((m) => m.status === "em_andamento").length;
  const pct = metas.length ? (concluidas / metas.length) * 100 : 0;

  const porArea = useMemo(() => {
    return domains
      .map((d) => ({ d, itens: metas.filter((m) => m.domain_id === d.id) }))
      .filter((g) => g.itens.length > 0);
  }, [domains, metas]);

  return (
    <div className="space-y-8 pb-20">
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-4xl">{MONTHS[mes - 1]}</h1>
          <p className="text-sm text-muted-foreground">{ano} · metas do mês</p>
        </div>
        <div className="flex gap-1">
          <Button variant="outline" size="icon" onClick={() => mover(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => mover(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <section className="flex items-center gap-5 rounded-2xl border bg-card p-5">
        <ProgressRing pct={pct} size={96} />
        <div className="min-w-0">
          <p className="text-lg">
            {concluidas} de {metas.length} metas concluídas
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {andamento > 0 ? `${andamento} em andamento agora.` : "Toque no cartão para avançar o status."}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {fmtHoras(totalHoras)} vividas no mês, vindas do seu dia a dia.
          </p>
        </div>
      </section>

      {totalHoras > 0 && (
        <section className="space-y-3 rounded-2xl border bg-card p-5">
          <h2 className="text-xl">Para onde seu tempo foi</h2>
          <p className="text-sm text-muted-foreground">
            Somatório dos blocos que você concluiu em {MONTHS[mes - 1].toLowerCase()}.
          </p>
          <div className="space-y-3 pt-1">
            {domains
              .map((d) => ({ d, h: horasPorArea[d.id] ?? 0 }))
              .filter((x) => x.h > 0)
              .sort((a, b) => b.h - a.h)
              .map(({ d, h }) => (
                <div key={d.id}>
                  <div className="flex justify-between text-sm">
                    <span className="min-w-0 truncate">{d.name}</span>
                    <span className="text-muted-foreground">{fmtHoras(h)}</span>
                  </div>
                  <Progress className="mt-1" value={(h / totalHoras) * 100} />
                </div>
              ))}
          </div>
        </section>
      )}

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogTrigger asChild>
          <Button className="w-full" size="lg">
            <Plus className="mr-2 h-4 w-4" /> Nova meta do mês
          </Button>
        </DialogTrigger>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nova meta</DialogTitle>
            <DialogDescription>Toda meta pertence a uma área da vida.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="t">Título</Label>
              <Input
                id="t"
                value={titulo}
                placeholder="Ex.: correr 40km no mês"
                onChange={(e) => setTitulo(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="d">Descrição</Label>
              <Textarea
                id="d"
                rows={2}
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <div className="grid grid-cols-2 gap-2">
                {(["pessoal", "profissional"] as const).map((v) => (
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
            <Button
              className="w-full"
              disabled={!titulo.trim() || !dominio || !plano || criar.isPending}
              onClick={() =>
                criar.mutate(undefined, {
                  onSuccess: () => {
                    setTitulo("");
                    setDescricao("");
                    setDominio("");
                    setAberto(false);
                    toast.success("Meta criada.");
                  },
                  onError: () => toast.error("Não foi possível criar a meta."),
                })
              }
            >
              Adicionar meta
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {metas.length === 0 && (
        <p className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          Nenhuma meta neste mês ainda. Comece por duas ou três — poucas e bem escolhidas.
        </p>
      )}

      {porArea.map(({ d, itens }) => {
        const feitas = itens.filter((m) => m.status === "concluida").length;
        return (
          <section key={d.id} className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: d.color }} />
              <h2 className="min-w-0 flex-1 truncate text-lg">{d.name}</h2>
              <span className="font-mono text-xs text-muted-foreground">
                {feitas}/{itens.length}
              </span>
            </div>
            {itens.map((m) => {
              const status = m.status as Status;
              const feito = status === "concluida";
              return (
                <article
                  key={m.id}
                  className={cn(
                    "group flex items-start gap-3 rounded-2xl border-l-4 bg-card p-4 transition-all duration-300",
                    feito && "opacity-70",
                  )}
                  style={{ borderLeftColor: d.color }}
                >
                  <button
                    type="button"
                    aria-label="Avançar status"
                    onClick={() => atualizar.mutate({ id: m.id, status: PROXIMO[status] })}
                    className={cn(
                      "mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full border transition-all duration-300 active:scale-90",
                      feito && "border-primary bg-primary text-primary-foreground",
                      status === "em_andamento" && "border-primary text-primary",
                    )}
                  >
                    {feito ? (
                      <Check className="h-4 w-4" />
                    ) : status === "em_andamento" ? (
                      <Timer className="h-4 w-4" />
                    ) : (
                      <Circle className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                  <div className="min-w-0 flex-1">
                    <h3 className={cn("text-base leading-snug", feito && "line-through")}>
                      {m.title}
                    </h3>
                    {m.description && (
                      <p className="mt-1 text-sm text-muted-foreground">{m.description}</p>
                    )}
                    <p className="mt-2 text-xs text-muted-foreground">
                      {m.type === "pessoal" ? "Pessoal" : "Profissional"} ·{" "}
                      {feito
                        ? "concluída"
                        : status === "em_andamento"
                          ? "em andamento"
                          : "não iniciada"}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Levar para a semana"
                    className="shrink-0 text-muted-foreground"
                    disabled={reservar.isPending}
                    onClick={() =>
                      reservar.mutate(
                        { id: m.id, title: m.title, domainId: m.domain_id },
                        {
                          onSuccess: () =>
                            toast.success("Virou tarefa no backlog da Semana."),
                          onError: () => toast.error("Não deu para levar para a semana."),
                        },
                      )
                    }
                  >
                    <CalendarPlus className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0 text-muted-foreground"
                    onClick={() => remover.mutate(m.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </article>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}
