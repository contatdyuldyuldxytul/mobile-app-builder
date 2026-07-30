## Objetivo

Deixar o "Hoje" com cara de checklist (como a referência), tornar a interação instantânea, distribuir o dia de forma mais humana e simplificar a "Semana". O "Mensal" passa a ser o topo da cascata: metas do mês → horas na semana → blocos no dia.

---

## 1. Hoje — checklist com ícones

Substituir a timeline por altura proporcional por uma lista de cartões de altura fixa.

```text
┌ Bloco de foco 09:00–11:00 ───────────────┐
│ ⟮ ○  [💼] Trabalhar no projeto Redima    │
│ ⟮        09:00 – 11:00              ✓    │
│ ⟮ ○  [📚] Leitura                        │
└──────────────────────────────────────────┘
   ⌣ Pausa 11:00 – 11:15   (cartão menor, fora do colchete)
```

- Cada atividade vira um cartão branco arredondado, mesma altura, com: círculo de seleção à esquerda, badge de ícone colorido pela área, título em negrito, horário abaixo e o círculo de "concluído" (teal preenchido) à direita.
- Ícones por área derivados do nome (Trabalho → maleta, Academia → halter, Estudos → livro, Família, Lazer, Fé, Finanças, Deslocamento, Alimentação, Sono...), com fallback genérico; fundo do badge = cor da área com opacidade.
- Pausas: cartão reduzido, discreto, tracejado, sem badge grande — e sempre fora do colchete.
- Blocos de foco de 2h: as atividades dentro da mesma janela ficam agrupadas sob um colchete vertical à esquerda com o rótulo do horário do bloco.
- Reordenar/mover continua por toque longo e arraste do cartão (troca de posição na lista), sem esticar altura.

## 2. Interação fluida

- Aplicar atualização otimista nas mutações de concluir/mover/excluir: o cartão muda na hora e o banco confirma depois (rollback com toast em caso de erro).
- Remover invalidações amplas em cascata a cada toque (hoje invalida `blocks`, `blocks-range`, `tasks`, `tasks-day`) — atualizar o cache local e revalidar só a chave do dia.
- Transições curtas (150 ms) de cor/opacidade; sem recalcular layout global durante o arraste.

## 3. Distribuição mais inteligente

Regras no gerador do dia/semana ideal:
- Manhã abre com uma rampa: café da manhã e, se existir, uma área leve/pessoal antes do trabalho — nunca começar 06:00 direto em trabalho.
- Pausa a cada 2h de atividade contínua, com duração escolhida na Semana (15–30 min); nunca duas pausas seguidas nem pausa colada a refeição.
- Refeições ancoradas nos horários informados pelo usuário (item 4 da Semana).
- Áreas noturnas/pessoais (família, lazer, fé, leitura) preferem o fim da tarde/noite; academia respeita o dia mas prefere manhã cedo ou fim de tarde.

## 4. Dividir no eixo do tempo

O ícone de tesoura passa a cortar o bloco ao meio no tempo e manter as duas metades em sequência no mesmo lugar (ex.: 09:00–11:00 vira 09:00–10:00 e 10:00–11:00), com opção de arrastar uma das metades depois. Nada é mandado para "o próximo espaço livre" automaticamente.

## 5. Progresso do dia em anel

Cartão com anel circular (teal) e porcentagem no centro, mais "X concluídas · Y restantes" ao lado — contagem por atividades, ignorando pausas.

---

## Semana

1. **Sono sem seletor de dias** — áreas âncora "diárias" (sono, alimentação, pausas) não mostram escolha de dias; sono é sempre 7 dias.
2. **Sliders que nunca estouram** — o máximo de cada slider é calculado a partir das horas ainda livres. Ao aumentar uma área além do disponível, o app reduz proporcionalmente as áreas não-âncora (as mais folgadas primeiro) em vez de exibir o aviso vermelho. O aviso de excedente deixa de existir.
3. **Pausas automáticas** — sem slider de horas. Só uma escolha de duração da pausa (15 / 20 / 25 / 30 min); o total semanal é calculado (uma pausa a cada 2h acordado) e mostrado como texto.
4. **Alimentação automática** — sem slider de horas. O usuário informa apenas os horários habituais de café da manhã, almoço, lanche da tarde e jantar; o app define as durações (ex.: 20/45/15/40 min) e ancora os blocos nesses horários. Isso exige guardar os horários das refeições nas configurações do usuário (nova migração no banco).
5. **Uma seção só** — remover as abas "1. Quanto tempo" / "2. Em quais dias". Fica a lista de áreas (sem título de seção) e, abaixo, o quadro de tarefas por dia.

---

## Mensal — ligado ao Hoje e à Semana

Transformar em "Mês" com três partes:

1. **Foco do mês** — 1 a 3 metas por área, cada uma com barra de progresso real: horas já vividas na área no mês / horas planejadas pelo orçamento semanal × semanas do mês.
2. **Mapa do mês** — grade dos dias do mês, cada dia com um ponto colorido conforme a proporção de blocos concluídos. Tocar em um dia abre o resumo daquele dia.
3. **Equilíbrio da vida** — comparação por área entre o que foi orçado e o que foi realmente feito no mês, apontando a área mais negligenciada e um botão que leva direto à Semana para corrigir as horas.

Cada meta pode gerar tarefas na Semana (botão "Levar para a semana"), fechando a cascata mês → semana → dia.

---

## Detalhes técnicos

- `src/components/day-timeline.tsx` → substituído por `day-checklist.tsx` (cartões de altura fixa, colchetes de foco, ícone por área).
- Novo `src/lib/area-icons.ts` mapeando nome de área → ícone Lucide + tom de fundo.
- `src/lib/ideal-week.ts` e `src/lib/day-schedule.ts`: novas regras de sequenciamento (rampa matinal, pausa a cada 2h sem repetição, refeições ancoradas).
- `src/lib/day-schedule.ts`: `splitBlock` divide no tempo, em sequência.
- `src/components/week-budget.tsx`: sliders com teto dinâmico e reequilíbrio automático; pausas e alimentação sem slider de horas.
- Migração: colunas de horários de refeição em `settings` (café, almoço, lanche, jantar) e duração de pausa já existente (`break_duration_minutes`).
- `src/routes/_authenticated/hoje.tsx`, `semana.tsx`, `mensal.tsx`: telas reescritas conforme acima.
