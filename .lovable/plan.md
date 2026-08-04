# Por que a aba "Hoje" não mudou — e como corrigir

As mudanças da rodada anterior valeram para a **geração** do dia. Mas o dia de hoje
já estava salvo no banco desde antes, e o app nunca reescreve o que já existe
(ele só cria o que falta). Resultado: você continua vendo a agenda antiga.

Consultei os blocos de hoje e confirmei o que a imagem mostra:

- `Pausas 08:40–08:55` está como **atividade** dentro do colchete (15 min), não como pausa entre colchetes.
- Horários quebrados: 08:55, 10:10, 10:55, 11:25 — nada alinhado à grade de 2h.
- A pausa real cai em `11:25–11:40`, no meio do colchete 10:00–12:00, e não na virada.
- Vários blocos gravados como `24:00–24:00` (empurrados para fora do dia, duração zero).
- Existem áreas duplicadas cadastradas (dois "Dormir", dois "Trabalho", dois "Estudos", dois "Saúde", dois "Família"), além de "Pausas" e "Alimentação" cadastradas como áreas comuns — por isso elas viram cartões de atividade.

## O que vou fazer

### 1. Regenerar o dia em vez de só completar
A aba Hoje passa a reconstruir os blocos vindos da Semana Ideal quando eles estão
fora do padrão atual (duração < 30 min, horário não redondo, ou colados no fim do
dia). O que você moveu ou concluiu à mão continua intocado.

### 2. Limpeza dos blocos inválidos
Apagar de uma vez os blocos com duração zero / `24:00–24:00` e as pausas
duplicadas do dia, para o dia voltar a ser legível.

### 3. Pausas só entre colchetes
"Pausas" e "Alimentação" deixam de ser agendáveis como atividade comum no dia
(hoje só o sono é excluído). A pausa passa a ser sempre `block_kind = pausa`,
com a duração escolhida na aba Semana, exatamente na virada de cada colchete de
2h (08:00, 10:00, 12:00…), nunca dentro dele.

### 4. Grade redonda e mínimo de 30 min
Todo bloco criado no dia começa em horário redondo e nunca tem menos de 30 min —
o mesmo critério que já vale na Semana Ideal.

### 5. Áreas duplicadas
Mostrar/limpar as áreas repetidas para que o orçamento não fique dividido entre
dois cadastros da mesma área. Vou consolidar mantendo a que tem horas definidas.

## Detalhes técnicos
- `src/lib/day-schedule.ts`: `ensureDayBlocks` ganha etapa de saneamento (remove blocos com `end <= start`, fora de `dayEnd`, ou < 30 min vindos do template) antes de preencher; filtro de áreas automáticas (`ehAutomatica` de `budget-fit.ts`) junto com `isSleepDomain`; posicionamento com `snap` para horário redondo.
- `ensureBreaks`: pausas ancoradas na grade absoluta do relógio a partir de `dayStart` em passos de `interval`, em vez de derivarem do fim do último bloco; sempre `block_kind: "pausa"`.
- `src/lib/cascade.ts`: ao copiar a Semana Ideal para o dia, descartar blocos de área automática e blocos < 30 min.
- Limpeza pontual dos registros ruins de `time_blocks` e das linhas duplicadas de `life_domains`.
