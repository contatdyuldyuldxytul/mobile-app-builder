import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { completeCalendarConnect } from "@/lib/calendar.functions";

export const Route = createFileRoute("/oauth/agenda/return")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Conectando sua agenda — Redima" },
      { name: "description", content: "Finalizando a conexão da sua agenda com o Redima." },
      { property: "og:title", content: "Conectando sua agenda — Redima" },
      { property: "og:description", content: "Só um instante enquanto terminamos a conexão." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RetornoAgenda,
});

function RetornoAgenda() {
  const [mensagem, setMensagem] = useState("Terminando a conexão…");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const avisar = (type: "agendaOAuthComplete" | "agendaOAuthFailed") => {
      window.opener?.postMessage({ type }, window.location.origin);
      window.close();
    };

    if (params.get("success") !== "true") {
      setMensagem(params.get("error") ?? "A autorização não foi concluída.");
      avisar("agendaOAuthFailed");
      return;
    }
    const code = params.get("code");
    if (!code) {
      if (params.get("offline_access_allowed") === "false") return avisar("agendaOAuthComplete");
      setMensagem("A autorização voltou sem o código de conexão.");
      avisar("agendaOAuthFailed");
      return;
    }
    void completeCalendarConnect({ data: { code } })
      .then(() => avisar("agendaOAuthComplete"))
      .catch(() => {
        setMensagem("Não consegui guardar a conexão.");
        avisar("agendaOAuthFailed");
      });
  }, []);

  return <main className="p-8 text-sm text-muted-foreground">{mensagem}</main>;
}