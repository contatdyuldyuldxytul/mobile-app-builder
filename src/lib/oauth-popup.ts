/** Erro tipado para quando o navegador (ou o preview) impede abrir a janela. */
export class PopupBloqueadoError extends Error {
  readonly noPreview: boolean;
  constructor(noPreview: boolean) {
    super(
      noPreview
        ? "Para conectar sua agenda, abra o app em uma aba separada."
        : "Libere os pop-ups deste site para conectar sua agenda.",
    );
    this.name = "PopupBloqueadoError";
    this.noPreview = noPreview;
  }
}

/** Diz se o app está rodando dentro do preview embutido do editor. */
export function isEmbeddedPreview() {
  try {
    return window.top !== window.self;
  } catch {
    return true;
  }
}

/**
 * Abre uma janela do próprio app como sala de espera. Quem já está logado
 * (a página que chamou) é que pede a URL de autorização e depois manda a
 * janela para lá — assim o popup nunca precisa da sessão.
 */
export function openOAuthPopup(provider?: string) {
  const url = `/oauth/agenda/inicio${provider ? `?provider=${encodeURIComponent(provider)}` : ""}`;
  const popup = window.open(url, "redima-oauth", "width=520,height=680,noopener=no");
  if (!popup) throw new PopupBloqueadoError(isEmbeddedPreview());
  return popup;
}

/** Leva a janela de espera até a tela de consentimento do provedor. */
export function navegarPopup(popup: Window, url: string) {
  popup.location.href = url;
}

/** Abre o app numa aba nova (saída quando o preview bloqueia a janela). */
export function abrirEmNovaAba(path: string) {
  window.open(new URL(path, window.location.origin).toString(), "_blank", "noopener");
}

export function waitForOAuthCompletion(popup: Window) {
  return new Promise<void>((resolve, reject) => {
    let poll: number | undefined;
    const cleanup = () => {
      window.removeEventListener("message", onMessage);
      if (poll !== undefined) window.clearInterval(poll);
    };
    const onMessage = (event: MessageEvent) => {
      const dados = event.data as { type?: string; reason?: string } | undefined;
      const type = dados?.type;
      if (
        event.origin !== window.location.origin ||
        event.source !== popup ||
        (type !== "agendaOAuthComplete" && type !== "agendaOAuthFailed")
      )
        return;
      cleanup();
      if (type === "agendaOAuthComplete") return resolve();
      popup.close();
      reject(new Error(dados?.reason || "O provedor não concluiu a autorização."));
    };
    window.addEventListener("message", onMessage);
    poll = window.setInterval(() => {
      if (!popup.closed) return;
      cleanup();
      reject(new Error("A janela foi fechada antes de terminar."));
    }, 500);
  });
}
