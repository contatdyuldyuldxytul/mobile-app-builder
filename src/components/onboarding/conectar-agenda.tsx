import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarCheck, Link2, Loader2 } from "lucide-react";
import {
  connectIcsCalendar,
  getCalendarProviders,
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
import { detectRoutine, type RawEvent, type RoutinePattern } from "@/lib/routine-detect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type WireEvent = {
  externalId: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  recurring: boolean;
  attendees: number;
};

function paraEventos(wire: WireEvent[]): RawEvent[] {
  return wire.map((e) => ({
    externalId: e.externalId,
    title: e.title,
    start: new Date(e.start),
    end: new Date(e.end),
    allDay: e.allDay,
    recurring: e.recurring,
    attendees: e.attendees,
  }));
}

export function ConectarAgenda({
  conectado,
  onLido,
}: {
  conectado: boolean;
  onLido: (padroes: RoutinePattern[]) => void;
}) {
  const [lendo, setLendo] = useState(false);
  const [mostrarLink, setMostrarLink] = useState(false);
  const [precisaAba, setPrecisaAba] = useState(false);
  const [url, setUrl] = useState("");
  const { data: liberados } = useQuery({
    queryKey: ["calendar-providers"],
    queryFn: () => getCalendarProviders(),
    staleTime: Infinity,
  });

  function processar(eventos: RawEvent[]) {
    const padroes = detectRoutine(eventos);
    onLido(padroes);
    toast.success(
      padroes.length
        ? `Encontrei ${padroes.length} compromisso(s) que se repetem.`
        : "Li sua agenda, mas não achei uma rotina clara ainda.",
    );
  }

  async function conectar(provider: CalendarProvider) {
    let popup: Window;
    try {
      popup = openOAuthPopup();
    } catch (e) {
      if (e instanceof PopupBloqueadoError && e.noPreview) setPrecisaAba(true);
      toast.error(e instanceof Error ? e.message : "Não deu para abrir a janela.");
      return;
    }
    try {
      const { authorizationUrl } = await startCalendarConnect({ data: { provider } });
      navegarPopup(popup, authorizationUrl);
      await waitForOAuthCompletion(popup);
      setLendo(true);
      const { events } = await readCalendarEvents();
      processar(paraEventos(events as WireEvent[]));
    } catch (e) {
      popup.close();
      console.error("Falha ao conectar agenda", e);
      toast.error(e instanceof Error ? e.message : "Não deu para conectar sua agenda.");
    } finally {
      setLendo(false);
    }
  }

  async function conectarLink() {
    if (!url.trim()) return;
    setLendo(true);
    try {
      const { events } = await connectIcsCalendar({ data: { url } });
      processar(paraEventos(events as WireEvent[]));
      setMostrarLink(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não consegui ler esse calendário.");
    } finally {
      setLendo(false);
    }
  }

  if (lendo) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border bg-card p-6">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <p className="text-sm">Lendo sua agenda…</p>
      </div>
    );
  }

  if (conectado) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-primary/40 bg-primary/5 p-5">
        <CalendarCheck className="h-5 w-5 shrink-0 text-primary" />
        <p className="text-sm">Agenda conectada. Já usei o que encontrei para adiantar tudo.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {liberados?.google_calendar ? (
        <Button className="w-full" onClick={() => conectar("google_calendar")}>
          Entrar com o Google
        </Button>
      ) : null}
      {liberados?.microsoft_outlook ? (
        <Button variant="outline" className="w-full" onClick={() => conectar("microsoft_outlook")}>
          Entrar com a Microsoft
        </Button>
      ) : null}
      {precisaAba ? (
        <div className="space-y-3 rounded-2xl border border-primary/40 bg-primary/5 p-4">
          <p className="text-sm">
            Para conectar sua agenda, abra o app em uma aba separada — aqui dentro do editor o
            Google bloqueia a tela de login.
          </p>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => abrirEmNovaAba("/onboarding")}
          >
            Abrir em nova aba
          </Button>
        </div>
      ) : null}

      {liberados && !liberados.google_calendar && !liberados.microsoft_outlook ? (
        <p className="text-sm text-muted-foreground">
          Conexão direta com Google e Microsoft ainda não está liberada. Use o link do seu
          calendário abaixo — ou siga sem agenda.
        </p>
      ) : null}

      {mostrarLink ||
      precisaAba ||
      (liberados && !liberados.google_calendar && !liberados.microsoft_outlook) ? (
        <div className="space-y-3 rounded-2xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">
            Cole o endereço do seu calendário — o app só lê seus compromissos.
          </p>
          <Input
            value={url}
            placeholder="https://…/calendario.ics"
            onChange={(e) => setUrl(e.target.value)}
          />
          <Button className="w-full" onClick={conectarLink}>
            Usar este calendário
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setMostrarLink(true)}
          className="flex w-full items-center justify-center gap-2 text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          <Link2 className="h-4 w-4" /> Uso Apple Calendar ou outra agenda
        </button>
      )}
    </div>
  );
}
