## 1. Arrastar atividade no "Hoje" (causa confirmada)

Hoje, ao soltar um cartão, o app recalcula os horários de **todas** as atividades do dia em sequência a partir da primeira (`planFromOrder` em `src/lib/day-schedule.ts`). Por isso um arraste "leva um monte junto".

Novo comportamento: **mover só o bloco arrastado**.

- Soltar em um colchete de 2h → o bloco vai para o primeiro espaço livre daquela faixa; se a faixa estiver cheia, ele entra e as atividades seguintes **dentro daquela faixa** cedem o mínimo necessário (nunca o dia inteiro).
- Soltar em cima de outro cartão → troca de lugar apenas com aquele cartão vizinho.
- Pausas, blocos concluídos e o restante do dia ficam parados.

## 2. Colchetes mais limpos no "Hoje"

- **Máximo de 4 cartões por colchete.** Passando disso, aparece "+N atividades" que expande sob demanda.
- **Unificar repetidos:** quando a mesma atividade aparece fatiada mais de uma vez no mesmo colchete (o caso dos vários "Trabalho ou estudo" da imagem), surge um botão "Unificar" no topo do colchete que funde os pedaços contíguos em um bloco só.
- Limpeza automática de duplicatas exatas (mesmo título e mesmo horário) ao montar o dia — o "Café da manhã" duplicado da imagem some.

## 3. Aba "Semana"

- **Sai o botão "Salvar horas da semana".** Cada alteração de slider, dia ou horário de refeição salva sozinha (com pequeno atraso para agrupar o arraste do slider). Nenhum texto do tipo "salvo automaticamente" na tela.
- **Sai todo o bloco de tarefas** mostrado na imagem: "Tarefas nos dias", "Distribuir backlog", as pastilhas de dias, a coluna do dia e o "Backlog". A Semana passa a ser só o orçamento de horas por área.
- **Excluir atividade/área:** cada cartão de área ganha um botão de excluir (com confirmação), removendo a área e as horas dela da semana.

## 4. Navegação e aba "Eu"

- A aba "Ajustes" vira **"Eu"**, com ícone de perfil.
- **Sai a setinha de sair** do topo; "Sair" passa a ficar dentro dos ajustes, na aba Eu.
- **Sai o botão de modo claro/escuro** do topo; o tema vira uma opção dentro dos ajustes.
- No lugar dele, um **ícone de sino** para notificações.
- A tela "Eu" mostra: cabeçalho de perfil, o **progresso de cada personagem-guardião** (o que cada um representa e o estado atual), e abaixo os ajustes atuais (áreas da vida, seu dia, foco, integrações, tema, sair).

## Detalhes técnicos

- `src/lib/day-schedule.ts`: substituir `planFromOrder`/`reorderDay` por um `moveBlockTo(bloco, faixaAlvo)` de efeito local; adicionar `mergeContiguous(blocos, ids)` e dedupe.
- `src/components/day-checklist.tsx`: limite de 4 itens por colchete + "ver mais", botão "Unificar", e uso do novo handler de drop.
- `src/components/week-budget.tsx`: remover o `Button` de salvar, salvar com debounce em `estado`/`refeicoes`/`pausaMin`; adicionar exclusão de área (arquivar + limpar `time_budgets`).
- `src/routes/_authenticated/semana.tsx`: remover a seção kanban, `DndContext`, `DayColumn`, `TaskCard`, distribuir backlog e "Nova tarefa".
- `src/components/app-shell.tsx`: NAV com `/eu` + ícone `User`, remover botões de tema e sair, adicionar `Bell`.
- Renomear a rota `/configuracoes` para `/eu` (com o conteúdo de ajustes + `GuardioesGrid`).
