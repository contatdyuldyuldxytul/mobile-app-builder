/** Abre o popup de consentimento e espera o retorno da própria origem. */
export function openOAuthPopup() {
  const popup = window.open("", "redima-oauth", "width=520,height=680");
  if (!popup) throw new Error("Libere os pop-ups para conectar sua agenda.");
  return popup;
}

export function waitForOAuthCompletion(popup: Window) {
  return new Promise<void>((resolve, reject) => {
    let poll: number | undefined;
    const cleanup = () => {
      window.removeEventListener("message", onMessage);
      if (poll !== undefined) window.clearInterval(poll);
    };
    const onMessage = (event: MessageEvent) => {
      const type = (event.data as { type?: string })?.type;
      if (
        event.origin !== window.location.origin ||
        event.source !== popup ||
        (type !== "agendaOAuthComplete" && type !== "agendaOAuthFailed")
      )
        return;
      cleanup();
      if (type === "agendaOAuthComplete") return resolve();
      popup.close();
      reject(new Error("Não deu para concluir a conexão."));
    };
    window.addEventListener("message", onMessage);
    poll = window.setInterval(() => {
      if (!popup.closed) return;
      cleanup();
      reject(new Error("A janela foi fechada antes de terminar."));
    }, 500);
  });
}