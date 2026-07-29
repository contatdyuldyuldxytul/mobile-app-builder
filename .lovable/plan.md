## Objetivo

Estabelecer a fundação completa do app de gestão de tempo baseado em *Redima o seu Tempo*: modelo de dados personalizável, autenticação, onboarding e as 7 telas navegáveis com o fluxo principal funcionando (meta mensal → orçamento semanal → blocos do dia → check-in).

Projeto está vazio (template inicial), então tudo é construção nova.

## 1. Backend e autenticação

Ativar o Lovable Cloud (banco, auth, RLS) e criar:

- **Auth**: e-mail/senha + Sign in with Google (o mesmo login que depois servirá para o Google Agenda).
- **Tabelas** (todas com `user_id` + RLS restrita ao dono):
  `profiles`, `life_domains`, `monthly_plans`, `goals`, `weekly_plans`, `time_budgets`, `time_blocks`, `daily_plans`, `daily_checkins`, `habits`, `habit_logs`, `focus_sessions`, `settings`.
- Campos preparados para o futuro: `time_blocks.google_event_id`, preferências de notificação em `profiles`.
- Nenhum enum de categoria fixo: os domínios de vida são linhas criadas pelo usuário; metas, orçamentos e blocos referenciam `domain_id`.
- Trigger para criar `profiles` + `settings` (pausa padrão 120 min) no cadastro.
- Sem dados de exemplo — o banco começa vazio e é preenchido pelo onboarding.

## 2. Onboarding

Após o primeiro login: 2 passos curtos — criar os primeiros domínios da vida (nome + cor, com sugestões apenas como atalho clicável, nada gravado automaticamente) e escolher modo espiritual on/off. Depois vai para o Dashboard.

## 3. As 7 telas

Navegação: barra inferior no celular, barra lateral no desktop.

| Tela | Conteúdo desta fase |
|---|---|
| **Hoje** | Intenção/âncora do dia, blocos de hoje, próximo bloco, hábitos do dia, timer de foco com contagem para a pausa de 2h, progresso do orçamento da semana |
| **Mensal** | Calendário do mês, metas pessoais/profissionais por domínio, prioridade/sequência |
| **Semanal** | Alocação de horas por domínio com barra de horas livres × comprometidas e aviso de overcommit |
| **Diária** | Agenda em blocos de tempo, criar/editar bloco, marcar bloco de foco |
| **Hábitos** | Lista de hábitos, marcação diária, streaks |
| **Revisão** | Check-in de fim de dia (cumpriu o combinado, reflexão, energia 1-5) e revisão semanal planejado × realizado por domínio |
| **Configurações** | Domínios da vida (CRUD), modo espiritual, horários do dia, intervalo de pausa, limite de distração, botão "Conectar Google Agenda" desabilitado ("em breve") |

## 4. Fluxo funcional entregue

Criar meta mensal → alocar orçamento de tempo semanal com aviso de overcommit → criar blocos no dia → check-in de fim de dia.

## 5. Design

Interface calma e espaçosa, tipografia legível, sem gamificação ansiosa, cores vindas dos domínios do usuário, modo claro e escuro. Mobile-first de verdade.

## Fora de escopo agora

App nativo, Apple Watch, push, e a sincronização com o Google Agenda (apenas preparada no modelo e na UI).

## Notas técnicas

- Stack fixa do projeto: TanStack Start + React + Tailwind + shadcn/ui.
- Rotas protegidas sob o layout autenticado; `/` público com CTA de login.
- Leituras/escritas do usuário via cliente autenticado com RLS; nenhum dado global.
- Detox de dopamina e gráficos de orçamento × realizado entram após a fundação, nos próximos prompts.
