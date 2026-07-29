import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useDomains, useGoals, useMonthlyPlan, useSaveMutation } from "@/lib/data";
import { MONTHS } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronLeft, ChevronRight, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/mensal")({
  head: () => ({
    meta: [
      { title: "Planejamento mensal — Redima" },
      { name: "description", content: "Defina metas pessoais e profissionais por área da vida." },
      { property: "og:title", content: "Planejamento mensal — Redima" },
      { property: "og:description", content: "Metas do mês por área da vida." },
    ],
  }),
  component: Mensal,
});

const STATUS: Record<string, string> = {
  nao_iniciada: "Não iniciada",
  em_andamento: "Em andamento",
  concluida: "Concluída",
};

function Mensal() {
  const agora = new Date();
  const [ano, setAno] = useState(agora.getFullYear());
  const [mes, setMes] = useState(agora.getMonth() + 1);
  const { data: plano } = useMonthlyPlan(ano, mes);
  const { data: metas = [] } = useGoals(plano?.id);
  const { data: domains = [] } = useDomains();

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

  const atualizar = useSaveMutation<{ id: string; status: "nao_iniciada" | "em_andamento" | "concluida" }>(
    async ({ id, status }) => {
      const { error } = await supabase.from("goals").update({ status }).eq("id", id);
      if (error) throw error;
    },
    ["goals"],
  );

  const remover = useSaveMutation<string>(async (id) => {
    const { error } = await supabase.from("goals").delete().eq("id", id);
    if (error) throw error;
  }, ["goals"]);

  function mover(delta: number) {
    const d = new Date(ano, mes - 1 + delta, 1);
    setAno(d.getFullYear());
    setMes(d.getMonth() + 1);
  }

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl">{MONTHS[mes - 1]}</h1>
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

      <section className="space-y-4 rounded-2xl border bg-card p-5">
        <h2 className="text-xl">Nova meta</h2>
        <div className="space-y-2">
          <Label htmlFor="t">Título</Label>
          <Input id="t" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="d">Descrição</Label>
          <Textarea id="d" rows={2} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as typeof tipo)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pessoal">Pessoal</SelectItem>
                <SelectItem value="profissional">Profissional</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Área da vida (obrigatória)</Label>
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
        </div>
        <Button
          disabled={!titulo.trim() || !dominio || !plano || criar.isPending}
          onClick={() =>
            criar.mutate(undefined, {
              onSuccess: () => {
                setTitulo("");
                setDescricao("");
                setDominio("");
                toast.success("Meta criada.");
              },
              onError: () => toast.error("Não foi possível criar a meta."),
            })
          }
        >
          Adicionar meta
        </Button>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl">Metas em ordem de prioridade</h2>
        {metas.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhuma meta para este mês ainda.</p>
        )}
        {metas.map((m, i) => {
          const dom = domains.find((d) => d.id === m.domain_id);
          return (
            <article
              key={m.id}
              className="rounded-2xl border-l-4 bg-card p-4"
              style={{ borderLeftColor: dom?.color ?? "var(--border)" }}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">
                    #{i + 1} · {m.type === "pessoal" ? "Pessoal" : "Profissional"}
                    {dom ? ` · ${dom.name}` : ""}
                  </p>
                  <h3 className="text-lg">{m.title}</h3>
                  {m.description && (
                    <p className="mt-1 text-sm text-muted-foreground">{m.description}</p>
                  )}
                </div>
                <Button variant="ghost" size="icon" onClick={() => remover.mutate(m.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {Object.entries(STATUS).map(([valor, label]) => (
                  <button
                    key={valor}
                    type="button"
                    onClick={() =>
                      atualizar.mutate({ id: m.id, status: valor as "nao_iniciada" })
                    }
                    className={`rounded-full border px-3 py-1 text-xs ${
                      m.status === valor ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}