import type { RawEvent } from "./routine-detect";

/** Desdobra as linhas quebradas do formato iCalendar. */
function unfold(text: string) {
  return text.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "");
}

function parseIcsDate(value: string, params: string) {
  const utc = value.endsWith("Z");
  const limpo = value.replace(/Z$/, "");
  const allDay = /VALUE=DATE(?!-TIME)/.test(params) || limpo.length === 8;
  const y = Number(limpo.slice(0, 4));
  const mo = Number(limpo.slice(4, 6)) - 1;
  const d = Number(limpo.slice(6, 8));
  const h = Number(limpo.slice(9, 11) || 0);
  const mi = Number(limpo.slice(11, 13) || 0);
  const date = utc ? new Date(Date.UTC(y, mo, d, h, mi)) : new Date(y, mo, d, h, mi);
  return { date, allDay };
}

/** Parser enxuto de .ics: só o que o app precisa para deduzir rotina. */
export function parseIcs(raw: string): RawEvent[] {
  const linhas = unfold(raw).split(/\r?\n/);
  const eventos: RawEvent[] = [];
  let atual: Record<string, { value: string; params: string }> | null = null;
  let participantes = 0;

  for (const linha of linhas) {
    if (linha.startsWith("BEGIN:VEVENT")) {
      atual = {};
      participantes = 0;
      continue;
    }
    if (linha.startsWith("END:VEVENT")) {
      if (atual?.DTSTART && atual?.DTEND) {
        const inicio = parseIcsDate(atual.DTSTART.value, atual.DTSTART.params);
        const fim = parseIcsDate(atual.DTEND.value, atual.DTEND.params);
        eventos.push({
          externalId: atual.UID?.value ?? `${atual.DTSTART.value}-${atual.SUMMARY?.value ?? ""}`,
          title: atual.SUMMARY?.value ?? "",
          start: inicio.date,
          end: fim.date,
          allDay: inicio.allDay,
          recurring: !!atual.RRULE,
          attendees: participantes,
        });
      }
      atual = null;
      continue;
    }
    if (!atual) continue;
    const sep = linha.indexOf(":");
    if (sep < 0) continue;
    const chaveCompleta = linha.slice(0, sep);
    const value = linha.slice(sep + 1).trim();
    const [nome, ...params] = chaveCompleta.split(";");
    if (nome === "ATTENDEE") {
      participantes += 1;
      continue;
    }
    atual[nome] = { value, params: params.join(";") };
  }

  return eventos;
}

/** Expande eventos recorrentes semanais simples dentro da janela informada. */
export function expandWeekly(events: RawEvent[], desde: Date, ate: Date): RawEvent[] {
  const saida: RawEvent[] = [];
  for (const e of events) {
    if (e.start >= desde && e.start <= ate) saida.push(e);
    if (!e.recurring) continue;
    const passo = 7 * 24 * 60 * 60 * 1000;
    const duracao = e.end.getTime() - e.start.getTime();
    let t = e.start.getTime();
    while (t < desde.getTime()) t += passo;
    while (t <= ate.getTime()) {
      saida.push({ ...e, start: new Date(t), end: new Date(t + duracao) });
      t += passo;
    }
  }
  return saida;
}
