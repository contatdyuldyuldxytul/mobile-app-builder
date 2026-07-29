import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSaveMutation } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({
    meta: [
      { title: "Primeiros passos — Redima" },
      { name: "description", content: "Crie suas áreas da vida e escolha o modo espiritual." },
      { property: "og:title", content: "Primeiros passos — Redima" },
      { property: "og:description", content: "Configure suas áreas da vida." },
    ],
  }),
  component: Onboarding,
});

const SUGESTOES = ["Trabalho", "Saúde", "Família", "Descanso", "Espiritual", "Estudos"];
const CORES = ["#6b8f71", "#a8763e", "#5b7fa6", "#a35c5c", "#7a6ba8", "#4f7d6e"];

function Onboarding() {
  const navigate = useNavigate();
  const [nomes, setNomes] = useState<string[]>([]);
  const [novo, setNovo] = useState("");
  const [espiritual, setEspiritual] = useState(false);

  const salvar = useSaveMutation<void>(async (_v, userId) => {
    if (nomes.length) {
      const { error } = await supabase.from("life_domains").insert(
        nomes.map((name, i) => ({
          user_id: userId,
          name,
          color: CORES[i % CORES.length],
          sort_order: i,
        })),
      );
      if (error) throw error;
    }
    const { error: e2 } = await supabase
      .from("profiles")
      .update({ spiritual_mode: espiritual, onboarding_completed: true })
      .eq("id", userId);
    if (e2) throw e2;
  }, ["domains", "profile"]);

  function adicionar(nome: string) {
    const limpo = nome.trim();
    if (!limpo || nomes.includes(limpo)) return;
    setNomes([...nomes, limpo]);
    setNovo("");
  }

  return (
    <div className="space-y-10">
      <header className="space-y-2">
        <h1 className="text-4xl">Vamos começar devagar</h1>
        <p className="text-muted-foreground">
          Duas escolhas rápidas. Você pode mudar tudo depois em Ajustes.
        </p>
      </header>

      <section className="space-y-4">
        <h2 className="text-2xl">1. Suas áreas da vida</h2>
        <p className="text-sm text-muted-foreground">
          São as categorias em que o seu tempo será orçado. Escreva as suas.
        </p>
        <div className="flex gap-2">
          <Input
            value={novo}
            placeholder="Ex.: Trabalho"
            onChange={(e) => setNovo(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                adicionar(novo);
              }
            }}
          />
          <Button type="button" onClick={() => adicionar(novo)}>
            Adicionar
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {SUGESTOES.filter((s) => !nomes.includes(s)).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => adicionar(s)}
              className="rounded-full border px-3 py-1 text-sm text-muted-foreground hover:bg-accent"
            >
              + {s}
            </button>
          ))}
        </div>
        <ul className="flex flex-wrap gap-2">
          {nomes.map((n, i) => (
            <li
              key={n}
              className="flex items-center gap-2 rounded-full px-3 py-1 text-sm"
              style={{ backgroundColor: `${CORES[i % CORES.length]}22` }}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: CORES[i % CORES.length] }}
              />
              {n}
              <button type="button" onClick={() => setNomes(nomes.filter((x) => x !== n))}>
                <X className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl">2. Modo espiritual</h2>
        <div className="flex items-center justify-between rounded-2xl border p-4">
          <div className="pr-4">
            <Label htmlFor="esp">Abrir o dia com devocional</Label>
            <p className="text-sm text-muted-foreground">
              Ativado, o começo do dia é devocional e reflexão. Desativado, é uma intenção do dia.
            </p>
          </div>
          <Switch id="esp" checked={espiritual} onCheckedChange={setEspiritual} />
        </div>
      </section>

      <Button
        size="lg"
        disabled={nomes.length === 0 || salvar.isPending}
        onClick={() =>
          salvar.mutate(undefined, {
            onSuccess: () => navigate({ to: "/ancoras" }),
            onError: () => toast.error("Não foi possível salvar."),
          })
        }
      >
        Concluir
      </Button>
    </div>
  );
}