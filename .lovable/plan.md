## O que muda

Cinco frentes, todas em cima do que já existe (nada recomeça do zero).

---

### 1. Onboarding com presets

Fluxo em passos curtos, um por tela, mobile-first:

1. **Sono** — "Quantas horas você dorme por noite?" com slider e recomendação visível (7h–8h). Marca as horas em Ajustes e cria a área "Dormir".
2. **Ocupação** — botões grandes: Trabalho / Estudo / Os dois / Nenhum. Depois, horas por dia e quais dias da semana.
3. **Atividades da semana** — grade de presets tocáveis para escolher o que faz além disso: Academia/Exercício, Família, Igreja, Amigos, Estudo pessoal, Leitura, Casa/Tarefas domésticas, Lazer/Descanso, Projeto pessoal, Deslocamento. Cada uma vira uma área da vida com uma sugestão de horas semanais já preenchida (editável).
4. **Onde seu tempo vai hoje** — a pessoa escolhe 1 a 3 dessas áreas como "onde mais gasto tempo hoje"; essas ganham destaque no orçamento inicial.
5. **Hábitos** — lista de sugestões prontas para marcar: Ler a Bíblia, Beber água, Orar, Ler um livro, Exercitar-se, Dormir cedo, Sem celular na primeira hora, Caminhar. Cada uma já vem com dias da semana sugeridos e área da vida vinculada.

Ao final o app grava âncoras, áreas, orçamento inicial e hábitos de uma vez — a pessoa já entra com a semana montada.

### 2. "Hoje" vira o centro do dia

- **Frase do dia** no topo: lista curada dentro do app (~100 frases de autores e pensadores; no modo espiritual, versículos), escolhida de forma estável pela data — a mesma frase o dia todo, muda à meia-noite.
- **Checklist do dia**: uma lista única e tocável com as atividades atribuídas para hoje (tarefas alocadas + hábitos do dia). Cada item mostra duração estimada e área da vida pela cor. Marcar risca o item e grava histórico.
- **Barra de progresso do dia**: "5 de 8 concluídos · 3h20 de 6h".
- **Ciclo de 2 horas e pausa**: uma barra fixa no rodapé mostra o ciclo em andamento. Ao completar 2h de foco acumulado, aparece um aviso gentil "Hora de pausar — 15 min" com botões *Pausar agora* / *Mais 10 min*. O tempo de pausa é registrado.
- A aba **Diária** deixa de existir; a grade de horários com arrastar/soltar sai. O que era time-blocking vira essa lista ordenada do dia (com horários sugeridos exibidos como texto, não como grade).

### 3. Aba "Semana" mais clara

Uma tela só, com duas seções em vez de três abas confusas:

**A. Quanto tempo em cada área** (o orçamento)
Cada área ganha uma linha com:
- horas por semana (input + slider, como já é),
- **tradução automática**: "10h/semana ≈ 1h26/dia" ou "≈ 2h30 em 4 dias",
- **seletor de dias**: *Dias úteis* / *Fim de semana* / *Todos os dias* / *Escolher dias* — resolve diretamente a dúvida "faço isso no fim de semana ou só durante a semana?".
- barra mostrando quanto das 168h já foi usado, com sono e trabalho já descontados e rotulados como fixos.

**B. Distribuição pelos dias** (o quadro kanban atual, simplificado)
Continua um dia por vez no celular, com a barra de carga do dia. As tarefas seguem sendo distribuídas automaticamente respeitando os dias escolhidos na seção A e inserindo pausas a cada 2h.

A aba **Semana ideal** é removida. O que ela fazia (rotina recorrente) passa a ser o seletor de dias da seção A — mais simples e sem conceito novo para aprender.

### 4. Hábitos com pré-definições

- Tela de hábitos ganha uma faixa de sugestões prontas no topo (as mesmas do onboarding); um toque adiciona.
- Todo hábito ativo para o dia aparece automaticamente no checklist do "Hoje" — é assim que entra na rotina.
- O histórico de 14 dias e a sequência continuam, sem gamificação agressiva.

### 5. "Revisão" vira pop-up

- Aba removida do menu.
- **Diário**: à noite (ou na primeira abertura do dia seguinte), pop-up curto: "Você honrou o que combinou consigo hoje?" com Sim / Nem tanto, humor, energia e uma frase opcional. Fecha em 20 segundos.
- **Semanal**: no domingo à noite ou na primeira abertura da segunda, pop-up maior com planejado × realizado por área e a mesma pergunta aplicada à semana.
- Só aparece uma vez por período; pode ser dispensado sem culpa.
- O histórico do checklist alimenta um resumo simples de produtividade dentro do pop-up semanal ("você cumpriu 72% do que combinou").

### Menu final

Hoje · Semana · Mensal · Hábitos · Ajustes

---

## Detalhes técnicos

- **Banco**: adicionar `preferred_days smallint[]` em `life_domains` (dias escolhidos na seção A) e uma coluna de controle de exibição dos pop-ups (`last_daily_prompt_at`, `last_weekly_prompt_at` em `settings`). Sem novas tabelas — `daily_checkins`, `habit_logs`, `tasks` e `time_blocks` já cobrem o histórico.
- **Rotas removidas**: `src/routes/_authenticated/diaria.tsx`, `semana-ideal.tsx`, `revisao.tsx`. `ancoras.tsx` é absorvida pelo onboarding e por Ajustes.
- **Novos arquivos**: `src/lib/quotes.ts` (lista curada + seleção determinística por data), `src/lib/presets.ts` (áreas e hábitos sugeridos), `src/components/checkin-dialog.tsx`, `src/components/break-bar.tsx`, `src/components/daily-checklist.tsx`.
- **Ajustes em** `scheduler.ts` / `task-sync.ts`: respeitar `preferred_days` na distribuição; a lógica de pausa a cada 2h já existe e é reaproveitada.
- `WeekTabs` é removido; a aba Semana passa a ser uma página só com âncoras de rolagem entre as duas seções.
