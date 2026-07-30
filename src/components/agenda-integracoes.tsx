import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarCheck, Loader2, RefreshCw } from "lucide-react";
import {
  disconnectCalendar,
  getCalendarProviders,
  listCalendarAccounts,
  readCalendarEvents,
  startCalendarConnect,
  type CalendarProvider,
} from "@/lib/calendar.functions";
import {
  abrirEmNovaAba,
  navegarPopup,
  openOAuthPopup,
  PopupBloqueadoError,
  waitForOAuthCompletion,
} from "@/lib/oauth-popup";
import { Button } from "@/components/ui/button";

const NOMES: Record<string, string> = {
  google_calendar: "Google Agenda",
  microsoft_outlook: "Outlook",
  ics: "Link do calendário",
};

export function AgendaIntegracoes() {
  const qc = useQueryClient();
  const [ocupado, setOcupado] = useState(false);
  const [precisaAba, setPrecisaAba] = useState(false);

  const { data: liberados } = useQuery({
    queryKey: ["calendar-providers"],
    queryFn: () => getCalendarProviders(),
    staleTime: Infinity,
  });
  const { data: contas = [] } = useQuery({
    queryKey: ["calendar-accounts"],
    queryFn: () => listCalendarAccounts(),
  });

  const desconectar = useMutation({
    mutationFn: (accountId: string) => disconnectCalendar({ data: { accountId } }),
    onSuccess: () => {
      toast.success("Agenda desconectada.");
      qc.invalidateQueries({ queryKey: ["calendar-accounts"] });
    },
    onError: () => toast.error("Não consegui desconectar agora."),
  });

  async function conectar(provider: CalendarProvider) {
    let popup: Window;
    try {
      popup = openOAuthPopup();
    } catch (e) {
      if (e instanceof PopupBloqueadoError && e.noPreview) setPrecisaAba(true);
      toast.error(e instanceof Error ? e.message : "Não deu para abrir a janela.");
      return;
    }
    setOcupado(true);
    try {
      const { authorizationUrl } = await startCalendarConnect({ data: { provider } });
      navegarPopup(popup, authorizationUrl);
      await waitForOAuthCompletion(popup);
      await qc.invalidateQueries({ queryKey: ["calendar-accounts"] });
      toast.success("Agenda conectada.");
    } catch (e) {
      popup.close();
      console.error("Falha ao conectar agenda", e);
      toast.error(e instanceof Error ? e.message : "Não deu para conectar sua agenda.");
    } finally {
      setOcupado(false);
    }
  }

  async function sincronizar() {
    setOcupado(true);
    try {
      const { events, falhas } = await readCalendarEvents();
      if (falhas.length) toast.error(`Não consegui ler: ${falhas.join(", ")}`);
      else toast.success(`Li ${events.length} compromisso(s) das últimas semanas.`);
      await qc.invalidateQueries({ queryKey: ["calendar-accounts"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não consegui ler sua agenda.");
    } finally {
      setOcupado(false);
    }
  }

  const jaTem = (p: string) => contas.some((c) => c.provider === p);

  return (
    <div className="space-y-3">
      {contas.map((conta) => (
        <div
          key={conta.id}
          className="flex items-center justify-between gap-3 rounded-2xl border bg-card p-4"
        >
          <div className="flex items-center gap-3">
            <CalendarCheck className="h-5 w-5 shrink-0 text-primary" />
            <div>
              <p>{conta.label ?? NOMES[conta.provider] ?? conta.provider}</p>
              <p className="text-sm text-muted-foreground">
                {conta.last_synced_at
                  ? `Lida em ${new Date(conta.last_synced_at).toLocaleDateString("pt-BR")}`
                  : "Conectada — só leitura"}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            disabled={desconectar.isPending}
            onClick={() => desconectar.mutate(conta.id)}
          >
            Desconectar
          </Button>
        </div>
      ))}

      {precisaAba ? (
        <div className="space-y-3 rounded-2xl border border-primary/40 bg-primary/5 p-4">
          <p className="text-sm">
            Para conectar sua agenda, abra o app em uma aba separada — aqui dentro do editor o
            Google bloqueia a tela de login.
          </p>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => abrirEmNovaAba("/configuracoes")}
          >
            Abrir em nova aba
          </Button>
        </div>
      ) : null}

      {liberados?.google_calendar && !jaTem("google_calendar") ? (
        <Button className="w-full" disabled={ocupado} onClick={() => conectar("google_calendar")}>
          {ocupado ? <Loader2 className="h-4 w-4 animate-spin" /> : "Conectar com o Google"}
        </Button>
      ) : null}
      {liberados?.microsoft_outlook && !jaTem("microsoft_outlook") ? (
        <Button
          variant="outline"
          className="w-full"
          disabled={ocupado}
          onClick={() => conectar("microsoft_outlook")}
        >
          Conectar com a Microsoft
        </Button>
      ) : null}

      {contas.length ? (
        <Button variant="outline" className="w-full" disabled={ocupado} onClick={sincronizar}>
          <RefreshCw className="h-4 w-4" /> Reler minha agenda
        </Button>
      ) : null}

      <p className="text-sm text-muted-foreground">
        A conexão é de mão única: o app só lê seus compromissos, nunca escreve na sua agenda.
      </p>
    </div>
  );
}
