## O que está acontecendo

O erro `accounts.google.com está bloqueado — ERR_BLOCKED_BY_RESPONSE` não vem do seu cliente OAuth: vem do **preview do Lovable**. O app roda dentro de um iframe restrito, e a janelinha aberta a partir dele herda essas restrições. O Google se recusa a exibir a tela de login em qualquer janela nessas condições — daí a conexão recusada.

Confirmei que o app está mesmo rodando dentro de um iframe e que a abertura de janelas é bloqueada nesse contexto.

Ou seja: o fluxo em si provavelmente está certo; o ambiente é que atrapalha. Numa aba normal (preview aberto em nova aba ou app publicado) a tela do Google deve aparecer.

## O que vou fazer

**1. Abrir o consentimento por uma página do próprio app**
Em vez de mandar a janela direto para o Google, a janela abre primeiro numa rota nossa (`/oauth/agenda/inicio`) e só de lá segue para o Google. Isso remove parte das restrições herdadas e é o caminho mais confiável.

**2. Detectar o preview e orientar em vez de dar erro feio**
Quando o app estiver dentro do iframe do editor e a janela for bloqueada, mostro um aviso claro em português: "Para conectar sua agenda, abra o app em uma aba separada", com um botão que abre o app em nova aba já no passo da agenda — em vez da mensagem genérica "Não deu para conectar sua agenda".

**3. Mensagens de erro reais**
Hoje qualquer falha vira o mesmo texto. Vou diferenciar: janela bloqueada, autorização recusada pelo Google, e falha ao guardar a conexão — cada uma com o texto certo e o motivo técnico no console para eu conseguir depurar.

**4. Manter o link .ics como saída rápida**
A opção "Uso Apple Calendar ou outra agenda" continua visível também quando o Google está liberado, para quem não quiser passar pelo popup.

## Um passo que depende de você

No Google Cloud, no cliente OAuth usado por este app, o endereço abaixo precisa estar em "URIs de redirecionamento autorizados":

```text
https://connector-gateway.lovable.dev/api/v1/app-users/oauth2/callback
```

Se isso não estiver lá, mesmo fora do preview o Google recusa. Depois do ajuste eu testo o fluxo ponta a ponta.

## Detalhes técnicos

- Nova rota `src/routes/oauth/agenda/inicio.tsx` (`ssr: false`): recebe o provedor, chama `startCalendarConnect` e navega a própria janela para a `authorizationUrl`.
- `src/lib/oauth-popup.ts`: `openOAuthPopup` passa a abrir essa rota do mesmo domínio, expõe um erro tipado quando `window.open` retorna `null` e um helper `isEmbeddedPreview()`.
- `src/components/onboarding/conectar-agenda.tsx` e `src/components/agenda-integracoes.tsx`: tratam o erro tipado, mostram o aviso com botão "Abrir em nova aba" e logam o erro original.
- Nenhuma mudança no banco, nas server functions de leitura de agenda ou no modelo de cascata.
