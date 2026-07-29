import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  CalendarRange,
  Clock,
  LogOut,
  Moon,
  Repeat,
  Settings,
  Sun,
  Sunrise,
  NotebookPen,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const NAV = [
  { to: "/hoje", label: "Hoje", icon: Sunrise },
  { to: "/mensal", label: "Mensal", icon: CalendarRange },
  { to: "/semanal", label: "Semanal", icon: CalendarDays },
  { to: "/diaria", label: "Diária", icon: Clock },
  { to: "/habitos", label: "Hábitos", icon: Repeat },
  { to: "/revisao", label: "Revisão", icon: NotebookPen },
  { to: "/configuracoes", label: "Ajustes", icon: Settings },
] as const;

function useTheme() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const stored = localStorage.getItem("tema") === "dark";
    setDark(stored);
    document.documentElement.classList.toggle("dark", stored);
  }, []);
  function toggle() {
    const next = !dark;
    setDark(next);
    localStorage.setItem("tema", next ? "dark" : "light");
    document.documentElement.classList.toggle("dark", next);
  }
  return { dark, toggle };
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { dark, toggle } = useTheme();

  async function sair() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen md:flex">
      <aside className="hidden w-60 shrink-0 border-r bg-sidebar px-4 py-8 md:flex md:flex-col">
        <span className="px-3 font-serif text-2xl">Redima</span>
        <nav className="mt-8 flex flex-1 flex-col gap-1">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
                pathname === item.to && "bg-accent text-accent-foreground",
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={toggle}>
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="sm" onClick={sair}>
            <LogOut className="h-4 w-4" /> Sair
          </Button>
        </div>
      </aside>

      <div className="flex-1 pb-24 md:pb-0">
        <header className="flex items-center justify-between border-b px-5 py-4 md:hidden">
          <span className="font-serif text-xl">Redima</span>
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={toggle}>
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="sm" onClick={sair}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>
        <main className="mx-auto w-full max-w-3xl px-5 py-8">{children}</main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-20 flex justify-between gap-1 overflow-x-auto border-t bg-card px-2 py-2 md:hidden">
        {NAV.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className={cn(
              "flex min-w-[3.5rem] flex-col items-center gap-1 rounded-lg px-2 py-1 text-[0.65rem] text-muted-foreground",
              pathname === item.to && "text-primary",
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}