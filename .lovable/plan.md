## 1. Editar bloco recorrente: "Só hoje" ou "Sempre"

Blocos do dia já guardam a origem no template (`ideal_block_id`), então dá para alterar só o bloco correspondente.

- Ao mover, redimensionar ou excluir um bloco que tenha origem na semana ideal, abre um diálogo curto com dois botões: **Só hoje** e **Sempre**.
- **Só hoje**: comportamento atual (altera/exclui apenas o bloco do dia).
- **Sempre**: aplica a mesma mudança também no bloco correspondente da semana ideal — novo horário de início/fim, ou exclusão. Nada de regenerar o template.
- Blocos sem origem no template (criados à mão) seguem sem perguntar nada.

## 2. Ações rápidas no bloco

No menu do bloco do dia:
- **Mover para amanhã** — mesmo horário, no dia seguinte.
- **Duplicar** — cópia logo depois, no primeiro espaço livre.
- **Desfazer** — depois de mover, adiar, excluir ou duplicar, aparece um aviso curto com "Desfazer" que reverte a última ação (guarda apenas a última).

No fim da lista do dia: botão **Empurrar tudo que não foi feito para amanhã**, que move de uma vez os blocos não concluídos.

Gestos (dentro do que já existe no arranjo atual da lista): deslizar para a direita marca como feito, para a esquerda adia para amanhã — com o mesmo aviso de desfazer.

## 3. Rotina configurável

Hoje `ACORDAR` (06:00), `PAUSA_MINUTOS` (15), `CICLO_FOCO` (120) e as durações de refeição (café 20, almoço 45, lanche 15, jantar 40) são fixas no código.

- Passam a vir das configurações, com esses mesmos valores como padrão.
- Novos campos na aba **Eu**: horário de acordar, duração da pausa, ciclo de foco (min) e duração de cada refeição.
- A geração da semana ideal e o preenchimento do dia passam a usar esses valores.

## 4. Preferência de período por área

- Cada área da vida ganha um campo **manhã / tarde / noite / tanto faz**, escolhido na aba Eu junto com cor e dias.
- O gerador da semana ideal passa a usar esse campo em vez de adivinhar por palavra-chave.
- Áreas existentes migram para "tanto faz".

## Detalhes técnicos

- Banco (uma migração):
  - `settings`: colunas `wake_time time default '06:00'`, `focus_cycle_minutes int default 120`, `meal_breakfast_minutes` 20, `meal_lunch_minutes` 45, `meal_snack_minutes` 15, `meal_dinner_minutes` 40. A duração da pausa reaproveita `break_duration_minutes` já existente.
  - `life_domains`: coluna `preferred_period text default 'qualquer'` com check em `manha|tarde|noite|qualquer` (default já migra as linhas atuais).
  - Sem tabelas novas; nenhuma mudança de RLS/grants necessária.
- `src/lib/ideal-week.ts`: constantes viram campos opcionais de `IdealWeekInput` (`acordar`, `pausaMinutos`, `cicloFoco`, `duracaoRefeicao`), mantendo os valores atuais como padrão; remover `MATINAIS`/`NOTURNAS` e usar `preferred_period` via `periodoPorArea`.
- `src/routes/_authenticated/hoje.tsx`: diálogo de escopo antes de aplicar mover/redimensionar/excluir quando `ideal_block_id` existir; mutações extras para amanhã, duplicar e empurrar pendentes; pilha de desfazer de 1 nível com toast de ação.
- `src/components/day-checklist.tsx`: novos itens de menu por bloco, botão de lote no rodapé e handlers de swipe (limiar horizontal, sem conflito com o drag vertical existente).
- `src/routes/_authenticated/eu.tsx`: novos campos de rotina e seletor de período por área.
- Identidade visual e componentes existentes permanecem como estão; `guardioes.ts`, `challenges.ts` e o onboarding não são tocados (só a leitura dos novos defaults quando gerar a semana).
