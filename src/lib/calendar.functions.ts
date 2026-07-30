import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type CalendarProvider = "google_calendar" | "microsoft_outlook";

/** Inicia o login da agenda. Devolve a URL de consentimento para abrir num popup. */
export const startCalendarConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { provider: CalendarProvider }) => {
    if (input?.provider !== "google_calendar" && input?.provider !== "microsoft_outlook") {
      throw new Error("Provedor de agenda inválido.");
    }
    return input;
  })
  .handler(async ({ data, context }) => {
    const { authorizeAppUserOAuth } = await import("@/integrations/lovable/appUserConnector");
    const { clientApiKeyEnv, GATEWAY_BASE_URL } = await import("@/server/calendar.server");
    const { getConnectionKeyForUser } = await import("@/server/appUserConnections.server");

    const { valor: clientAPIKey } = clientApiKeyEnv(data.provider);
    if (!clientAPIKey) {
      throw new Error(
        "Esta agenda ainda não está liberada neste app. Use o link do calendário ou conecte depois.",
      );
    }

    const request = getRequest();
    if (!request) throw new Error("A conexão precisa começar por uma ação no app.");
    const returnUrl = new URL("/oauth/agenda/return", request.url).toString();

    const connectionAPIKey = await getConnectionKeyForUser(context.userId, data.provider);

    const scopes =
      data.provider === "google_calendar"
        ? [
            "https://www.googleapis.com/auth/userinfo.email",
            "https://www.googleapis.com/auth/calendar.readonly",
          ]
        : ["openid", "profile", "email", "offline_access", "Calendars.Read"];

    const { authorizationUrl } = await authorizeAppUserOAuth({
      gatewayBaseUrl: GATEWAY_BASE_URL,
      connectorId: data.provider,
      appUserId: context.userId,
      clientAPIKey,
      returnUrl,
      connectionAPIKey: connectionAPIKey ?? undefined,
      credentialsConfiguration: { scopes },
    });
    return { authorizationUrl };
  });

/** Troca o código de retorno pela credencial da pessoa e registra a conta de agenda. */
export const completeCalendarConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { code: string }) => {
    if (!input?.code) throw new Error("Código ausente.");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { exchangeAppUserOAuthCode } = await import("@/integrations/lovable/appUserConnector");
    const { GATEWAY_BASE_URL } = await import("@/server/calendar.server");
    const { saveConnectionKeyForUser } = await import("@/server/appUserConnections.server");

    const { connectionAPIKey, connectorId } = await exchangeAppUserOAuthCode(
      GATEWAY_BASE_URL,
      data.code,
    );
    if (connectorId !== "google_calendar" && connectorId !== "microsoft_outlook") {
      throw new Error("Conexão devolvida para um serviço inesperado.");
    }
    await saveConnectionKeyForUser(context.userId, connectorId, connectionAPIKey);

    const { error } = await context.supabase.from("calendar_accounts").upsert(
      {
        user_id: context.userId,
        provider: connectorId,
        label: connectorId === "google_calendar" ? "Google Agenda" : "Outlook",
        ics_url: null,
        status: "conectado",
      },
      { onConflict: "user_id,provider,ics_url" },
    );
    if (error) throw error;
    return { provider: connectorId };
  });

/** Valida e registra um link de calendário (.ics / webcal). */
export const connectIcsCalendar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { url: string }) => {
    const url = (input?.url ?? "").trim();
    if (!/^(https?|webcal):\/\//i.test(url) || url.length > 2000) {
      throw new Error("Cole o endereço completo do calendário.");
    }
    return { url };
  })
  .handler(async ({ data, context }) => {
    const { fetchIcsEvents } = await import("@/server/calendar.server");
    const agora = new Date();
    const desde = new Date(agora.getTime() - 28 * 24 * 3600 * 1000);
    const eventos = await fetchIcsEvents(data.url, desde, agora);

    const { error } = await context.supabase.from("calendar_accounts").upsert(
      {
        user_id: context.userId,
        provider: "ics",
        label: "Link do calendário",
        ics_url: data.url,
        status: "conectado",
        last_synced_at: new Date().toISOString(),
      },
      { onConflict: "user_id,provider,ics_url" },
    );
    if (error) throw error;
    return { events: eventos };
  });

/** Lê os compromissos das últimas semanas de todas as agendas conectadas. */
export const readCalendarEvents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { fetchGoogleEvents, fetchOutlookEvents, fetchIcsEvents } = await import(
      "@/server/calendar.server"
    );
    const { getConnectionKeyForUser } = await import("@/server/appUserConnections.server");

    const { data: contas, error } = await context.supabase
      .from("calendar_accounts")
      .select("*")
      .eq("status", "conectado");
    if (error) throw error;

    const agora = new Date();
    const desde = new Date(agora.getTime() - 28 * 24 * 3600 * 1000);
    const eventos: Awaited<ReturnType<typeof fetchIcsEvents>> = [];
    const falhas: string[] = [];

    for (const conta of contas ?? []) {
      try {
        if (conta.provider === "ics" && conta.ics_url) {
          eventos.push(...(await fetchIcsEvents(conta.ics_url, desde, agora)));
        } else if (conta.provider === "google_calendar" || conta.provider === "microsoft_outlook") {
          const chave = await getConnectionKeyForUser(context.userId, conta.provider);
          if (!chave) {
            falhas.push(conta.label ?? conta.provider);
            continue;
          }
          eventos.push(
            ...(conta.provider === "google_calendar"
              ? await fetchGoogleEvents(chave, desde, agora)
              : await fetchOutlookEvents(chave, desde, agora)),
          );
        }
        await context.supabase
          .from("calendar_accounts")
          .update({ last_synced_at: new Date().toISOString() })
          .eq("id", conta.id);
      } catch (e) {
        console.error("Falha ao ler agenda", conta.provider, e);
        falhas.push(conta.label ?? conta.provider);
      }
    }

    return { events: eventos, falhas, contas: (contas ?? []).length };
  });

/** Desconecta a agenda da pessoa e apaga a credencial guardada. */
export const disconnectCalendar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { accountId: string }) => {
    if (!input?.accountId) throw new Error("Conta inválida.");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { data: conta } = await context.supabase
      .from("calendar_accounts")
      .select("*")
      .eq("id", data.accountId)
      .maybeSingle();
    if (!conta) return { ok: true };

    if (conta.provider === "google_calendar" || conta.provider === "microsoft_outlook") {
      const { disconnectAppUser } = await import("@/integrations/lovable/appUserConnector");
      const { GATEWAY_BASE_URL } = await import("@/server/calendar.server");
      const { getConnectionKeyForUser, deleteConnectionKeyForUser } = await import(
        "@/server/appUserConnections.server"
      );
      const chave = await getConnectionKeyForUser(context.userId, conta.provider);
      if (chave) {
        try {
          await disconnectAppUser({
            gatewayBaseUrl: GATEWAY_BASE_URL,
            connectionAPIKey: chave,
            connectorId: conta.provider,
          });
        } catch (e) {
          console.error("Falha ao desconectar no gateway", e);
        }
        await deleteConnectionKeyForUser(context.userId, conta.provider);
      }
    }
    await context.supabase.from("calendar_accounts").delete().eq("id", conta.id);
    return { ok: true };
  });