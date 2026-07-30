/**
 * Lembretes do app. Nesta fase (web/PWA) usamos notificações locais disparadas
 * pelo service worker enquanto o app está instalado ou aberto — sem servidor de
 * push. O caminho fica aberto para push nativo depois.
 */

export type RitualPrefs = {
  morning: string; // HH:MM
  evening: string;
  breaks: boolean;
  breakInterval: number;
};

const CHAVE = "redima:rituais";

export function loadRituals(): RitualPrefs | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CHAVE);
    return raw ? (JSON.parse(raw) as RitualPrefs) : null;
  } catch {
    return null;
  }
}

export function saveRituals(prefs: RitualPrefs) {
  localStorage.setItem(CHAVE, JSON.stringify(prefs));
}

export function notificationsSupported() {
  return typeof window !== "undefined" && "Notification" in window;
}

/** iPhone só entrega notificação web quando o app está na tela de início. */
export function isIosNeedsInstall() {
  if (typeof navigator === "undefined") return false;
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const instalado =
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as { standalone?: boolean }).standalone === true;
  return ios && !instalado;
}

export async function requestNotificationPermission() {
  if (!notificationsSupported()) return "unsupported" as const;
  if (Notification.permission === "granted") return "granted" as const;
  const r = await Notification.requestPermission();
  return r;
}

async function show(title: string, body: string, tag: string) {
  if (!notificationsSupported() || Notification.permission !== "granted") return;
  const reg = await navigator.serviceWorker?.getRegistration();
  if (reg) {
    await reg.showNotification(title, { body, tag, icon: "/icone.png", badge: "/icone.png" });
  } else {
    new Notification(title, { body, tag });
  }
}

function minutosAgora() {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

function paraMinutos(hhmm: string) {
  const [h, m] = hhmm.slice(0, 5).split(":").map(Number);
  return h * 60 + m;
}

function jaAvisouHoje(chave: string) {
  const hoje = new Date().toDateString();
  return localStorage.getItem(`redima:aviso:${chave}`) === hoje;
}

function marcarAviso(chave: string) {
  localStorage.setItem(`redima:aviso:${chave}`, new Date().toDateString());
}

/** Verifica os rituais do dia; chamada periodicamente enquanto o app está ativo. */
export async function runRitualTick() {
  const prefs = loadRituals();
  if (!prefs) return;
  const agora = minutosAgora();

  if (agora >= paraMinutos(prefs.morning) && agora < paraMinutos(prefs.morning) + 90) {
    if (!jaAvisouHoje("manha")) {
      marcarAviso("manha");
      await show("Bom dia", "Dê uma olhada no seu dia — ele já está montado.", "manha");
    }
  }
  if (agora >= paraMinutos(prefs.evening) && agora < paraMinutos(prefs.evening) + 120) {
    if (!jaAvisouHoje("noite")) {
      marcarAviso("noite");
      await show("Check-in da noite", "Confirme como foi o seu dia em um toque.", "noite");
    }
  }
  const domingo = new Date().getDay() === 0;
  if (domingo && agora >= paraMinutos(prefs.evening) && !jaAvisouHoje("semanal")) {
    marcarAviso("semanal");
    await show("Revisão da semana", "Cinco minutos para orçar a semana que vem.", "semanal");
  }
}

export async function notifyBreak(minutos: number) {
  await show(
    "Hora de uma pausa",
    `Você já foram ${minutos} minutos de foco. Levante, respire — e confirme o bloco anterior.`,
    "pausa",
  );
}
