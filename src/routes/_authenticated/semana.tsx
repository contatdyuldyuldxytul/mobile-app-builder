import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { weekStart } from "@/lib/dates";
import { WeekBudget } from "@/components/week-budget";

export const Route = createFileRoute("/_authenticated/semana")({
  head: () => ({
    meta: [
      { title: "Semana — Redima" },
      {
        name: "description",
        content:
          "Reserve horas por área da vida e escolha os dias — o app cuida das pausas e do teto do dia.",
      },
      { property: "og:title", content: "Semana — Redima" },
      { property: "og:description", content: "Horas por área da vida, dia a dia." },
    ],
  }),
  component: Semana,
});

function Semana() {
  const inicio = useMemo(() => weekStart(), []);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl sm:text-4xl">Semana</h1>
        <p className="text-sm text-muted-foreground">
          Quantas horas por dia cada área merece. O que você dá a uma, o app tira das outras — nunca
          passa do que o dia tem.
        </p>
      </header>

      <WeekBudget inicio={inicio} />
    </div>
  );
}
