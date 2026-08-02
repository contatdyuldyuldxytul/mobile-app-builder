import { Link, useRouterState } from "@tanstack/react-router";
import { Bell, CalendarRange, Columns3, Sunrise, Trophy, User } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { CheckinDialog } from "@/components/checkin-dialog";
import { GuardiaoProvider } from "@/components/guardiao-provider";
import { useTheme } from "@/hooks/use-theme";

const NAV = [
  { to: "/hoje", label: "Hoje", icon: Sunrise },
  { to: "/semana", label: "Semana", icon: Columns3 },
  { to: "/mensal", label: "Mensal", icon: CalendarRange },
  { to: "/desafios", label: "Desafios", icon: Trophy },
  { to: "/eu", label: "Eu", icon: User },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  // O tema escolhido em "Eu" vale em todas as telas.
  useTheme();

  async function notificacoes() {
    if (typeof Notification === "undefined") {
      toast.info("Este aparelho não permite avisos do app.");
      return;
    }
    if (Notification.permission === "granted") {
      toast.success("Os avisos do app estão ligados.");
      return;
    }
    const p = await Notification.requestPermission();
    toast[p === "granted" ? "success" : "info"](
      p === "granted" ? "Avisos ligados." : "Avisos continuam desligados.",
    );
  }

  return (
    <GuardiaoProvider>
      <div className="min-h-screen md:flex">
        <CheckinDialog />
        <aside className="hidden w-60 shrink-0 border-r bg-sidebar px-4 py-8 md:flex md:flex-col">
          <span className="px-3 font-serif text-2xl font-bold tracking-tight">Redima</span>
          <nav className="mt-8 flex flex-1 flex-col gap-1">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
                  pathname === item.to && "bg-mint font-semibold text-foreground",
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            ))}
          </nav>
          <Button variant="ghost" size="sm" onClick={notificacoes} aria-label="Notificações">
            <Bell className="h-4 w-4" /> Notificações
          </Button>
        </aside>

        <div className="flex-1 pb-24 md:pb-0">
          <header className="flex items-center justify-between px-5 py-4 md:hidden">
            <span className="font-serif text-2xl font-bold tracking-tight">Redima</span>
            <Button variant="ghost" size="sm" onClick={notificacoes} aria-label="Notificações">
              <Bell className="h-4 w-4" />
            </Button>
          </header>
          <main className="mx-auto w-full max-w-3xl px-5 py-8">{children}</main>
        </div>

        <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 gap-1 border-t border-border/60 bg-card px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-float md:hidden">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex min-w-0 flex-col items-center gap-1 rounded-2xl px-1 py-1.5 text-[0.65rem] text-muted-foreground transition-colors",
                pathname === item.to && "font-semibold text-foreground",
              )}
            >
              <span
                className={cn(
                  "grid h-9 w-9 shrink-0 place-items-center rounded-2xl transition-colors",
                  pathname === item.to && "bg-primary text-primary-foreground",
                )}
              >
                <item.icon className="h-4 w-4" />
              </span>
              <span className="truncate">{item.label}</span>
            </Link>
          ))}
        </nav>
      </div>
    </GuardiaoProvider>
  );
}
