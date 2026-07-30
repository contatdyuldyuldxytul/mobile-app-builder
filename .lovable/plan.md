## Objetivo

Refazer o onboarding para que, em menos de 1 minuto, a pessoa saia com âncoras definidas, orçamento das 168h, Semana Ideal montada e lembretes ativos — com a rotina **lida da agenda dela**, não digitada.

Decisões confirmadas: leitura da agenda (importação para o app, sem escrever de volta nesta versão), classificação **por regras** (sem IA), entrega completa de uma vez.

## 1. Conexão com a agenda

- **Google Agenda (prioridade):** conexão por login, um clique, via o conector de usuário final do Lovable para Google Calendar (cada pessoa autoriza a própria conta). Requer eu ativar o cliente do conector no projeto — aparecerá um cartão de aprovação para você.
- **Outlook/Microsoft:** mesmo mecanismo, segunda opção.
- **Apple/outras:** campo para colar o "link de assinatura do calendário" (arquivo .ics), explicado como *"cole o link do seu calendário — o app só lê seus compromissos"*.
- **"Conectar depois"** sempre visível; o fluxo inteiro funciona sem agenda.
- Reimportação: botão "Atualizar da agenda" em Ajustes e releitura automática periódica, para mudanças na agenda chegarem ao app.

## 2. Dedução da rotina ("Lendo sua agenda…")

Ao conectar, o app lê as últimas ~4 semanas e, em background curto:

1. **Detecta recorrência:** agrupa eventos por título normalizado + dia da semana + faixa de horário; considera rotina o que aparece em pelo menos 2 das últimas 4 semanas (ou eventos marcados como recorrentes).
2. **Classifica por área** com um dicionário de regras em português e inglês (reunião/cliente/1:1/proposta → Trabalho; treino/academia/médico/consulta → Saúde; culto/igreja/célula → Fé; aula/curso/prova → Estudos; jantar/aniversário/escola → Família; viagem/deslocamento → Deslocamento; etc.), mais sinais do próprio evento (participantes, all-day, fim de semana). Sem correspondência confiável → **"a classificar"**, nunca chute.
3. **Soma horas por área/semana** → vira a sugestão inicial do orçamento.
4. **Monta os blocos da Semana Ideal** a partir dos padrões recorrentes.

Nada de rotina fictícia: se não houver agenda, os passos seguem com sliders vazios/neutros e o usuário escolhe.

## 3. Os 6 passos do onboarding

1. **Conta e agenda** — login + conectar agenda, com a frase de benefício. Pular disponível.
2. **Âncoras (momento "uau")** — dois sliders (sono/noite, trabalho/dia) pré-preenchidos pelo que foi detectado, com o contador em destaque em tempo real: *"Sua semana tem 168 horas. Você já comprometeu X. Sobram Y livres."*
3. **Áreas da vida** — chips pré-marcados pelo que a agenda mostrou (Trabalho, Saúde, Família, Estudos, Descanso, Fé, Amigos, Finanças, Lazer), 4 a 6, criar a sua, sem duplicar áreas já existentes.
4. **Distribuir as horas livres** — sliders por área pré-preenchidos com o tempo real detectado, contador "não alocado / excedido" e trava nas 168h.
5. **Confirmar a Semana Ideal** — grade já montada; arrastar, apagar e resolver os "a classificar" em um toque. Sem agenda, os blocos vêm do orçamento do passo 4.
6. **Rituais** — horário do check-in da manhã e da noite (padrões sensatos) + lembrete de pausa de 2h. **Só aqui** se pede permissão de notificação.

Barra de progresso, voltar e pular em todos os passos. Fim → cai direto no **Hoje** já preenchido.

## 4. Registro em 1 toque

- Cada bloco do dia vira: **fiz / não fiz / foi diferente**; só "foi diferente" abre ajuste de horário/área.
- O lembrete de pausa de 2h também pergunta pelo bloco anterior.
- "Ficou dias sem abrir" → tela de acerto rápido **por área** (ex.: "Trabalho: as 5 horas de terça aconteceram?"), nunca bloco a bloco.
- Linguagem sempre positiva: celebra consistência, sem "sequência quebrada".

## 5. Notificações

PWA com service worker e notificações push (Web Push): check-in da manhã, pausa de 2h, check-in da noite e revisão semanal, agendadas conforme os horários escolhidos. No iPhone, exige adicionar à tela de início — o app explica isso em uma frase, no momento em que a pessoa liga os lembretes.

## Detalhes técnicos

- Novas tabelas: `app_user_connections` (chave de conexão criptografada, só servidor), `calendar_accounts` (provedor, status, última sincronização), `calendar_events_cache` (eventos brutos das últimas semanas), `routine_patterns` (padrão recorrente + área sugerida + confiança), `notification_subscriptions` e `block_confirmations`. Todas com RLS por usuário e GRANTs.
- OAuth por usuário via `createServerFn` + gateway de conectores (popup, troca de código no servidor, chave nunca no browser). ICS lido e parseado no servidor.
- Motor de dedução em `src/lib/routine-detect.ts` (recorrência) e `src/lib/classify.ts` (regras), ambos puros e testáveis.
- Onboarding reescrito em passos componentizados, reaproveitando `ensureAnchorDomains`, `WEEK_HOURS` e a cascata existente (âncoras → orçamento → `ideal_week_blocks` → `time_blocks`).
- Push agendado por uma rota `/api/public/*` disparada por cron, com verificação de assinatura.
