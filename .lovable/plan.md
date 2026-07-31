## O problema (confirmado no código e nos seus dados)

**1. O app deixa você reservar mais horas do que o dia tem.**
O teto do orçamento hoje é 168h por semana (`WEEK_HOURS` em `src/lib/cascade.ts`), e o sono entra nessa conta. Mas os blocos só podem nascer na janela acordada do dia (06:00 até a hora de dormir). Ou seja: dá para "caber em 168h" e mesmo assim não caber em nenhum dia real — é exatamente aí que aparece o cartão "O que não coube hoje".

Nos seus dados de agora: as áreas acordadas somam ~149h/semana, mas a janela acordada real é ~115h/semana. Sobram ~34h que nunca teriam lugar.

**2. Há áreas duplicadas no banco** (dois "Trabalho" 50h + 49,98h, dois "Dormir" 52,5h + 35h, dois "Saúde", dois "Estudos"). Elas somam em dobro no orçamento e geram blocos repetidos no dia.

**3. As pausas caem em horários irregulares.**
Tanto o gerador da Semana Ideal quanto o `ensureBreaks` do dia contam "minutos acumulados de atividade" e colocam a pausa logo depois do bloco que fechou as 2h. Como os blocos têm durações quebradas, a pausa cai em 10:47, 13:23 etc. — não de 2 em 2 horas.

## O que vou construir

### A. Teto real: o app se responsabiliza pelas horas

- Nova função de capacidade em `src/lib/cascade.ts`: `capacidadeAcordadaPorDia = 24 − sono − refeições − pausas do dia`. Esse passa a ser o teto do orçamento, no lugar das 168h.
- Na aba **Semana**: o topo mostra "X h de Y h do seu dia" com a capacidade real; os sliders continuam auto-equilibrando, mas contra a capacidade acordada. Nenhum slider pode ultrapassar o que sobra — o excedente é retirado das outras áreas na hora, como já acontece.
- **Trava por dia da semana**, não só na média: se você marcar 3h de Academia em todos os dias mas na segunda já não sobra espaço, o app avisa no próprio dia (chip vermelho no seletor de dias) e reduz automaticamente.
- Salvar fica bloqueado enquanto houver dia estourado, com a mensagem do que precisa ceder.

### B. Nunca gerar mais do que cabe no dia

- `gerarSemanaIdealDetalhado` (`src/lib/ideal-week.ts`) passa a receber a capacidade do dia e **corta proporcionalmente** as horas das áreas antes de posicionar — nada é gerado para depois "não caber".
- `ensureDayBlocks` (`src/lib/day-schedule.ts`) só cria blocos até o limite de espaço livre real, respeitando `day_end`.
- O cartão "O que não coube hoje" deixa de existir no Hoje (ele era o sintoma). O aviso passa a ser preventivo, na Semana, no momento em que você distribui as horas.

### C. Pausas em grade fixa de 2 em 2 horas

- Novo trilho determinístico do dia: a partir do `day_start`, o dia vira ciclos de 2h de foco seguidos de uma pausa da duração que você escolheu (ex.: 06:00–08:00 foco · 08:00–08:15 pausa · 08:15–10:15 foco · …).
- Refeições continuam contando como pausa: quando um almoço cai dentro do ciclo, ele fecha o ciclo e o próximo começa quando a refeição acaba — sem pausa colada na refeição.
- Regra única, usada nos dois lugares: `ideal-week.ts` (template) e `day-schedule.ts` (`ensureBreaks` do dia) passam a chamar a mesma função `gradeDeCiclos()`, então template e dia nunca discordam.
- As atividades são encaixadas dentro dos ciclos; um bloco de 4h ocupa dois ciclos com a pausa no meio, exatamente como já acontece visualmente nos colchetes.

### D. Limpeza das áreas duplicadas

- Migração única que junta áreas com o mesmo nome por usuário (mantém a mais antiga, transfere blocos/metas/orçamentos, apaga a repetida) e cria índice único de nome por usuário para não voltar a acontecer.

## Detalhes técnicos

- `src/lib/cascade.ts`: `capacidadeAcordadaPorDia()`, `ajustarOrcamentoAoTeto()`, uso nos pontos que hoje usam `WEEK_HOURS`.
- `src/lib/ideal-week.ts`: `gradeDeCiclos(dayStart, dayEnd, pausaMin, refeições)` e substituição do laço de pausas por posicionamento na grade; corte proporcional prévio das áreas.
- `src/lib/day-schedule.ts`: `ensureBreaks` reescrito sobre `gradeDeCiclos` (idempotente, sem empurrar blocos para fora do dia); `ensureDayBlocks` limitado pelo espaço livre.
- `src/components/week-budget.tsx`: teto = capacidade acordada, validação por dia, bloqueio do salvar.
- `src/routes/_authenticated/hoje.tsx`: remoção do painel "O que não coube hoje".
- Migração SQL: merge de `life_domains` duplicadas + índice único `(user_id, lower(name))`.

Depois de implementar, verifico com uma sessão real no preview: reservo horas até o limite, confiro que o slider trava, refaço o dia e confirmo as pausas caindo exatamente nas marcas de 2h.
