import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useDomains, useProfile, useSaveMutation, useSettings } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Link } from "@tanstack/react-router";
import { Archive } from "lucide-react";
import { AgendaIntegracoes } from "@/components/agenda-integracoes";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  head: () => ({
    meta: [
      { title: "Ajustes — Redima" },
      { name: "description", content: "Áreas da vida, modo espiritual, pausas e limites." },
      { property: "og:title", content: "Ajustes — Redima" },
      { property: "og:description", content: "Personalize o app do seu jeito." },
    ],
  }),
  component: Configuracoes,
});

const CORES = ["#6b8f71", "#a8763e", "#5b7fa6", "#a35c5c", "#7a6ba8", "#4f7d6e"];

function Configuracoes() {
  const { data: profile } = useProfile();
  const { data: settings } = useSettings();
  const { data: domains = [] } = useDomains();

  const [nomeNovo, setNomeNovo] = useState("");
  const [corNova, setCorNova] = useState(CORES[0]);
  const [inicioDia, setInicioDia] = useState("06:00");
  const [fimDia, setFimDia] = useState("22:00");
  const [pausa, setPausa] = useState(120);
  const [distracao, setDistracao] = useState(60);

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
    }
  }, [settings]);

  const criarDominio = useSaveMutation<void>(async (_v, userId) => {
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
  }, ["domains"]);

  const atualizarDominio = useSaveMutation<{ id: string; color?: string; is_archived?: boolean }>(
    async ({ id, ...patch }) => {
      const { error } = await supabase.from("life_domains").update(patch).eq("id", id);
      if (error) throw error;
    },
    ["domains"],
  );

  const salvarPerfil = useSaveMutation<{ spiritual?: boolean }>(async ({ spiritual }, userId) => {
    const { error } = await supabase
      .from("profiles")
      .update({
        spiritual_mode: spiritual ?? profile?.spiritual_mode ?? false,
        day_start: inicioDia,
        day_end: fimDia,
      })
      .eq("id", userId);
    if (error) throw error;
  }, ["profile"]);

  const salvarSettings = useSaveMutation<void>(async (_v, userId) => {
    const { error } = await supabase
      .from("settings")
      .upsert(
        {
          user_id: userId,
          break_interval_minutes: pausa,
          distraction_limit_minutes: distracao,
        },
        { onConflict: "user_id" },
      );
    if (error) throw error;
  }, ["settings"]);

  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-4xl">Ajustes</h1>
        <p className="text-sm text-muted-foreground">Tudo aqui é seu — defina do seu jeito.</p>
      </header>

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
              <Button
                variant="ghost"
                size="icon"
                title="Arquivar"
                onClick={() => atualizarDominio.mutate({ id: d.id, is_archived: true })}
              >
                <Archive className="h-4 w-4" />
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
            <Input id="ini" type="time" value={inicioDia} onChange={(e) => setInicioDia(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fim">Fim do dia</Label>
            <Input id="fim" type="time" value={fimDia} onChange={(e) => setFimDia(e.target.value)} />
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
            <Label htmlFor="p">Pausa a cada (min)</Label>
            <Input
              id="p"
              type="number"
              min={15}
              value={pausa}
              onChange={(e) => setPausa(Number(e.target.value))}
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
        <h2 className="text-2xl">Integrações</h2>
        <AgendaIntegracoes />
      </section>
    </div>
  );
}