import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";

function format(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

export function FocusTimer({ breakMinutes = 120 }: { breakMinutes?: number }) {
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const sessionId = useRef<string | null>(null);
  const avisou = useRef(false);
  const limite = breakMinutes * 60;

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  useEffect(() => {
    if (elapsed >= limite && !avisou.current) {
      avisou.current = true;
      toast("Hora de uma pausa", {
        description: "Você trabalhou o bloco combinado. Levante, respire, volte depois.",
      });
    }
  }, [elapsed, limite]);

  async function iniciar() {
    setRunning(true);
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    const { data: row } = await supabase
      .from("focus_sessions")
      .insert({ user_id: data.user.id })
      .select("id")
      .single();
    sessionId.current = row?.id ?? null;
  }

  async function encerrar(tookBreak: boolean) {
    setRunning(false);
    if (sessionId.current) {
      await supabase
        .from("focus_sessions")
        .update({ ended_at: new Date().toISOString(), took_break: tookBreak })
        .eq("id", sessionId.current);
      sessionId.current = null;
    }
    setElapsed(0);
    avisou.current = false;
  }

  const restante = Math.max(0, limite - elapsed);

  return (
    <div className="rounded-2xl border bg-card p-5">
      <div className="flex items-baseline justify-between">
        <h2 className="text-xl">Foco</h2>
        <span className="text-sm text-muted-foreground">
          {restante > 0 ? `pausa em ${format(restante)}` : "faça a pausa"}
        </span>
      </div>
      <p className="mt-3 font-mono text-4xl tabular-nums">{format(elapsed)}</p>
      <Progress className="mt-3" value={Math.min(100, (elapsed / limite) * 100)} />
      <div className="mt-4 flex gap-2">
        {!running ? (
          <Button onClick={iniciar}>Iniciar bloco</Button>
        ) : (
          <>
            <Button variant="outline" onClick={() => setRunning(false)}>
              Pausar
            </Button>
            <Button onClick={() => encerrar(true)}>Encerrar e descansar</Button>
          </>
        )}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">Uma coisa importante por vez.</p>
    </div>
  );
}