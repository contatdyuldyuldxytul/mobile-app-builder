import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Coffee, Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { Personagem } from "@/components/personagem";

function mmss(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * Ciclo de foco de 2h com pausa ao final — o "descanso produtivo" do livro.
 * Fica fixo no rodapé do dia, acima da navegação.
 */
export function BreakBar({
  cycleMinutes = 120,
  breakMinutes = 15,
}: {
  cycleMinutes?: number;
  breakMinutes?: number;
}) {
  const [rodando, setRodando] = useState(false);
  const [segundos, setSegundos] = useState(0);
  const [emPausa, setEmPausa] = useState(false);
  const [avisoAberto, setAvisoAberto] = useState(false);
  const sessao = useRef<string | null>(null);
  const avisou = useRef(false);

  const limite = (emPausa ? breakMinutes : cycleMinutes) * 60;

  useEffect(() => {
    if (!rodando) return;
    const id = setInterval(() => setSegundos((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [rodando]);

  useEffect(() => {
    if (emPausa || avisou.current || segundos < limite) return;
    avisou.current = true;
    setRodando(false);
    setAvisoAberto(true);
  }, [segundos, limite, emPausa]);

  async function iniciar() {
    setRodando(true);
    if (sessao.current) return;
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    const { data: row } = await supabase
      .from("focus_sessions")
      .insert({ user_id: data.user.id })
      .select("id")
      .single();
    sessao.current = row?.id ?? null;
  }

  async function encerrar(tookBreak: boolean) {
    if (sessao.current) {
      await supabase
        .from("focus_sessions")
        .update({ ended_at: new Date().toISOString(), took_break: tookBreak })
        .eq("id", sessao.current);
      sessao.current = null;
    }
  }

  async function pausarAgora() {
    await encerrar(true);
    setAvisoAberto(false);
    setEmPausa(true);
    setSegundos(0);
    avisou.current = false;
    setRodando(true);
  }

  function maisDezMinutos() {
    setAvisoAberto(false);
    setSegundos(limite - 10 * 60);
    avisou.current = false;
    setRodando(true);
  }

  function voltarAoFoco() {
    setEmPausa(false);
    setSegundos(0);
    avisou.current = false;
    setRodando(false);
  }

  const pct = Math.min(100, (segundos / limite) * 100);
  const restante = Math.max(0, limite - segundos);

  return (
    <>
      <div className="fixed inset-x-0 bottom-[4.25rem] z-20 border-t bg-card/95 backdrop-blur md:bottom-0">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-3 px-5 py-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between text-xs">
              <span className="truncate text-muted-foreground">
                {emPausa ? "Pausa" : "Ciclo de foco"}
              </span>
              <span className="font-mono tabular-nums">{mmss(restante)}</span>
            </div>
            <span className="mt-1 block h-1.5 rounded-full bg-muted">
              <span
                className={cn(
                  "block h-1.5 rounded-full transition-[width]",
                  emPausa ? "bg-secondary" : "bg-primary",
                )}
                style={{ width: `${pct}%` }}
              />
            </span>
          </div>
          {emPausa ? (
            <Button size="sm" variant="outline" onClick={voltarAoFoco}>
              Voltar ao foco
            </Button>
          ) : rodando ? (
            <Button size="sm" variant="outline" onClick={() => setRodando(false)}>
              <Pause className="h-4 w-4" />
            </Button>
          ) : (
            <Button size="sm" onClick={iniciar}>
              <Play className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <Dialog open={avisoAberto} onOpenChange={setAvisoAberto}>
        <DialogContent>
          <DialogHeader>
            <div className="flex justify-center">
              <Personagem id="nuvem" nome="Nuvem" estado="radiante" tamanho="lg" />
            </div>
            <DialogTitle className="flex items-center gap-2">
              <Coffee className="h-5 w-5" /> Hora de pausar
            </DialogTitle>
            <DialogDescription>
              Você completou {Math.round(cycleMinutes / 60)}h de foco. Levante, respire, beba água —{" "}
              {breakMinutes} minutos bastam.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:justify-start">
            <Button onClick={pausarAgora}>Pausar agora</Button>
            <Button variant="ghost" onClick={maisDezMinutos}>
              Mais 10 min
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
