import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSaveMutation } from "@/lib/data";
import { ensureAnchorDomains, WEEK_HOURS } from "@/lib/cascade";
import {
  DIAS_UTEIS,
  DOMAIN_PRESETS,
  HABIT_PRESETS,
  TODOS_OS_DIAS,
  porDia,
} from "@/lib/presets";
import { WEEKDAYS } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({
    meta: [
      { title: "Primeiros passos — Redima" },
      {
        name: "description",
        content: "Sono, trabalho ou estudo, atividades da semana e hábitos — em poucos toques.",
      },
      { property: "og:title", content: "Primeiros passos — Redima" },
      { property: "og:description", content: "Monte sua semana em menos de dois minutos." },
    ],
  }),
  component: Onboarding,
});

type Ocupacao = "trabalho" | "estudo" | "ambos" | "nenhum";

const TOTAL_PASSOS = 5;

function Chip({
  ativo,
  onClick,
  children,
}: {
  ativo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 rounded-2xl border px-4 py-3 text-left text-sm text-muted-foreground transition-colors",
        ativo && "border-primary bg-primary/10 text-foreground",
      )}
    >
      {ativo && <Check className="h-4 w-4 shrink-0 text-primary" />}
      <span className="min-w-0">{children}</span>
    </button>
  );
}

function Onboarding() {
  const navigate = useNavigate();
  const [passo, setPasso] = useState(1);

  const [sono, setSono] = useState(7.5);
  const [ocupacao, setOcupacao] = useState<Ocupacao>("trabalho");
  const [horasOcupacao, setHorasOcupacao] = useState(8);
  const [diasOcupacao, setDiasOcupacao] = useState<number[]>(DIAS_UTEIS);
  const [atividades, setAtividades] = useState<string[]>([]);
  const [horas, setHoras] = useState<Record<string, number>>({});
  const [principais, setPrincipais] = useState<string[]>([]);
  const [habitos, setHabitos] = useState<string[]>([]);
  const [espiritual, setEspiritual] = useState(false);

  const horasSono = sono * 7;
  const horasTrabalho = ocupacao === "nenhum" ? 0 : horasOcupacao * diasOcupacao.length;
  const horasAtividades = atividades.reduce(
    (s, nome) => s + (horas[nome] ?? DOMAIN_PRESETS.find((p) => p.name === nome)?.hours ?? 0),
    0,
  );
  const livre = WEEK_HOURS - horasSono - horasTrabalho - horasAtividades;

  function alternar(lista: string[], set: (v: string[]) => void, valor: string, max?: number) {
    if (lista.includes(valor)) return set(lista.filter((x) => x !== valor));
    if (max && lista.length >= max) return;
    set([...lista, valor]);
  }

  const salvar = useSaveMutation<void>(async (_v, userId) => {
    const { error: eSet } = await supabase.from("settings").upsert(
      {
        user_id: userId,
        sleep_hours_per_day: sono,
        work_hours_per_day: ocupacao === "nenhum" ? 0 : horasOcupacao,
        work_days: ocupacao === "nenhum" ? [] : diasOcupacao,
        anchors_configured: true,
      },
      { onConflict: "user_id" },
    );
    if (eSet) throw eSet;

    await ensureAnchorDomains(
      userId,
      sono,
      ocupacao === "nenhum" ? 0 : horasOcupacao,
      ocupacao === "nenhum" ? [] : diasOcupacao,
    );

    const criados: Record<string, string> = {};
    for (const [i, nome] of atividades.entries()) {
      const preset = DOMAIN_PRESETS.find((p) => p.name === nome)!;
      const { data, error } = await supabase
        .from("life_domains")
        .insert({
          user_id: userId,
          name: preset.name,
          color: preset.color,
          sort_order: principais.includes(nome) ? i : 10 + i,
          default_weekly_hours: horas[nome] ?? preset.hours,
          preferred_days: preset.days,
        })
        .select("id")
        .maybeSingle();
      if (error && !error.message.includes("duplicate")) throw error;
      if (data) criados[nome] = data.id;
    }

    if (habitos.length) {
      const linhas = habitos.map((nome) => {
        const preset = HABIT_PRESETS.find((h) => h.name === nome)!;
        return {
          user_id: userId,
          name: preset.name,
          type: preset.type,
          frequency: preset.days,
          domain_id: preset.domain ? (criados[preset.domain] ?? null) : null,
        };
      });
      const { error } = await supabase.from("habits").insert(linhas);
      if (error) throw error;
    }

    const { error: eProf } = await supabase
      .from("profiles")
      .update({ spiritual_mode: espiritual, onboarding_completed: true })
      .eq("id", userId);
    if (eProf) throw eProf;
  }, ["domains", "profile", "settings", "habits"]);

  const podeAvancar = passo !== 3 || atividades.length > 0;

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Passo {passo} de {TOTAL_PASSOS}
        </p>
        <Progress value={(passo / TOTAL_PASSOS) * 100} />
      </header>

      {passo === 1 && (
        <section className="space-y-5">
          <div>
            <h1 className="text-3xl sm:text-4xl">Quantas horas você dorme por noite?</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              O recomendado é entre 7h e 8h. Dormir é a primeira coisa que reservamos na semana.
            </p>
          </div>
          <div className="rounded-2xl border bg-card p-5">
            <p className="font-mono text-4xl">{sono.toFixed(1).replace(".0", "")}h</p>
            <Slider
              className="mt-5"
              value={[sono]}
              min={4}
              max={12}
              step={0.5}
              onValueChange={([v]) => setSono(v)}
            />
            <p className="mt-4 text-sm text-muted-foreground">
              {horasSono.toFixed(0)}h por semana das {WEEK_HOURS}h disponíveis.
            </p>
          </div>
        </section>
      )}

      {passo === 2 && (
        <section className="space-y-5">
          <div>
            <h1 className="text-3xl sm:text-4xl">Você trabalha ou estuda?</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Isso também é tempo já comprometido — vamos reservar antes de tudo.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {(
              [
                ["trabalho", "Trabalho"],
                ["estudo", "Estudo"],
                ["ambos", "Os dois"],
                ["nenhum", "Nenhum agora"],
              ] as [Ocupacao, string][]
            ).map(([v, l]) => (
              <Chip key={v} ativo={ocupacao === v} onClick={() => setOcupacao(v)}>
                {l}
              </Chip>
            ))}
          </div>

          {ocupacao !== "nenhum" && (
            <div className="space-y-5 rounded-2xl border bg-card p-5">
              <div className="space-y-3">
                <Label>Horas por dia: {horasOcupacao}h</Label>
                <Slider
                  value={[horasOcupacao]}
                  min={1}
                  max={14}
                  step={0.5}
                  onValueChange={([v]) => setHorasOcupacao(v)}
                />
              </div>
              <div className="space-y-2">
                <Label>Em quais dias</Label>
                <div className="flex flex-wrap gap-2">
                  {WEEKDAYS.map((d, i) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() =>
                        setDiasOcupacao((atual) =>
                          atual.includes(i)
                            ? atual.filter((x) => x !== i)
                            : [...atual, i].sort((a, b) => a - b),
                        )
                      }
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-sm text-muted-foreground",
                        diasOcupacao.includes(i) && "bg-primary text-primary-foreground",
                      )}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                {horasTrabalho.toFixed(0)}h por semana.
              </p>
            </div>
          )}
        </section>
      )}

      {passo === 3 && (
        <section className="space-y-5">
          <div>
            <h1 className="text-3xl sm:text-4xl">O que mais faz parte da sua semana?</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Escolha o que se aplica. As horas são só uma sugestão — dá para mudar depois.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {DOMAIN_PRESETS.map((p) => (
              <Chip
                key={p.name}
                ativo={atividades.includes(p.name)}
                onClick={() => alternar(atividades, setAtividades, p.name)}
              >
                <span className="block">{p.name}</span>
                <span className="block text-xs text-muted-foreground">
                  {p.hours}h/semana · {porDia(p.hours, p.days.length)}/dia em {p.days.length} dias
                </span>
              </Chip>
            ))}
          </div>

          {atividades.length > 0 && (
            <div className="space-y-3 rounded-2xl border bg-card p-5">
              <h2 className="text-lg">Horas por semana</h2>
              {atividades.map((nome) => {
                const p = DOMAIN_PRESETS.find((x) => x.name === nome)!;
                return (
                  <div key={nome} className="flex items-center gap-3">
                    <span className="min-w-0 flex-1 truncate text-sm">{nome}</span>
                    <Input
                      type="number"
                      min={0}
                      step={0.5}
                      className="w-20"
                      value={horas[nome] ?? p.hours}
                      onChange={(e) =>
                        setHoras({ ...horas, [nome]: Math.max(0, Number(e.target.value)) })
                      }
                    />
                    <span className="text-sm text-muted-foreground">h</span>
                  </div>
                );
              })}
              <p
                className={cn(
                  "text-sm",
                  livre < 0 ? "text-destructive" : "text-muted-foreground",
                )}
              >
                {livre < 0
                  ? `${Math.abs(livre).toFixed(0)}h além das ${WEEK_HOURS}h da semana.`
                  : `Ainda sobram ${livre.toFixed(0)}h livres na semana.`}
              </p>
            </div>
          )}
        </section>
      )}

      {passo === 4 && (
        <section className="space-y-5">
          <div>
            <h1 className="text-3xl sm:text-4xl">Onde seu tempo mais vai hoje?</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Escolha até 3. Elas ganham destaque no seu orçamento da semana.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {atividades.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Você não escolheu atividades — pode pular este passo.
              </p>
            ) : (
              atividades.map((nome) => (
                <Chip
                  key={nome}
                  ativo={principais.includes(nome)}
                  onClick={() => alternar(principais, setPrincipais, nome, 3)}
                >
                  {nome}
                </Chip>
              ))
            )}
          </div>
        </section>
      )}

      {passo === 5 && (
        <section className="space-y-5">
          <div>
            <h1 className="text-3xl sm:text-4xl">Quais hábitos você quer manter?</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Eles aparecem no checklist do seu dia, automaticamente.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {HABIT_PRESETS.map((h) => (
              <Chip
                key={h.name}
                ativo={habitos.includes(h.name)}
                onClick={() => alternar(habitos, setHabitos, h.name)}
              >
                <span className="block">{h.name}</span>
                <span className="block text-xs text-muted-foreground">
                  {h.days.length === 7 ? "todos os dias" : `${h.days.length}x na semana`}
                  {h.type === "evitar" ? " · evitar" : ""}
                </span>
              </Chip>
            ))}
          </div>

          <div className="flex items-center justify-between rounded-2xl border bg-card p-4">
            <div className="min-w-0 pr-4">
              <Label htmlFor="esp">Modo espiritual</Label>
              <p className="text-sm text-muted-foreground">
                A frase do dia vira um versículo e o começo do dia, um devocional.
              </p>
            </div>
            <Switch id="esp" checked={espiritual} onCheckedChange={setEspiritual} />
          </div>
        </section>
      )}

      <div className="flex gap-3">
        {passo > 1 && (
          <Button variant="outline" onClick={() => setPasso(passo - 1)}>
            Voltar
          </Button>
        )}
        {passo < TOTAL_PASSOS ? (
          <Button className="flex-1" disabled={!podeAvancar} onClick={() => setPasso(passo + 1)}>
            Continuar
          </Button>
        ) : (
          <Button
            className="flex-1"
            disabled={salvar.isPending}
            onClick={() =>
              salvar.mutate(undefined, {
                onSuccess: () => {
                  toast.success("Sua semana está montada.");
                  navigate({ to: "/semana" });
                },
                onError: (e) =>
                  toast.error(e instanceof Error ? e.message : "Não foi possível salvar."),
              })
            }
          >
            Concluir
          </Button>
        )}
      </div>
      {passo === TOTAL_PASSOS && (
        <p className="text-xs text-muted-foreground">
          Padrão de dias sugerido: {TODOS_OS_DIAS.length === 7 ? "todos os dias" : ""} — tudo pode
          ser ajustado depois em Ajustes.
        </p>
      )}
    </div>
  );
}
