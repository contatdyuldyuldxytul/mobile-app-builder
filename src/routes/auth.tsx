import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — Redima" },
      { name: "description", content: "Entre ou crie sua conta para orçar o seu tempo." },
      { property: "og:title", content: "Entrar — Redima" },
      { property: "og:description", content: "Acesse seu orçamento de tempo." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const [mode, setMode] = useState<"entrar" | "criar">("entrar");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const { userId, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && userId) navigate({ to: "/hoje", replace: true });
  }, [loading, userId, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "criar") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success("Conta criada. Bem-vindo!");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      navigate({ to: "/hoje", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível continuar.");
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("Não foi possível entrar com o Google.");
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/hoje", replace: true });
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm space-y-8">
        <div className="space-y-2 text-center">
          <h1 className="text-4xl">{mode === "entrar" ? "Bem-vindo de volta" : "Criar conta"}</h1>
          <p className="text-sm text-muted-foreground">
            Seu orçamento de tempo, sempre no mesmo lugar.
          </p>
        </div>

        <Button variant="outline" className="w-full" onClick={google}>
          Continuar com Google
        </Button>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          ou
          <span className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            {mode === "entrar" ? "Entrar" : "Criar conta"}
          </Button>
        </form>

        <button
          type="button"
          className="w-full text-sm text-muted-foreground underline-offset-4 hover:underline"
          onClick={() => setMode(mode === "entrar" ? "criar" : "entrar")}
        >
          {mode === "entrar" ? "Não tenho conta ainda" : "Já tenho uma conta"}
        </button>
      </div>
    </main>
  );
}
