## Resposta curta

Sim — mas o "entrar com Google" que já existe no app serve só para **identidade** (nome/e-mail). Ele não dá permissão para ler a agenda. Para ler a agenda de cada usuário com um clique, é preciso ativar o conector Google Calendar por usuário. O usuário continua fazendo só um login/autorização no popup do Google — nada de copiar link .ics.

## O que vou fazer

1. **Ativar o conector Google Calendar** (cartão de aprovação no chat, você escolhe/cria o cliente OAuth do Google uma vez). Sem esse passo o botão continua escondido.
2. **Fluxo de conexão por usuário**
   - Botão "Conectar Google Agenda" no onboarding e nas Configurações.
   - Abre popup → usuário autoriza → volta para uma tela de retorno que finaliza a conexão.
   - Escopos pedidos: perfil/e-mail + leitura da agenda (somente leitura, mão única).
3. **Armazenamento seguro**: a credencial de cada usuário fica guardada criptografada no backend, ligada à conta dele. Nada de token no navegador.
4. **Leitura da agenda**: função no servidor busca os eventos das próximas semanas e alimenta a detecção de rotina que já existe (`routine-detect.ts` + `classify.ts`), preenchendo a Semana Ideal.
5. **Estados de interface**: conectado / não conectado / desconectar, além do fallback por link .ics que já existe.

## Detalhes técnicos

- `connector_app_user--connect_client` com `connector_id: google_calendar`; redirect URI do gateway Lovable no console do Google.
- Novo helper server-only `src/integrations/lovable/appUserConnector.ts`.
- Nova tabela `app_user_connections` (user_id, connector_id, chave criptografada) com acesso apenas via service role.
- Server functions: iniciar OAuth, trocar o código pela chave, listar eventos (`/calendar/v3/calendars/primary/events`), desconectar.
- Rota de retorno `src/routes/oauth/google-calendar/return.tsx`.
- Atualização de `src/lib/calendar.functions.ts` e `src/components/onboarding/conectar-agenda.tsx` para usar o fluxo real.

## Observação

O Outlook exigiria o mesmo processo separadamente — posso deixar só o Google agora e adicionar o Microsoft depois, se quiser.
