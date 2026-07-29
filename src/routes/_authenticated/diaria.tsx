import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useDomains, useIdealWeek, useSaveMutation, useTimeBlocks } from "@/lib/data";
import { addDays, formatLongDate, hoursBetween, shortTime, toISODate } from "@/lib/dates";
import { DAY_HOURS, findOverlaps, generateDayFromTemplate } from "@/lib/cascade";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronLeft, ChevronRight, RefreshCw, Trash2, TriangleAlert } from "lucide-react";

export const Route = createFileRoute("/_authenticated/diaria")({
  head: () => ({
    meta: [
      { title: "Agenda diária — Redima" },
      { name: "description", content: "Monte o seu dia em blocos de tempo por área da vida." },
      { property: "og:title", content: "Agenda diária — Redima" },
      { property: "og:description", content: "Blocos de tempo do dia." },
    ],
  }),
  component: Diaria,
});

function Diaria() {
  const [dia, setDia] = useState(() => new Date());
  const iso = toISODate(dia);
  const { data: blocos = [], isFetched } = useTimeBlocks(iso);
  const { data: domains = [] } = useDomains();
  const { data: template = [] } = useIdealWeek();
  const qc = useQueryClient();
  const gerados = useRef<Set<string>>(new Set());

  const [titulo, setTitulo] = useState("");
  const [inicio, setInicio] = useState("09:00");
  const [fim, setFim] = useState("10:00");
  const [dominio, setDominio] = useState("");
  const [foco, setFoco] = useState(false);

  const dow = (dia.getDay() + 6) % 7;
  const doTemplate = template.filter((t) => t.day_of_week === dow);

  async function gerar(silencioso = true) {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    const criados = await generateDayFromTemplate(data.user.id, iso);
    if (criados > 0) {
      qc.invalidateQueries({ queryKey: ["blocks"] });
      qc.invalidateQueries({ queryKey: ["blocks-range"] });
      if (!silencioso) toast.success(`${criados} bloco(s) trazidos da semana ideal.`);
    } else if (!silencioso) {
      toast.info("O dia já está de acordo com a semana ideal.");
    }
  }

  // O dia real nasce preenchido a partir do template (uma vez por data).
  useEffect(() => {
    if (!isFetched || !doTemplate.length || gerados.current.has(iso)) return;
    gerados.current.add(iso);
    void gerar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iso, isFetched, doTemplate.length]);

  const criar = useSaveMutation<void>(async (_v, userId) => {
    if (fim <= inicio) throw new Error("Fim precisa ser depois do início");
    const { error } = await supabase.from("time_blocks").insert({
      user_id: userId,
      date: iso,
      title: titulo,
      start_time: inicio,
      end_time: fim,
      domain_id: dominio || null,
      is_focus_block: foco,
    });
    if (error) throw error;
  }, ["blocks", "blocks-range"]);

  const concluir = useSaveMutation<{ id: string; completed: boolean }>(
    async ({ id, completed }) => {
      const { error } = await supabase
        .from("time_blocks")
        .update({ completed, status: completed ? "feito" : "planejado" })
        .eq("id", id);
      if (error) throw error;
    },
    ["blocks", "blocks-range"],
  );

  const remover = useSaveMutation<string>(async (id) => {
    const { error } = await supabase.from("time_blocks").delete().eq("id", id);
    if (error) throw error;
  }, ["blocks", "blocks-range"]);

  const total = blocos.reduce((s, b) => s + hoursBetween(b.start_time, b.end_time), 0);
  const conflitos = useMemo(() => findOverlaps(blocos), [blocos]);
  const passaDoDia = total > DAY_HOURS;

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl">Dia</h1>
          <p className="text-sm text-muted-foreground">{formatLongDate(iso)}</p>
        </div>
        <div className="flex gap-1">
          <Button
            variant="outline"
            size="icon"
            title="Trazer da semana ideal"
            onClick={() => gerar(false)}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => setDia(addDays(dia, -1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => setDia(addDays(dia, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <p className="text-sm text-muted-foreground">
        Este dia nasce da sua{" "}
        <Link to="/semana-ideal" className="text-primary underline-offset-4 hover:underline">
          semana ideal
        </Link>
        . Editar aqui não altera o template.
      </p>

      {(passaDoDia || conflitos.size > 0) && (
        <div className="flex items-start gap-2 rounded-2xl border border-destructive/50 bg-destructive/5 p-4 text-sm text-destructive">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {passaDoDia && `O dia soma ${total.toFixed(1)}h — mais do que as 24h existentes. `}
            {conflitos.size > 0 && "Há blocos sobrepostos."}
          </span>
        </div>
      )}

      <section className="space-y-4 rounded-2xl border bg-card p-5">
        <h2 className="text-xl">Novo bloco</h2>
        <div className="space-y-2">
          <Label htmlFor="tb">O que você vai fazer</Label>
          <Input id="tb" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="i">Início</Label>
            <Input id="i" type="time" value={inicio} onChange={(e) => setInicio(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="f">Fim</Label>
            <Input id="f" type="time" value={fim} onChange={(e) => setFim(e.target.value)} />
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
        <div className="flex items-center justify-between rounded-xl border p-3">
          <Label htmlFor="foco">Bloco de foco (sem distração)</Label>
          <Switch id="foco" checked={foco} onCheckedChange={setFoco} />
        </div>
        <Button
          disabled={!titulo.trim() || criar.isPending}
          onClick={() =>
            criar.mutate(undefined, {
              onSuccess: () => {
                setTitulo("");
                setFoco(false);
                toast.success("Bloco criado.");
              },
              onError: () => toast.error("Não foi possível criar o bloco."),
            })
          }
        >
          Adicionar bloco
        </Button>
      </section>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xl">Blocos</h2>
          <span className="text-sm text-muted-foreground">{total.toFixed(1)}h</span>
        </div>
        {blocos.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhum bloco neste dia.</p>
        )}
        {blocos.map((b) => {
          const dom = domains.find((d) => d.id === b.domain_id);
          return (
            <div
              key={b.id}
              className="flex items-center gap-3 rounded-2xl border-l-4 bg-card p-4"
              style={{ borderLeftColor: dom?.color ?? "var(--border)" }}
            >
              <Checkbox
                checked={b.completed}
                onCheckedChange={(v) => concluir.mutate({ id: b.id, completed: !!v })}
              />
              <div className="flex-1">
                <p className={b.completed ? "text-muted-foreground line-through" : ""}>{b.title}</p>
                <p className="text-xs text-muted-foreground">
                  {shortTime(b.start_time)}–{shortTime(b.end_time)}
                  {dom ? ` · ${dom.name}` : ""}
                  {b.is_focus_block ? " · foco" : ""}
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => remover.mutate(b.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          );
        })}
      </section>
    </div>
  );
}