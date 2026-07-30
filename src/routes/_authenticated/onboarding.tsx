import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, Plus } from "lucide-react";
import { useSaveMutation } from "@/lib/data";
import { WEEK_HOURS } from "@/lib/cascade";
import { DIAS_UTEIS } from "@/lib/presets";
import { WEEKDAYS } from "@/lib/dates";
import { AREA_PRESETS, A_CLASSIFICAR, sameArea } from "@/lib/areas";
import {
  detectedWorkHoursPerDay,
  hoursByArea,
  type RoutinePattern,
} from "@/lib/routine-detect";
import { saveOnboarding } from "@/lib/onboarding";
import {
  gerarSemanaIdeal,
  pausasSugeridasPorDia,
  REFEICOES_PADRAO,
} from "@/lib/ideal-week";
import {
  isIosNeedsInstall,
  requestNotificationPermission,
  saveRituals,
} from "@/lib/notify";
import { ConectarAgenda } from "@/components/onboarding/conectar-agenda";
import { SemanaIdealPreview } from "@/components/onboarding/semana-ideal-preview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({
    meta: [
      { title: "Comece em 1 minuto — Redima" },
      {
        name: "description",
        content:
          "Conecte sua agenda e o Redima deduz sua rotina, monta a semana e define seu orçamento de tempo.",
      },
      { property: "og:title", content: "Comece em 1 minuto — Redima" },
      {
        property: "og:description",
        content: "Sua agenda vira uma semana pronta, sem digitar nada.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Onboarding,
});

const TOTAL = 6;

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

  const [conectado, setConectado] = useState(false);
  const [padroes, setPadroes] = useState<RoutinePattern[] | null>(null);

  const [sono, setSono] = useState(7.5);
  const [horasTrabalho, setHorasTrabalho] = useState(8);
  const [diasTrabalho, setDiasTrabalho] = useState<number[]>(DIAS_UTEIS);

  const [areas, setAreas] = useState<string[]>([
    "Trabalho",
    "Academia ou esportes",
    "Família",
    "Lazer",
  ]);
  const [novaArea, setNovaArea] = useState("");
  const [horasPorArea, setHorasPorArea] = useState<Record<string, number>>({});

  const [refeicoes, setRefeicoes] = useState(REFEICOES_PADRAO);
  const [pausas15, setPausas15] = useState<number | null>(null);
  const pausasDia = pausas15 ?? pausasSugeridasPorDia(sono, refeicoes);

  const [manha, setManha] = useState("07:30");
  const [noite, setNoite] = useState("21:00");
  const [pausas, setPausas] = useState(true);

  const areasDisponiveis = useMemo(() => {
    const nomes = AREA_PRESETS.map((a) => a.name);
    for (const a of areas) if (!nomes.some((n) => sameArea(n, a))) nomes.push(a);
    return nomes;
  }, [areas]);

  const areasExtras = areas.filter(
    (a) => !sameArea(a, "Trabalho") && !sameArea(a, "Alimentação") && !sameArea(a, "Pausas"),
  );
  const horasSono = sono * 7;
  const horasOcupacao = horasTrabalho * diasTrabalho.length;
  const horasRefeicoes = refeicoes * 7;
  const horasPausas = pausasDia * 7;
  const horasExtras = areasExtras.reduce((s, a) => s + (horasPorArea[a] ?? 0), 0);
  const comprometidas = horasSono + horasOcupacao + horasRefeicoes + horasPausas + horasExtras;
  const livres = WEEK_HOURS - comprometidas;
  const livresAposAncoras = WEEK_HOURS - horasSono - horasOcupacao;

  function aoLerAgenda(detectados: RoutinePattern[]) {
    setConectado(true);
    setPadroes(detectados);

    const trabalho = detectedWorkHoursPerDay(detectados);
    if (trabalho > 0) setHorasTrabalho(Math.min(14, trabalho));

    const horas = hoursByArea(detectados);
    if (horas.size) {
      const detectadas = [...horas.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([nome]) => nome)
        .slice(0, 6);
      setAreas((atuais) => {
        const juntas = [...detectadas];
        for (const a of atuais) if (!juntas.some((n) => sameArea(n, a)) && juntas.length < 6) juntas.push(a);
        return juntas;
      });
      setHorasPorArea((atuais) => {
        const novo = { ...atuais };
        for (const [nome, valor] of horas) novo[nome] = Math.round(valor * 2) / 2;
        return novo;
      });
    }
  }

  function alternarArea(nome: string) {
    setAreas((atuais) =>
      atuais.some((a) => sameArea(a, nome))
        ? atuais.filter((a) => !sameArea(a, nome))
        : atuais.length >= 6
          ? atuais
          : [...atuais, nome],
    );
  }

  const padroesConfirmados = useMemo(() => {
    if (padroes && padroes.length) return padroes;
    return gerarSemanaIdeal({
      sono,
      horasTrabalho,
      diasTrabalho,
      refeicoesPorDia: refeicoes,
      pausasPorDia: pausasDia,
      horasPorArea: Object.fromEntries(areasExtras.map((a) => [a, horasPorArea[a] ?? 0])),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [padroes, areas, horasPorArea, sono, horasTrabalho, diasTrabalho, refeicoes, pausasDia]);

  const [gradeEditada, setGradeEditada] = useState<RoutinePattern[] | null>(null);
  const grade = gradeEditada ?? padroesConfirmados;

  const salvar = useSaveMutation<void>(
    async (_v, userId) =>
      saveOnboarding(userId, {
        sono,
        horasTrabalho,
        diasTrabalho,
        areas,
        horasPorArea: Object.fromEntries([
          ...areasExtras.map((a) => [a, horasPorArea[a] ?? 0]),
          ["Trabalho", horasOcupacao],
          ["Alimentação", horasRefeicoes],
          ["Pausas", horasPausas],
        ]) as Record<string, number>,
        areas: [...areas, "Alimentação", "Pausas"],
        padroes: grade.filter((p) => p.area !== A_CLASSIFICAR),
        rituais: { morning: manha, evening: noite, breaks: pausas },
      }),
    ["domains", "profile", "settings", "budgets", "ideal-week", "weekly", "blocks"],
  );

  const podeAvancar = passo !== 3 || areas.length >= 1;

  async function concluir() {
    saveRituals({ morning: manha, evening: noite, breaks: pausas, breakInterval: 120 });
    salvar.mutate(undefined, {
      onSuccess: () => {
        toast.success("Pronto. Sua semana está montada.");
        navigate({ to: "/hoje" });
      },
      onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível salvar."),
    });
  }

  return (
    <div className="space-y-8 pb-8">
      <header className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Passo {passo} de {TOTAL}
        </p>
        <Progress value={(passo / TOTAL) * 100} />
      </header>

      {passo === 1 && (
        <section className="space-y-5">
          <div>
            <h1 className="text-3xl sm:text-4xl">Conecte sua agenda</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              É só um login: assim seu app já começa preenchido com a sua rotina de verdade.
            </p>
          </div>
          <ConectarAgenda conectado={conectado} onLido={aoLerAgenda} />
        </section>
      )}

      {passo === 2 && (
        <section className="space-y-5">
          <div>
            <h1 className="text-3xl sm:text-4xl">Duas âncoras</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Sono e trabalho são o tempo já comprometido. Ajuste e veja o que sobra.
            </p>
          </div>

          <div className="rounded-2xl border-l-4 border-l-primary bg-card p-5">
            <p className="text-lg leading-relaxed">
              Sua semana tem {WEEK_HOURS} horas. Você já comprometeu{" "}
              <strong className="font-mono">{(horasSono + horasOcupacao).toFixed(0)}h</strong>.
              Sobram{" "}
              <strong className="font-mono text-primary">{livresAposAncoras.toFixed(0)}h</strong>{" "}
              livres — é sobre elas que vamos conversar.
            </p>
          </div>

          <div className="space-y-4 rounded-2xl border bg-card p-5">
            <Label>Sono por noite: {sono.toFixed(1).replace(".0", "")}h</Label>
            <Slider value={[sono]} min={4} max={12} step={0.5} onValueChange={([v]) => setSono(v)} />
            <Label>Trabalho por dia: {horasTrabalho}h</Label>
            <Slider
              value={[horasTrabalho]}
              min={0}
              max={14}
              step={0.5}
              onValueChange={([v]) => setHorasTrabalho(v)}
            />
            <div className="flex flex-wrap gap-2 pt-1">
              {WEEKDAYS.map((d, i) => (
                <button
                  key={d}
                  type="button"
                  onClick={() =>
                    setDiasTrabalho((atual) =>
                      atual.includes(i)
                        ? atual.filter((x) => x !== i)
                        : [...atual, i].sort((a, b) => a - b),
                    )
                  }
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-sm text-muted-foreground",
                    diasTrabalho.includes(i) && "bg-primary text-primary-foreground",
                  )}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {passo === 3 && (
        <section className="space-y-5">
          <div>
            <h1 className="text-3xl sm:text-4xl">Suas áreas da vida</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {conectado
                ? "Já marquei o que apareceu na sua agenda. Escolha de 4 a 6."
                : "Escolha de 4 a 6 — dá para mudar depois."}
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {areasDisponiveis.map((nome) => (
              <Chip
                key={nome}
                ativo={areas.some((a) => sameArea(a, nome))}
                onClick={() => alternarArea(nome)}
              >
                {nome}
              </Chip>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              value={novaArea}
              placeholder="Criar uma área sua"
              onChange={(e) => setNovaArea(e.target.value)}
            />
            <Button
              variant="outline"
              onClick={() => {
                const nome = novaArea.trim();
                if (!nome) return;
                if (areas.some((a) => sameArea(a, nome))) return toast.info("Essa área já está aí.");
                alternarArea(nome);
                setNovaArea("");
              }}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </section>
      )}

      {passo === 4 && (
        <section className="space-y-5">
          <div>
            <h1 className="text-3xl sm:text-4xl">Distribua as horas livres</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {conectado
                ? "Comecei pelo tempo que você realmente gasta. Ajuste só o que discordar."
                : "Arraste até ficar do jeito que você quer viver a semana."}
            </p>
          </div>

          <div
            className={cn(
              "rounded-2xl border p-4 text-sm",
              livres < 0 ? "border-destructive bg-destructive/5 text-destructive" : "bg-card",
            )}
          >
            {livres < 0
              ? `${Math.abs(livres).toFixed(1)}h além das ${WEEK_HOURS}h da semana. Tire de algum lugar.`
              : `${livres.toFixed(1)}h ainda não alocadas.`}
          </div>

          <div className="space-y-5 rounded-2xl border bg-card p-5">
            {areasExtras.map((area) => {
              const valor = horasPorArea[area] ?? 0;
              const maximo = Math.max(1, Math.min(60, valor + Math.max(0, livres)));
              return (
                <div key={area} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>{area}</span>
                    <span className="font-mono text-muted-foreground">{valor.toFixed(1)}h</span>
                  </div>
                  <Slider
                    value={[valor]}
                    min={0}
                    max={maximo}
                    step={0.5}
                    onValueChange={([v]) =>
                      setHorasPorArea((atual) => ({ ...atual, [area]: v }))
                    }
                  />
                </div>
              );
            })}
            {areasExtras.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Escolha algumas áreas no passo anterior para distribuir suas horas.
              </p>
            )}
          </div>
        </section>
      )}

      {passo === 5 && (
        <section className="space-y-5">
          <div>
            <h1 className="text-3xl sm:text-4xl">Sua semana ideal</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {conectado
                ? "Montei a partir do que se repete na sua agenda. Apague o que não quiser."
                : "Montei a partir das horas que você distribuiu."}
            </p>
          </div>
          <SemanaIdealPreview
            padroes={grade}
            areas={areas}
            onArea={(index, area) =>
              setGradeEditada(grade.map((p, i) => (i === index ? { ...p, area } : p)))
            }
            onRemover={(index) => setGradeEditada(grade.filter((_, i) => i !== index))}
          />
        </section>
      )}

      {passo === 6 && (
        <section className="space-y-5">
          <div>
            <h1 className="text-3xl sm:text-4xl">Seus lembretes</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Dois toques por dia: um para começar, outro para confirmar como foi.
            </p>
          </div>
          <div className="space-y-4 rounded-2xl border bg-card p-5">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="manha">Check-in da manhã</Label>
                <Input id="manha" type="time" value={manha} onChange={(e) => setManha(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="noite">Check-in da noite</Label>
                <Input id="noite" type="time" value={noite} onChange={(e) => setNoite(e.target.value)} />
              </div>
            </div>
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <Label htmlFor="pausas">Lembrete de pausa a cada 2h</Label>
                <p className="text-sm text-muted-foreground">
                  Também serve para confirmar o bloco anterior.
                </p>
              </div>
              <Switch id="pausas" checked={pausas} onCheckedChange={setPausas} />
            </div>
            <Button
              variant="outline"
              className="w-full"
              onClick={async () => {
                const r = await requestNotificationPermission();
                if (r === "granted") toast.success("Lembretes ligados.");
                else if (r === "denied") toast.info("Sem problema — os lembretes ficam dentro do app.");
                else if (r === "unsupported")
                  toast.info("Este navegador não envia lembretes; eles ficam dentro do app.");
              }}
            >
              Ativar lembretes
            </Button>
            {isIosNeedsInstall() && (
              <p className="text-xs text-muted-foreground">
                No iPhone, toque em Compartilhar → “Adicionar à Tela de Início” para receber os
                lembretes.
              </p>
            )}
          </div>
        </section>
      )}

      <div className="flex gap-3">
        {passo > 1 && (
          <Button variant="outline" onClick={() => setPasso(passo - 1)}>
            Voltar
          </Button>
        )}
        {passo < TOTAL ? (
          <>
            <Button className="flex-1" disabled={!podeAvancar} onClick={() => setPasso(passo + 1)}>
              Continuar
            </Button>
            <Button variant="ghost" onClick={() => setPasso(passo + 1)}>
              Pular
            </Button>
          </>
        ) : (
          <Button className="flex-1" disabled={salvar.isPending} onClick={concluir}>
            {salvar.isPending ? "Montando…" : "Concluir"}
          </Button>
        )}
      </div>
    </div>
  );
}