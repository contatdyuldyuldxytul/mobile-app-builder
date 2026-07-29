import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSaveMutation, useSettings } from "@/lib/data";
import { ensureAnchorDomains, WEEK_HOURS } from "@/lib/cascade";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { WEEKDAYS } from "@/lib/dates";

export const Route = createFileRoute("/_authenticated/ancoras")({
  head: () => ({
    meta: [
      { title: "Âncoras fixas — Redima" },
      { name: "description", content: "Defina sono e trabalho e veja quanto tempo livre sobra na semana." },
      { property: "og:title", content: "Âncoras fixas — Redima" },
      { property: "og:description", content: "Sono, trabalho e o tempo livre da sua semana." },
    ],
  }),
  component: Ancoras,
});

function Ancoras() {
  const { data: settings } = useSettings();
  const [sono, setSono] = useState(8);
  const [trabalho, setTrabalho] = useState(8);
  const [dias, setDias] = useState<number[]>([0, 1, 2, 3, 4]);

  useEffect(() => {
    if (!settings) return;
    setSono(Number(settings.sleep_hours_per_day));
    setTrabalho(Number(settings.work_hours_per_day));
    setDias((settings.work_days ?? []).map(Number));
  }, [settings]);

  const horasSono = sono * 7;
  const horasTrabalho = trabalho * dias.length;
  const livre = WEEK_HOURS - horasSono - horasTrabalho;

  const salvar = useSaveMutation<void>(async (_v, userId) => {
    const { error } = await supabase.from("settings").upsert(
      {
        user_id: userId,
        sleep_hours_per_day: sono,
        work_hours_per_day: trabalho,
        work_days: dias,
        anchors_configured: true,
      },
      { onConflict: "user_id" },
    );
    if (error) throw error;
    await ensureAnchorDomains(userId, sono, trabalho, dias);
  }, ["settings", "domains"]);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-4xl">Âncoras fixas</h1>
        <p className="text-sm text-muted-foreground">
          Defina uma vez o que é inegociável na sua semana. O resto é o seu tempo livre.
        </p>
      </header>

      <section className="space-y-6 rounded-2xl border bg-card p-5">
        <div className="space-y-3">
          <Label>Sono: {sono}h por dia ({horasSono.toFixed(0)}h/semana)</Label>
          <Slider value={[sono]} min={4} max={12} step={0.5} onValueChange={([v]) => setSono(v)} />
        </div>
        <div className="space-y-3">
          <Label>
            Trabalho: {trabalho}h por dia útil ({horasTrabalho.toFixed(0)}h/semana)
          </Label>
          <Slider
            value={[trabalho]}
            min={0}
            max={14}
            step={0.5}
            onValueChange={([v]) => setTrabalho(v)}
          />
        </div>
        <div className="space-y-2">
          <Label>Dias de trabalho</Label>
          <div className="flex flex-wrap gap-2">
            {WEEKDAYS.map((d, i) => (
              <button
                key={d}
                type="button"
                onClick={() =>
                  setDias((atual) =>
                    atual.includes(i) ? atual.filter((x) => x !== i) : [...atual, i].sort(),
                  )
                }
                className={`rounded-full border px-3 py-1 text-sm ${
                  dias.includes(i) ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border bg-card p-5">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xl">{livre.toFixed(0)}h livres</h2>
          <span className="text-sm text-muted-foreground">de {WEEK_HOURS}h na semana</span>
        </div>
        <Progress
          className="mt-3"
          value={Math.min(100, ((horasSono + horasTrabalho) / WEEK_HOURS) * 100)}
        />
        <p className="mt-3 text-sm text-muted-foreground">
          {horasSono.toFixed(0)}h de sono + {horasTrabalho.toFixed(0)}h de trabalho já estão
          comprometidas.
        </p>
      </section>

      <div className="flex flex-wrap gap-3">
        <Button
          disabled={salvar.isPending || livre < 0}
          onClick={() =>
            salvar.mutate(undefined, {
              onSuccess: () => toast.success("Âncoras salvas."),
              onError: () => toast.error("Não foi possível salvar."),
            })
          }
        >
          Salvar âncoras
        </Button>
        <Button asChild variant="outline">
          <Link to="/semana">Ir para a semana</Link>
        </Button>
      </div>
    </div>
  );
}