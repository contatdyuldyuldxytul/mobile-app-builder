import { createFileRoute } from "@tanstack/react-router";

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

/**
 * Sala de espera do popup. Quem pede a autorização é a página que abriu esta
 * janela (lá a sessão já está carregada); aqui só aguardamos o redirecionamento.
 */
function InicioAgenda() {
  return <main className="p-8 text-sm text-muted-foreground">Abrindo a tela de autorização…</main>;
}
