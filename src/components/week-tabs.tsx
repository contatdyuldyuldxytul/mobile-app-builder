import { Link, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

const ABAS = [
  { to: "/semana", label: "Quadro" },
  { to: "/semanal", label: "Orçamento" },
  { to: "/semana-ideal", label: "Semana ideal" },
] as const;

export function WeekTabs() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="flex gap-1 rounded-xl bg-muted p-1">
      {ABAS.map((a) => (
        <Link
          key={a.to}
          to={a.to}
          className={cn(
            "flex-1 rounded-lg px-3 py-1.5 text-center text-sm text-muted-foreground transition-colors",
            pathname === a.to && "bg-card text-foreground shadow-sm",
          )}
        >
          {a.label}
        </Link>
      ))}
    </div>
  );
}