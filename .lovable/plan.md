## Por que as pausas sumiram

Confirmei no código: na aba Hoje o dia é montado em duas etapas (`src/routes/_authenticated/hoje.tsx`, linhas 249–269):

1. `ensureDayBlocks` preenche **todas** as vagas livres do dia com as áreas do orçamento;
2. só depois `ensureBreaks` tenta colocar as pausas.

Como a etapa 1 não deixa nenhum minuto livre, a etapa 2 descarta toda pausa que cai em horário ocupado (`src/lib/day-schedule.ts`, linha 170) e cria zero pausas. É exatamente o que aparece na sua tela: 06:00–08:00 e 08:00–10:00 colados, sem descanso entre eles.

## O que vou fazer

### 1. A pausa vira reserva, não sobra

Inverter a ordem: a grade de pausas de 2 em 2 horas é criada **antes** das atividades.

- `ensureBreaks` passa a rodar primeiro, sobre o dia ainda com o template (refeições, sono, trabalho do template).
- `ensureDayBlocks` passa a receber as pausas já criadas como espaço ocupado, então as áreas se encaixam **em volta** delas.
- Consequência natural e correta: com o descanso reservado, a capacidade real do dia diminui um pouco — e isso já está refletido no teto da aba Semana (`capacidadeAcordadaPorDia` desconta as pausas).

### 2. Pausa só onde faz sentido

Mantenho a regra atual: nada de pausa colada em refeição (a refeição já fecha o ciclo) e nada de pausa em ciclo sem atividade real. Depois de montado o dia, uma pausa que ficou entre dois vazios é removida, como já acontece no template da Semana Ideal.

### 3. Mostrar a pausa entre os colchetes

Hoje o `DayChecklist` desenha a pausa como um cartão **dentro** da faixa de 2h. Vou movê-la para o lugar que você espera: uma faixa fina de respiro **entre** um colchete e o próximo — linha tracejada com "Pausa · 15min", sem borda de colchete, ocupando altura pequena e fixa.

### 4. Refazer o dia

O botão "Refazer o dia" passa a usar a mesma ordem (pausas primeiro), então basta um toque para o dia atual se ajustar.

## Detalhes técnicos

- `src/lib/day-schedule.ts`: `ensureBreaks` deixa de depender de espaço livre residual e passa a ser chamado antes; `ensureDayBlocks` recebe as pausas em `ocupados` e continua limitado por `freeSlots`. Limpeza de pausas órfãs ao final.
- `src/routes/_authenticated/hoje.tsx`: trocar a ordem das chamadas e reconsultar os blocos entre as duas etapas.
- `src/components/day-checklist.tsx`: `agruparEmFocos` devolve as pausas como separadores entre grupos (não mais itens de dentro do colchete); `CartaoPausa` redesenhado como faixa divisória.

Depois de implementar, verifico no preview: refaço o dia e confiro que existe uma pausa visível entre 06:00–08:00 e o ciclo seguinte, e que nenhuma atividade foi empurrada para fora do dia.