import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Redima — orce o seu tempo e viva com intenção" },
      {
        name: "description",
        content:
          "Um espaço calmo para orçar o seu tempo por área da vida: planejamento mensal, semanal e diário, hábitos e check-in de fim de dia.",
      },
      { property: "og:title", content: "Redima — orce o seu tempo" },
      {
        property: "og:description",
        content: "Planeje mês, semana e dia por área da vida. Sem pressa, sem culpa.",
      },
    ],
  }),
  component: Index,
});

const PRINCIPIOS = [
  { titulo: "Comece pela intenção", texto: "Uma âncora para o dia, antes das tarefas." },
  { titulo: "Que o seu sim seja sim", texto: "O app avisa quando você promete mais horas do que existem." },
  { titulo: "Priorize os seus sins", texto: "Orçamento de tempo do mês à semana e ao dia." },
  { titulo: "Unipresença", texto: "Um bloco de foco por vez, nunca multitarefa." },
  { titulo: "Descanso produtivo", texto: "Pausa a cada 2h e descanso planejado no orçamento." },
  { titulo: "Elimine a pressa", texto: "Check-in gentil no fim do dia, sem punição." },
];

function Index() {
  const { userId, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && userId) navigate({ to: "/hoje", replace: true });
  }, [loading, userId, navigate]);

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-14 px-6 py-20">
      <header className="space-y-6">
        <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Gestão de tempo</p>
        <h1 className="text-5xl leading-tight sm:text-6xl">
          Orce o seu tempo.
          <br />
          Viva com intenção.
        </h1>
        <p className="max-w-xl text-lg text-muted-foreground">
          Um lugar só para decidir onde o seu tempo vai — por área da vida, do mês ao dia — e
          depois olhar com honestidade para onde ele foi.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link to="/auth">Começar agora</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link to="/auth">Já tenho conta</Link>
          </Button>
        </div>
      </header>

      <section className="grid gap-6 sm:grid-cols-2">
        {PRINCIPIOS.map((p) => (
          <div key={p.titulo} className="rounded-2xl border bg-card p-5">
            <h2 className="text-xl">{p.titulo}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{p.texto}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
