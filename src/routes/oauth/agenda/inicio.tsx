import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { startCalendarConnect, type CalendarProvider } from "@/lib/calendar.functions";

export const Route = createFileRoute("/oauth/agenda/inicio")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Abrindo o login da sua agenda — Redima" },
      { name: "description", content: "Levando você até a tela de autorização da sua agenda." },
      { property: "og:title", content: "Abrindo o login da sua agenda — Redima" },
      { property: "og:description", content: "Só um instante enquanto abrimos a autorização." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: InicioAgenda,
});

function InicioAgenda() {
  const [mensagem, setMensagem] = useState("Abrindo a tela de autorização…");

  useEffect(() => {
    const provider = new URLSearchParams(window.location.search).get("provider");
    const falhar = (texto: string, motivo?: unknown) => {
      if (motivo) console.error("Falha ao iniciar conexão de agenda", motivo);
      setMensagem(texto);
      window.opener?.postMessage(
        { type: "agendaOAuthFailed", reason: texto },
        window.location.origin,
      );
    };

    if (provider !== "google_calendar" && provider !== "microsoft_outlook") {
      falhar("Provedor de agenda inválido.");
      return;
    }

    void startCalendarConnect({ data: { provider: provider as CalendarProvider } })
      .then(({ authorizationUrl }) => {
        window.location.href = authorizationUrl;
      })
      .catch((e) =>
        falhar(e instanceof Error ? e.message : "Não consegui abrir a autorização.", e),
      );
  }, []);

  return <main className="p-8 text-sm text-muted-foreground">{mensagem}</main>;
}