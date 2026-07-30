// Service worker mínimo: só habilita notificações locais do app instalado.
// Sem cache offline — navegação e OAuth sempre vão à rede.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      const aberto = clientList.find((c) => "focus" in c);
      if (aberto) return aberto.focus();
      return self.clients.openWindow("/hoje");
    }),
  );
});