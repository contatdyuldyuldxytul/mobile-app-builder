import { callAsAppUser } from "@/integrations/lovable/appUserConnector";
import { parseIcs, expandWeekly } from "@/lib/ics";

export const GATEWAY_BASE_URL = "https://connector-gateway.lovable.dev";

export type WireEvent = {
  externalId: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  recurring: boolean;
  attendees: number;
};

export function clientApiKeyEnv(connectorId: string) {
  const nome = `${connectorId.toUpperCase()}_APP_USER_CONNECTOR_CLIENT_API_KEY`;
  return { nome, valor: process.env[nome] };
}

export async function fetchGoogleEvents(
  connectionAPIKey: string,
  desde: Date,
  ate: Date,
): Promise<WireEvent[]> {
  const query = new URLSearchParams({
    timeMin: desde.toISOString(),
    timeMax: ate.toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "500",
  });
  const res = await callAsAppUser({
    gatewayBaseUrl: GATEWAY_BASE_URL,
    connectionAPIKey,
    connectorId: "google_calendar",
    path: `/calendar/v3/calendars/primary/events?${query.toString()}`,
  });
  if (!res.ok) {
    throw new Error(`Google Agenda respondeu ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  const body = (await res.json()) as {
    items?: {
      id: string;
      summary?: string;
      recurringEventId?: string;
      attendees?: unknown[];
      start?: { dateTime?: string; date?: string };
      end?: { dateTime?: string; date?: string };
    }[];
  };
  return (body.items ?? [])
    .filter((e) => e.start && e.end)
    .map((e) => ({
      externalId: e.recurringEventId ?? e.id,
      title: e.summary ?? "",
      start: e.start!.dateTime ?? `${e.start!.date}T00:00:00`,
      end: e.end!.dateTime ?? `${e.end!.date}T00:00:00`,
      allDay: !e.start!.dateTime,
      recurring: !!e.recurringEventId,
      attendees: e.attendees?.length ?? 0,
    }));
}

export async function fetchOutlookEvents(
  connectionAPIKey: string,
  desde: Date,
  ate: Date,
): Promise<WireEvent[]> {
  const query = new URLSearchParams({
    startDateTime: desde.toISOString(),
    endDateTime: ate.toISOString(),
    $top: "500",
    $select: "id,subject,start,end,isAllDay,seriesMasterId,attendees",
  });
  const res = await callAsAppUser({
    gatewayBaseUrl: GATEWAY_BASE_URL,
    connectionAPIKey,
    connectorId: "microsoft_outlook",
    path: `/me/calendarView?${query.toString()}`,
    init: { headers: { Prefer: 'outlook.timezone="UTC"' } },
  });
  if (!res.ok) {
    throw new Error(`Outlook respondeu ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  const body = (await res.json()) as {
    value?: {
      id: string;
      subject?: string;
      isAllDay?: boolean;
      seriesMasterId?: string;
      attendees?: unknown[];
      start?: { dateTime: string };
      end?: { dateTime: string };
    }[];
  };
  return (body.value ?? [])
    .filter((e) => e.start && e.end)
    .map((e) => ({
      externalId: e.seriesMasterId ?? e.id,
      title: e.subject ?? "",
      start: `${e.start!.dateTime.replace(/Z?$/, "")}Z`,
      end: `${e.end!.dateTime.replace(/Z?$/, "")}Z`,
      allDay: !!e.isAllDay,
      recurring: !!e.seriesMasterId,
      attendees: e.attendees?.length ?? 0,
    }));
}

export async function fetchIcsEvents(url: string, desde: Date, ate: Date): Promise<WireEvent[]> {
  const normalizada = url.replace(/^webcal:\/\//i, "https://");
  const res = await fetch(normalizada, { headers: { Accept: "text/calendar, text/plain" } });
  if (!res.ok) throw new Error(`Não consegui ler esse link (${res.status}).`);
  const texto = await res.text();
  if (!texto.includes("BEGIN:VCALENDAR")) {
    throw new Error("Esse link não parece ser um calendário.");
  }
  return expandWeekly(parseIcs(texto), desde, ate).map((e) => ({
    externalId: e.externalId,
    title: e.title,
    start: e.start.toISOString(),
    end: e.end.toISOString(),
    allDay: e.allDay,
    recurring: e.recurring,
    attendees: e.attendees,
  }));
}
