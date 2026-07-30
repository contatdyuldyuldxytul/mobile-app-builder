import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useProfile, useSaveMutation } from "@/lib/data";
import { todayISO } from "@/lib/dates";
import { celebrate } from "@/lib/celebrate";
import {
  gerarCodigo,
  linkConvite,
  periodoDe,
  useChallengeBoard,
  useMyChallenges,
  type Challenge,
} from "@/lib/challenges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Copy, Flag, Medal, Plus, Trophy, Users } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/desafios")({
  head: () => ({
    meta: [
      { title: "Desafios — Redima" },
      {
        name: "description",
        content: "Convide amigos e dispute quem cumpre mais do próprio dia planejado.",
      },
      { property: "og:title", content: "Desafios — Redima" },
      { property: "og:description", content: "Ranking de constância entre amigos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>) => ({
    codigo: typeof s.codigo === "string" ? s.codigo : undefined,
  }),
  component: Desafios,
});

function Desafios() {
  const { codigo: codigoUrl } = useSearch({ from: "/_authenticated/desafios" });
  const { data: profile } = useProfile();
  const { data: desafios = [], isLoading } = useMyChallenges();
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [criarAberto, setCriarAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [inicio, setInicio] = useState(todayISO());
  const [fim, setFim] = useState(todayISO());
  const [codigo, setCodigo] = useState("");
  const entrouPorLink = useState({ feito: false })[0];

  const criar = useSaveMutation<void>(
    async (_v, userId) => {
      const code = gerarCodigo();
      const { data, error } = await supabase
        .from("challenges")
        .insert({ owner_id: userId, name: nome.trim(), code, start_date: inicio, end_date: fim })
        .select()
        .single();
      if (error) throw error;
      const { error: e2 } = await supabase.from("challenge_members").insert({
        challenge_id: data.id,
        user_id: userId,
        display_name: profile?.display_name ?? null,
      });
      if (e2) throw e2;
      return data;
    },
    ["challenges"],
  );

  const entrar = useSaveMutation<string>(
    async (code) => {
      const { error } = await supabase.rpc("join_challenge_by_code", { _code: code.trim() });
      if (error) throw error;
    },
    ["challenges"],
  );

  useEffect(() => {
    if (!codigoUrl || entrouPorLink.feito) return;
    entrouPorLink.feito = true;
    entrar.mutate(codigoUrl, {
      onSuccess: () => toast.success("Você entrou no desafio."),
      onError: () => toast.error("Código inválido ou expirado."),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codigoUrl]);

  const ativos = desafios.filter((d) => periodoDe(d) !== "encerrado");
  const encerrados = desafios.filter((d) => periodoDe(d) === "encerrado");

  return (
    <div className="space-y-8 pb-20">
      <header>
        <h1 className="text-4xl">Desafios</h1>
        <p className="text-sm text-muted-foreground">
          Chame amigos e vejam quem cumpre mais do próprio dia planejado.
        </p>
      </header>

      <section className="grid gap-2 sm:grid-cols-2">
        <Dialog open={criarAberto} onOpenChange={setCriarAberto}>
          <DialogTrigger asChild>
            <Button size="lg" className="w-full">
              <Plus className="mr-2 h-4 w-4" /> Criar desafio
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90dvh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Novo desafio</DialogTitle>
              <DialogDescription>
                Um período com começo e fim. Vence quem tiver a maior média de dia cumprido.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome</Label>
                <Input
                  id="nome"
                  value={nome}
                  placeholder="Ex.: 30 dias de constância"
                  onChange={(e) => setNome(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="ini">Começa</Label>
                  <Input
                    id="ini"
                    type="date"
                    value={inicio}
                    onChange={(e) => setInicio(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fim">Termina</Label>
                  <Input
                    id="fim"
                    type="date"
                    value={fim}
                    onChange={(e) => setFim(e.target.value)}
                  />
                </div>
              </div>
              <Button
                className="w-full"
                disabled={!nome.trim() || fim < inicio || criar.isPending}
                onClick={() =>
                  criar.mutate(undefined, {
                    onSuccess: () => {
                      setNome("");
                      setCriarAberto(false);
                      celebrate("small");
                      toast.success("Desafio criado. Compartilhe o código com os amigos.");
                    },
                    onError: () => toast.error("Não foi possível criar o desafio."),
                  })
                }
              >
                Criar e gerar código
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <div className="flex gap-2">
          <Input
            value={codigo}
            placeholder="Código do convite"
            className="uppercase"
            onChange={(e) => setCodigo(e.target.value.toUpperCase())}
          />
          <Button
            variant="outline"
            disabled={codigo.trim().length < 4 || entrar.isPending}
            onClick={() =>
              entrar.mutate(codigo, {
                onSuccess: () => {
                  setCodigo("");
                  toast.success("Você entrou no desafio.");
                },
                onError: () => toast.error("Código inválido."),
              })
            }
          >
            Entrar
          </Button>
        </div>
      </section>

      {!isLoading && desafios.length === 0 && (
        <p className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          Nenhum desafio ainda. Crie um e mande o código para quem você quer junto.
        </p>
      )}

      {ativos.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xl">Em andamento</h2>
          {ativos.map((d) => (
            <CartaoDesafio
              key={d.id}
              c={d}
              aberto={selecionado === d.id}
              onAbrir={() => setSelecionado(selecionado === d.id ? null : d.id)}
            />
          ))}
        </section>
      )}

      {encerrados.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xl">Encerrados</h2>
          {encerrados.map((d) => (
            <CartaoDesafio
              key={d.id}
              c={d}
              aberto={selecionado === d.id}
              onAbrir={() => setSelecionado(selecionado === d.id ? null : d.id)}
            />
          ))}
        </section>
      )}
    </div>
  );
}

function CartaoDesafio({
  c,
  aberto,
  onAbrir,
}: {
  c: Challenge;
  aberto: boolean;
  onAbrir: () => void;
}) {
  const { data: placar = [] } = useChallengeBoard(c.id, c.start_date, c.end_date);
  const [meuId, setMeuId] = useState<string | null>(null);
  const estado = periodoDe(c);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMeuId(data.user?.id ?? null));
  }, []);

  const minhaPos = placar.findIndex((p) => p.userId === meuId);

  return (
    <article className="overflow-hidden rounded-2xl border bg-card">
      <button
        type="button"
        onClick={onAbrir}
        className="flex w-full items-center gap-3 p-4 text-left"
      >
        <span
          className={cn(
            "grid h-11 w-11 shrink-0 place-items-center rounded-2xl",
            estado === "ativo" ? "bg-primary text-primary-foreground" : "bg-muted",
          )}
        >
          <Trophy className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold">{c.name}</h3>
          <p className="text-xs text-muted-foreground">
            {c.start_date.split("-").reverse().join("/")} até{" "}
            {c.end_date.split("-").reverse().join("/")} · {estado}
          </p>
        </div>
        <span className="flex shrink-0 items-center gap-1 font-mono text-xs text-muted-foreground">
          <Users className="h-3.5 w-3.5" />
          {placar.length}
        </span>
      </button>

      {aberto && (
        <div className="space-y-4 border-t p-4">
          <div className="flex items-center gap-2 rounded-xl border border-dashed bg-muted/40 px-3 py-2">
            <Flag className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate font-mono text-sm">{c.code}</span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                void navigator.clipboard.writeText(linkConvite(c.code));
                toast.success("Link do convite copiado.");
              }}
            >
              <Copy className="mr-1 h-3.5 w-3.5" /> Copiar
            </Button>
          </div>

          {placar.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Ainda sem placar. Ele aparece conforme vocês concluem os blocos do dia.
            </p>
          ) : (
            <ol className="space-y-2">
              {placar.map((p, i) => (
                <li
                  key={p.userId}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5",
                    p.userId === meuId ? "bg-primary/10" : "bg-muted/40",
                  )}
                >
                  <span
                    className={cn(
                      "grid h-8 w-8 shrink-0 place-items-center rounded-full font-mono text-sm",
                      i === 0 ? "bg-primary text-primary-foreground" : "border",
                    )}
                  >
                    {i < 3 ? <Medal className="h-4 w-4" /> : i + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {p.nome}
                    {p.userId === meuId && " (você)"}
                  </span>
                  <span className="shrink-0 text-right font-mono text-sm">
                    {Math.round(p.media)}%
                    <span className="block text-[0.65rem] text-muted-foreground">
                      {p.dias} dia(s)
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          )}

          {minhaPos === 0 && placar.length > 1 && (
            <p className="text-sm text-primary">Você está na liderança. Segura o ritmo. 🏆</p>
          )}
        </div>
      )}
    </article>
  );
}
