# Parar de desfazer suas alterações + perguntar o escopo ao excluir

## O problema (confirmado no código)

A aba Hoje remonta o dia sozinha (`montarDia`) e essa rotina hoje tem
permissão para **apagar e recriar** blocos:

- Ela apaga blocos "fora do período", "que atravessam colchete" e os que não
  seguem a grade — inclusive os que **você acabou de mover ou redimensionar**.
- Se uma área tem menos minutos do que o orçamento manda, ela considera o
  template "incompleto", reconstrói a Semana Ideal inteira e **refaz o dia do
  zero** — apagando tudo que você mexeu.
- Ao excluir uma atividade vinda da Semana Ideal, o bloco some mas o template
  continua lá; na próxima montagem ela **volta**.

Por isso a impressão de "altera e depois volta".

## O que vou fazer

### 1. Sua alteração é lei (anti-bug)

Todo bloco que você tocar (mover, redimensionar, editar, dividir, concluir)
passa a ficar marcado como **seu**. A montagem automática nunca apaga, move
nem recria um bloco marcado — ela só preenche buracos.

### 2. Montagem automática só quando faz sentido

- Roda **uma vez por dia**, na primeira abertura, e não depois de cada
  alteração.
- A reconstrução total da Semana Ideal deixa de acontecer sozinha: vira o
  botão "Refazer o dia", que já existe e avisa que vai substituir tudo.
- As faxinas destrutivas (fora do período / atravessa colchete) passam a valer
  só para blocos gerados automaticamente e ainda intocados.

### 3. Excluir volta a perguntar o escopo

Ao excluir qualquer atividade que veio da Semana Ideal — tanto pelo cartão
quanto pelo editor — aparece a pergunta:

- **Só hoje** — some do dia de hoje e não volta mais hoje.
- **Todos os dias neste horário** — remove também da Semana Ideal, então não
  reaparece amanhã nem nos próximos dias.

Atividades criadas à mão (que não vêm do template) continuam sendo excluídas
direto, sem pergunta.

### 4. Exclusão que não ressuscita

"Só hoje" deixa de ser um apagão puro: o registro fica guardado como removido
(invisível na tela), então a montagem automática sabe que você tirou aquilo e
não recria.

## Detalhes técnicos

- `time_blocks.status` ganha o valor `removido`; `useTimeBlocks` e as leituras
  de `hoje.tsx` filtram `status <> 'removido'`. `generateDayFromTemplate`
  passa a considerar esses registros em `jaGerados`, então o bloco do template
  não é recriado.
- Marca de intervenção manual: `confirmed_at` + `confirmation = 'manual'`
  gravados em `moverBloco`, `mover`, `editarBloco`, `dividirBloco`,
  `saveBlockTime`. `montarDia` (filtros `foraDoPeriodo`,
  `automaticosQueAtravessam`), `sanearDia`, `tidyDay` e `dedupeExact` passam a
  ignorar blocos com essa marca (hoje já ignoram `completed` e `task_id`).
- `montarDia`: remover o gatilho `templateIncompleto` → `rebuildIdealWeek` +
  `resetDayFromTemplate`; essa reconstrução fica apenas em `refazerDia`.
- `useEffect` de auto-preenchimento: chave passa a ser só a data e roda uma vez
  por dia (guarda em `useRef` + `sessionStorage`), sem depender de
  `templateDoDia`/`domains.length`, que mudam a cada refetch.
- Escopo na exclusão: envolver o `onDelete` do editor (linha ~978) com
  `comEscopo`, igual ao do cartão; no ramo `sempre`, apagar também a linha
  correspondente em `ideal_week_blocks` e invalidar `ideal-week`.
