## O que muda

Hoje o checklist é uma lista solta: cada área vira um item com "2h" e um checkbox — sem hora de início, sem fim. Vou trocar isso por uma **linha do tempo do dia** onde cada atividade ocupa um horário real, pode ser dividida em pedaços e é concluída bloco a bloco.

## 1. Hoje = agenda por horário

- Grade vertical do dia (padrão 06:00 → 22:00, vinda das suas configurações de início/fim de dia), com uma linha por hora e marcador da hora atual.
- Cada atividade aparece como um cartão colorido posicionado no seu horário (ex.: "Família 18:00–19:00"), com a cor da área.
- Interações mobile-first:
  - **arrastar** o cartão para outro horário (encaixe de 15 em 15 min);
  - **esticar** a borda inferior para mudar a duração;
  - **dividir**: "Família 2h" pode virar 1h de manhã + 1h à noite, com um toque em "Dividir";
  - toque no cartão abre uma folha inferior com área, duração, permitir pausa, excluir.
- Concluir um bloco: um toque marca feito, com **animação de confete** e som visual de progresso. O topo mostra "3h20 de 8h concluídas hoje" com barra animada.
- Pausas de 15 min a cada 2h continuam sendo inseridas automaticamente nos blocos que permitem pausa, mostradas como faixas discretas na linha do tempo.

## 2. Sincronia real com a Semana

Motivo do problema atual (verificado no código): a geração do dia ignora as áreas marcadas como âncora (`is_anchor`), por isso Dormir e Trabalho nunca aparecem no Hoje.

- Toda área com horas reservadas para o dia da semana atual passa a gerar bloco no dia — inclusive Dormir e Trabalho, que aparecem como blocos fixos (visual mais apagado, ancorados nos horários das Âncoras).
- Cada área vira bloco com a fatia diária de horas, posicionada automaticamente no primeiro espaço livre, respeitando sono/trabalho.
- Salvar a Semana atualiza o dia de hoje na hora; o que você mover no dia **não** altera o orçamento da semana.
- Banner no topo quando algo não coube: "Saúde (1h) não coube hoje — toque para encaixar".

## 3. Limpeza pedida

- Removo o cartão "Comece pela Palavra / Intenção do dia" e o campo de texto.
- A **frase motivacional do dia** fica como abertura única da tela.

## 4. Toque de jogo / responsividade

- Confete ao concluir bloco e ao fechar o dia 100%.
- Micro-animações: cartão "pulsa" ao encaixar, barra de progresso animada, feedback tátil (vibração curta) no celular.
- Alvos de toque grandes, rolagem suave, tudo pensado para tela de celular.

## Detalhes técnicos

- Fonte de verdade do dia passa a ser `time_blocks` (já tem `start_time`, `end_time`, `task_id`, `block_kind`, `completed`); `tasks` continua guardando a intenção/duração e o histórico de conclusão.
- Novo `src/components/day-timeline.tsx` (grade + cartões + dnd-kit, com sensor de toque) e `src/lib/day-schedule.ts` (gerar blocos do dia a partir do orçamento, dividir, mover, validar sobreposição). `src/lib/day-fill.ts` é reescrito para incluir âncoras e criar blocos.
- `src/components/daily-checklist.tsx` é substituído pela timeline em `hoje.tsx`.
- Reuso de `freeSlots`/`findSlot`/`sliceWithBreaks` do `scheduler.ts`; confete via `canvas-confetti`.
- Sem mudança de banco prevista — as tabelas atuais já suportam o modelo por horário.
