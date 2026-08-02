import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useDomains, useProfile, useSaveMutation, useSettings } from "@/lib/data";
import { useGuardioes } from "@/lib/guardioes";
import type { GuardiaoAnim } from "@/lib/guardiao-trigger";
import type { PersonagemId } from "@/lib/guardioes";
import { GuardioesGrid } from "@/components/guardioes-grid";
import { Personagem } from "@/components/personagem";
import { GuardiaoOverlay } from "@/components/guardiao-overlay";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Archive, LogOut, Trash2, User, ChevronDown } from "lucide-react";
import { AgendaIntegracoes } from "@/components/agenda-integracoes";
import { useTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/eu")({
  head: () => ({
    meta: [
      { title: "Eu — Redima" },
      {
        name: "description",
        content: "Seu perfil, o progresso de cada guardião e os ajustes do app.",
      },
      { property: "og:title", content: "Eu — Redima" },
      { property: "og:description", content: "Perfil, guardiões e ajustes." },
    ],
  }),
  component: Eu,
});

const CORES = ["#6b8f71", "#a8763e", "#5b7fa6", "#a35c5c", "#7a6ba8", "#4f7d6e"];

const GUARDIOES_TESTE: { id: GuardiaoAnim; nome: string }[] = [
  { id: "check", nome: "Check" },
  { id: "nuvem", nome: "Nuvem" },
  { id: "sol", nome: "Sol" },
  { id: "montanha", nome: "Montanha" },
  { id: "folha", nome: "Folha" },
  { id: "caderno", nome: "Caderno" },
  { id: "ampulheta", nome: "Ampulheta" },
];

function Eu() {
  const { data: profile } = useProfile();
  const { data: settings } = useSettings();
  const { data: domains = [] } = useDomains();
  const leitura = useGuardioes();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { dark, toggle } = useTheme();

  const [nomeNovo, setNomeNovo] = useState("");
  const [corNova, setCorNova] = useState(CORES[0]);
  const [inicioDia, setInicioDia] = useState("06:00");
  const [fimDia, setFimDia] = useState("22:00");
  const [pausa, setPausa] = useState(120);
  const [distracao, setDistracao] = useState(60);
  const [acordar, setAcordar] = useState("06:00");
  const [duracaoPausa, setDuracaoPausa] = useState(15);
  const [refeicao, setRefeicao] = useState({ cafe: 20, almoco: 45, lanche: 15, jantar: 40 });
  const [testeGuardiao, setTesteGuardiao] = useState<GuardiaoAnim | null>(null);
  const [abertoTeste, setAbertoTeste] = useState(false);

  useEffect(() => {
    if (profile) {
      setInicioDia(profile.day_start.slice(0, 5));
      setFimDia(profile.day_end.slice(0, 5));
    }
  }, [profile]);

  useEffect(() => {
    if (settings) {
      setPausa(settings.break_interval_minutes);
      setDistracao(settings.distraction_limit_minutes);
      setAcordar((settings.wake_time ?? "06:00").slice(0, 5));
      setDuracaoPausa(settings.break_duration_minutes ?? 15);
      setRefeicao({
        cafe: settings.meal_breakfast_minutes ?? 20,
        almoco: settings.meal_lunch_minutes ?? 45,
        lanche: settings.meal_snack_minutes ?? 15,
        jantar: settings.meal_dinner_minutes ?? 40,
      });
    }
  }, [settings]);

  const criarDominio = useSaveMutation<void>(
    async (_v, userId) => {
      const nome = nomeNovo.trim();
      if (domains.some((d) => d.name.toLowerCase() === nome.toLowerCase())) {
        throw new Error("Você já tem uma área com esse nome");
      }
      const { error } = await supabase.from("life_domains").insert({
        user_id: userId,
        name: nome,
        color: corNova,
        sort_order: domains.length,
      });
      if (error) throw error;
    },
    ["domains"],
  );

  const atualizarDominio = useSaveMutation<{
    id: string;
    color?: string;
    is_archived?: boolean;
    preferred_period?: string;
  }>(
    async ({ id, ...patch }) => {
      const { error } = await supabase.from("life_domains").update(patch).eq("id", id);
      if (error) throw error;
    },
    ["domains"],
  );

  const salvarPerfil = useSaveMutation<{ spiritual?: boolean }>(
    async ({ spiritual }, userId) => {
      const { error } = await supabase
        .from("profiles")
        .update({
          spiritual_mode: spiritual ?? profile?.spiritual_mode ?? false,
          day_start: inicioDia,
          day_end: fimDia,
        })
        .eq("id", userId);
      if (error) throw error;
    },
    ["profile"],
  );

  const salvarSettings = useSaveMutation<void>(
    async (_v, userId) => {
      const { error } = await supabase.from("settings").upsert(
        {
          user_id: userId,
          break_interval_minutes: pausa,
          distraction_limit_minutes: distracao,
          wake_time: acordar,
          focus_cycle_minutes: pausa,
          break_duration_minutes: duracaoPausa,
          meal_breakfast_minutes: refeicao.cafe,
          meal_lunch_minutes: refeicao.almoco,
          meal_snack_minutes: refeicao.lanche,
          meal_dinner_minutes: refeicao.jantar,
        },
        { onConflict: "user_id" },
      );
      if (error) throw error;
    },
    ["settings"],
  );

  const salvarSons = useSaveMutation<boolean>(
    async (ligado, userId) => {
      const { error } = await supabase
        .from("settings")
        .upsert({ user_id: userId, guardian_sounds_enabled: ligado }, { onConflict: "user_id" });
      if (error) throw error;
    },
    ["settings"],
  );

  async function sair() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="space-y-10">
      <header className="flex items-center gap-4">
        <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-mint">
          <User className="h-7 w-7" />
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-3xl sm:text-4xl">{profile?.display_name ?? "Eu"}</h1>
          <p className="text-sm text-muted-foreground">
            Seus guardiões contam como anda o seu tempo.
          </p>
        </div>
      </header>

      <section className="space-y-4">
        <div className="flex items-center gap-4 rounded-2xl border bg-card p-5">
          <Personagem id="ampulheta" nome="Ampulheta" estado="firme" tamanho="md" />
          <div className="min-w-0 flex-1">
            <h2 className="text-xl">A semana até aqui</h2>
            <Progress className="mt-2" value={Math.round(leitura.areia * 100)} />
            <p className="mt-2 text-sm text-muted-foreground">{leitura.ampulhetaFrase}</p>
          </div>
        </div>
        <h2 className="text-2xl">Seus guardiões</h2>
        <GuardioesGrid guardioes={leitura.guardioes} />
      </section>

      <section className="space-y-4">
        <button
          type="button"
          onClick={() => setAbertoTeste((v) => !v)}
          className="flex w-full items-center justify-between rounded-2xl border bg-card p-4 text-left transition-colors hover:bg-accent"
        >
          <div>
            <h2 className="text-xl">Testar guardiões</h2>
            <p className="text-sm text-muted-foreground">Toque nos botões para ver cada animação.</p>
          </div>
          <ChevronDown className={cn("h-5 w-5 transition-transform", abertoTeste && "rotate-180")} />
        </button>
        {abertoTeste && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {GUARDIOES_TESTE.map((g) => (
              <Button
                key={g.id}
                variant="outline"
                onClick={() => setTesteGuardiao(g.id)}
                className="h-auto flex-col gap-2 py-4"
              >
                <Personagem id={g.id as PersonagemId} nome={g.nome} estado="firme" tamanho="md" />
                <span className="text-sm font-medium">{g.nome}</span>
              </Button>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl">Áreas da vida</h2>
        <p className="text-sm text-muted-foreground">
          Nomes são únicos — não é possível duplicar uma área. As âncoras (sono e trabalho) vêm de{" "}
          <Link to="/ancoras" className="text-primary underline-offset-4 hover:underline">
            Âncoras fixas
          </Link>
          .
        </p>
        <div className="space-y-2">
          {domains.map((d) => (
            <div key={d.id} className="flex items-center gap-3 rounded-2xl border bg-card p-3">
              <input
                type="color"
                value={d.color}
                aria-label={`Cor de ${d.name}`}
                className="h-8 w-8 cursor-pointer rounded border-0 bg-transparent"
                onChange={(e) => atualizarDominio.mutate({ id: d.id, color: e.target.value })}
              />
              <span className="flex-1">{d.name}</span>
              <select
                aria-label={`Período de ${d.name}`}
                className="rounded-xl border bg-background px-2 py-1 text-sm"
                value={(d as { preferred_period?: string }).preferred_period ?? "qualquer"}
                onChange={(e) =>
                  atualizarDominio.mutate({ id: d.id, preferred_period: e.target.value })
                }
              >
                <option value="manha">Manhã</option>
                <option value="tarde">Tarde</option>
                <option value="noite">Noite</option>
                <option value="qualquer">Tanto faz</option>
              </select>
              <Button
                variant="ghost"
                size="icon"
                title="Arquivar"
                onClick={() => atualizarDominio.mutate({ id: d.id, is_archived: true })}
              >
                <Archive className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                title="Excluir"
                className="text-destructive"
                onClick={() => {
                  if (!confirm(`Excluir a área "${d.name}"?`)) return;
                  atualizarDominio.mutate({ id: d.id, is_archived: true });
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="color"
            aria-label="Cor da nova área"
            value={corNova}
            className="h-9 w-10 cursor-pointer rounded border-0 bg-transparent"
            onChange={(e) => setCorNova(e.target.value)}
          />
          <Input
            placeholder="Nova área da vida"
            value={nomeNovo}
            onChange={(e) => setNomeNovo(e.target.value)}
          />
          <Button
            disabled={!nomeNovo.trim()}
            onClick={() =>
              criarDominio.mutate(undefined, {
                onSuccess: () => setNomeNovo(""),
                onError: (e) =>
                  toast.error(e instanceof Error ? e.message : "Não foi possível criar."),
              })
            }
          >
            Criar
          </Button>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl">Seu dia</h2>
        <div className="flex items-center justify-between rounded-2xl border bg-card p-4">
          <div className="pr-4">
            <Label htmlFor="esp">Modo espiritual</Label>
            <p className="text-sm text-muted-foreground">
              Abre o dia com devocional em vez de intenção.
            </p>
          </div>
          <Switch
            id="esp"
            checked={!!profile?.spiritual_mode}
            onCheckedChange={(v) => salvarPerfil.mutate({ spiritual: v })}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="ini">Começo do dia</Label>
            <Input
              id="ini"
              type="time"
              value={inicioDia}
              onChange={(e) => setInicioDia(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fim">Fim do dia</Label>
            <Input
              id="fim"
              type="time"
              value={fimDia}
              onChange={(e) => setFimDia(e.target.value)}
            />
          </div>
        </div>
        <Button
          variant="outline"
          onClick={() =>
            salvarPerfil.mutate({}, { onSuccess: () => toast.success("Horários salvos.") })
          }
        >
          Salvar horários
        </Button>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl">Foco e distração</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="acordar">Horário de acordar</Label>
            <Input
              id="acordar"
              type="time"
              value={acordar}
              onChange={(e) => setAcordar(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="p">Ciclo de foco (min)</Label>
            <Input
              id="p"
              type="number"
              min={30}
              value={pausa}
              onChange={(e) => setPausa(Number(e.target.value))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dp">Duração da pausa (min)</Label>
            <Input
              id="dp"
              type="number"
              min={5}
              value={duracaoPausa}
              onChange={(e) => setDuracaoPausa(Number(e.target.value))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dx">Limite diário de distração (min)</Label>
            <Input
              id="dx"
              type="number"
              min={0}
              value={distracao}
              onChange={(e) => setDistracao(Number(e.target.value))}
            />
          </div>
        </div>
        <h3 className="text-lg">Duração das refeições (min)</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(
            [
              ["cafe", "Café"],
              ["almoco", "Almoço"],
              ["lanche", "Lanche"],
              ["jantar", "Jantar"],
            ] as const
          ).map(([chave, rotulo]) => (
            <div key={chave} className="space-y-2">
              <Label htmlFor={`r-${chave}`}>{rotulo}</Label>
              <Input
                id={`r-${chave}`}
                type="number"
                min={5}
                value={refeicao[chave]}
                onChange={(e) =>
                  setRefeicao((atual) => ({ ...atual, [chave]: Number(e.target.value) }))
                }
              />
            </div>
          ))}
        </div>
        <Button
          variant="outline"
          onClick={() =>
            salvarSettings.mutate(undefined, {
              onSuccess: () => toast.success("Preferências salvas."),
              onError: () => toast.error("Não foi possível salvar."),
            })
          }
        >
          Salvar preferências
        </Button>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl">Aparência</h2>
        <div className="flex items-center justify-between rounded-2xl border bg-card p-4">
          <div className="pr-4">
            <Label htmlFor="tema">Modo escuro</Label>
            <p className="text-sm text-muted-foreground">Para a noite, sem brilho no rosto.</p>
          </div>
          <Switch id="tema" checked={dark} onCheckedChange={toggle} />
        </div>
        <div className="flex items-center justify-between rounded-2xl border bg-card p-4">
          <div className="pr-4">
            <Label htmlFor="sons-guardioes">Sons dos guardiões</Label>
            <p className="text-sm text-muted-foreground">
              Um som curto quando um guardião aparece.
            </p>
          </div>
          <Switch
            id="sons-guardioes"
            checked={settings?.guardian_sounds_enabled ?? true}
            onCheckedChange={(v) => salvarSons.mutate(v)}
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl">Integrações</h2>
        <AgendaIntegracoes />
      </section>

      <section className="space-y-3">
        <Button variant="outline" onClick={sair}>
          <LogOut className="h-4 w-4" /> Sair da conta
        </Button>
      </section>

      <GuardiaoOverlay guardiao={testeGuardiao} onClose={() => setTesteGuardiao(null)} />
    </div>
  );
}
